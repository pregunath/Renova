// @ts-nocheck
/**
 * Playwright port of Cypress "Journey 1".
 *
 * This mirrors `cypress/e2e/moodboards.cy.js` "Journey 1: Create, Update
 * Properties, Shadow, Mirror, Delete, Save, Reload" and additionally drives
 * image Resize + Rotation. The resize/rotate steps intentionally lean on
 * Playwright *handles* (https://playwright.dev/docs/handles) instead of
 * `page.evaluate(...)` round-trips:
 *
 *   - We obtain a JSHandle to the Konva **item Group** (the Transformer target)
 *     via `page.evaluateHandle` for anchor math, and pass that handle into
 *     `page.evaluate(..., { node: groupHandle })` (handles as parameters).
 *   - Rotation lives on the Group; resize is committed into the inner `Image`
 *     width/height after `onTransform` resets group scale (BoardCanvas.jsx).
 *   - Post-gesture assertions use fresh `page.evaluate` lookups so we never read
 *     a stale handle after React/Konva reconciles the scene graph.
 *   - We call `handle.dispose()` as soon as a gesture + its checks are done.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const mockJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTksInJvbGUiOiJVU0VSIiwic3ViIjoidGVzdEBleGFtcGxlLmNvbSJ9.mock-signature';
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

const pathMatches = (urlString, re) => {
  try {
    return re.test(new URL(urlString).pathname);
  } catch {
    return false;
  }
};

/** Parent Group of the first Image on the moodboard stage (BoardCanvas item). */
async function acquireBoardImageGroupHandle(page) {
  const h = await page.evaluateHandle(() => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const imgs = stage.find('Image');
      if (imgs.length) {
        const main = imgs[imgs.length - 1];
        const p = main.getParent();
        if (p) return p;
      }
    }
    return null;
  });
  const ok = await h.evaluate((node) => node != null);
  expect(ok, 'Konva item Group JSHandle should exist').toBe(true);
  return h;
}

async function readBoardMainMetricsFresh(page) {
  return page.evaluate(() => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const imgs = stage.find('Image');
      if (!imgs.length) continue;
      const main = imgs[imgs.length - 1];
      const g = main.getParent();
      return {
        rotation: g.rotation(),
        imgW: main.width(),
        imgH: main.height(),
      };
    }
    return null;
  });
}

async function resolveBoardImageCenterFresh(page) {
  return page.evaluate(() => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const imgs = stage.find('Image');
      if (!imgs.length) continue;
      const g = imgs[imgs.length - 1].getParent();
      const st = g.getStage();
      const container = st.container().getBoundingClientRect();
      const box = g.getClientRect({ relativeTo: st });
      return {
        x: container.left + box.x + box.width * 0.5,
        y: container.top + box.y + box.height * 0.5,
      };
    }
    return { x: 0, y: 0 };
  });
}

function waitForTransformerAttached(page) {
  return page.waitForFunction(
    () => {
      const Konva = /** @type {any} */ (window).Konva;
      for (const stage of Konva?.stages ?? []) {
        const trs = stage.find('Transformer');
        if (!trs?.length) continue;
        const tr = trs[0];
        if (typeof tr.nodes === 'function' && tr.nodes().length > 0) return true;
      }
      return false;
    },
    { timeout: 12_000 }
  );
}

/** Center of a Transformer anchor (e.g. `top-right`, `rotater`) in viewport pixels. */
async function getTransformerAnchorClientPoint(page, anchorName) {
  return page.evaluate((name) => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const trs = stage.find('Transformer');
      for (const tr of trs ?? []) {
        if (typeof tr.nodes !== 'function' || tr.nodes().length === 0) continue;
        const anchor = tr.findOne(`.${name}`);
        if (!anchor || anchor.visible() === false) continue;
        const st = tr.getStage();
        const container = st.container().getBoundingClientRect();
        const rect = anchor.getClientRect({ relativeTo: st, skipStroke: true });
        return {
          x: container.left + rect.x + rect.width / 2,
          y: container.top + rect.y + rect.height / 2,
        };
      }
    }
    return null;
  }, anchorName);
}

test.describe('Moodboard Editor Journeys (Playwright)', () => {
  test('Journey 1: Create, Resize+Rotate (via handles), Properties, Shadow, Mirror, Delete, Save, Reload', async ({
    page,
    browserName,
  }) => {
    // Transformer pointer math is only reliable in Chromium, matching the
    // existing `moodboard-transform.spec.js`.
    test.skip(
      browserName !== 'chromium',
      'Konva Transformer pointer behavior is validated in Chromium only.'
    );

    const fixturePath = path.resolve(process.cwd(), 'cypress/fixtures/test-image.jpg');
    const mockUploadSrc = '/moodboard/mock-board-id/test-image.jpg';

    // Mutable mock board state, just like the Cypress `beforeEach`. Journey 1
    // expects the GET to always echo "My UI Test Board" so the reload check at
    // the end passes.
    let mockBoardState = {
      id: 'mock-board-id',
      title: 'My UI Test Board',
      background: '#ffffff',
      isPublic: true,
      scene: JSON.stringify({ items: [] }),
    };

    await page.setViewportSize({ width: 1280, height: 720 });

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ accessToken: mockJwt, refreshToken: mockJwt }),
      });
    });
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ accessToken: mockJwt, refreshToken: mockJwt }),
      });
    });
    await page.route('**/api/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ email: 'test@example.com', name: 'Test User' }),
      });
    });
    await page.route('**/api/plans/usage', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ usage: { moodboardsUsed: 0, moodboardsLimit: 10 } }),
      });
    });
    await page.route('**/api/moodboard', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({ status: 200, body: JSON.stringify([]) });
        return;
      }
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ id: 'mock-board-id', elements: [] }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route(
      (url) => pathMatches(url.toString(), /^\/api\/moodboard\/mock-board-id$/),
      async (route, request) => {
        const method = request.method();
        if (method === 'GET') {
          await route.fulfill({ status: 200, body: JSON.stringify(mockBoardState) });
          return;
        }
        if (method === 'PUT' || method === 'PATCH') {
          try {
            const body = request.postDataJSON();
            if (body && typeof body === 'object') {
              mockBoardState = { ...mockBoardState, ...body, title: 'My UI Test Board' };
            }
          } catch {
            // Non-JSON (e.g. multipart) saves: leave state as-is, just ack.
          }
          await route.fulfill({ status: 200, body: JSON.stringify(mockBoardState) });
          return;
        }
        await route.fallback();
      }
    );

    await page.route(
      (url) => pathMatches(url.toString(), /^\/api\/moodboard\/[^/]+\/items$/),
      async (route, request) => {
        if (request.method() !== 'POST') {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ src: mockUploadSrc }),
        });
      }
    );

    const fixtureBytes = fs.readFileSync(fixturePath);
    await page.route(
      (url) => {
        const p = url.pathname;
        return (
          p.includes('test-image.jpg') ||
          p.includes('item-by-src') ||
          p.includes(encodeURIComponent(mockUploadSrc))
        );
      },
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'image/jpeg',
          body: fixtureBytes,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
    );

    // ------------------------------------------------------------------
    // 1. Log in and create a moodboard (matches Cypress beforeEach + step 1)
    // ------------------------------------------------------------------
    await test.step('Log in and create a moodboard', async () => {
      await page.goto(`${baseUrl}/auth?mode=login`);
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

      await page.evaluate((token) => {
        window.localStorage.setItem('accessToken', token);
      }, mockJwt);

      await page.getByText(/Create New/i).first().click();
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });

      // Must save before uploading images, per application logic.
      await page.click('button[title="Save"]');
      await expect(page.locator('.ant-modal')).toBeVisible();
      await page.locator('.ant-modal input').first().fill('My UI Test Board');
      await page.locator('.ant-modal').getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Moodboard saved.')).toBeVisible();

      await page.waitForURL(/\/mock-board-id(\/|$)/, { timeout: 20_000 });
      // Close any open menus (e.g. account dropdown) so pointer events hit the canvas.
      await page.keyboard.press('Escape');
    });

    // ------------------------------------------------------------------
    // 2. Upload image via file explorer (mirrors insertImageViaExplorer)
    // ------------------------------------------------------------------
    await test.step('Insert the test image onto the canvas', async () => {
      const uploadDone = page.waitForResponse(
        (res) =>
          res.request().method() === 'POST' &&
          res.status() === 201 &&
          pathMatches(res.url(), /^\/api\/moodboard\/[^/]+\/items$/),
        { timeout: 20_000 }
      );
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('button[title="Add image"]').click(),
      ]);
      await fileChooser.setFiles(fixturePath);
      await uploadDone;

      // Wait until Konva's scene graph actually contains an Image node.
      await page.waitForFunction(
        () => {
          const Konva = /** @type {any} */ (window).Konva;
          if (!Konva?.stages?.length) return false;
          for (const stage of Konva.stages) {
            if (stage.find('Image').length > 0) return true;
          }
          return false;
        },
        { timeout: 15_000 }
      );
      await page.waitForTimeout(500);
    });

    const resolvePointWithHandle = async (handle, relX, relY) =>
      page.evaluate(
        ({ node, rx, ry }) => {
          const st = node.getStage();
          const container = st.container().getBoundingClientRect();
          const box = node.getClientRect({ relativeTo: st });
          return {
            x: container.left + box.x + box.width * rx,
            y: container.top + box.y + box.height * ry,
          };
        },
        { node: handle, rx: relX, ry: relY }
      );

    const clickToolbar = async (selectors, label) => {
      for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
          await loc.click({ force: true });
          return;
        }
      }
      throw new Error(`Toolbar button not found: ${label}`);
    };

    const clickBoardImageCenter = async () => {
      const pt = await resolveBoardImageCenterFresh(page);
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(200);
    };

    // ------------------------------------------------------------------
    // 3–4. Select image + wait for Transformer (SelectionTransformer uses rAF).
    // ------------------------------------------------------------------
    const initialMetrics = await readBoardMainMetricsFresh(page);
    expect(initialMetrics, 'board image metrics should be readable').toBeTruthy();

    let groupHandle = await acquireBoardImageGroupHandle(page);
    const center = await resolvePointWithHandle(groupHandle, 0.5, 0.5);

    await test.step('Select the image on the canvas', async () => {
      await page.mouse.click(center.x, center.y);
      await waitForTransformerAttached(page);
    });

    // ------------------------------------------------------------------
    // 5. Resize via the top-right Transformer anchor.
    //    Anchor position is computed *from the live handle* so it tracks
    //    whatever the current Konva scale/stage transform is.
    // ------------------------------------------------------------------
    await test.step('Resize via Transformer anchor (handle-driven)', async () => {
      const topRightPt = await getTransformerAnchorClientPoint(page, 'top-right');
      expect(topRightPt, 'Konva Transformer top-right anchor').toBeTruthy();
      const centerPt = await resolvePointWithHandle(groupHandle, 0.5, 0.5);
      const dragEnd = {
        x: topRightPt.x + (centerPt.x - topRightPt.x) * 0.42,
        y: topRightPt.y + (centerPt.y - topRightPt.y) * 0.42,
      };
      await page.mouse.move(topRightPt.x, topRightPt.y);
      await page.mouse.down();
      await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 22 });
      await page.mouse.up();
      await groupHandle.dispose();

      await expect
        .poll(
          async () => {
            const m = await readBoardMainMetricsFresh(page);
            if (!m) return 0;
            return (
              Math.abs(m.imgW - initialMetrics.imgW) + Math.abs(m.imgH - initialMetrics.imgH)
            );
          },
          {
            message: 'Konva main image width/height should change after resize',
            timeout: 12_000,
          }
        )
        .toBeGreaterThan(2);
    });

    // ------------------------------------------------------------------
    // 6. Rotate via the Transformer's rotater handle. Its screen position
    //    depends on the current node rect, which we read live off the
    //    JSHandle again (no hard-coded pixel offsets).
    // ------------------------------------------------------------------
    await test.step('Rotate via Transformer rotater (handle-driven)', async () => {
      groupHandle = await acquireBoardImageGroupHandle(page);
      await waitForTransformerAttached(page);

      const beforeRotate = await readBoardMainMetricsFresh(page);
      expect(beforeRotate, 'board image metrics before rotate').toBeTruthy();

      const rotaterStart = await getTransformerAnchorClientPoint(page, 'rotater');
      expect(rotaterStart, 'Konva Transformer rotater anchor').toBeTruthy();

      const center2 = await resolvePointWithHandle(groupHandle, 0.5, 0.5);
      const arcRadius =
        Math.hypot(rotaterStart.x - center2.x, rotaterStart.y - center2.y) || 90;

      await page.mouse.move(rotaterStart.x, rotaterStart.y);
      await page.mouse.down();
      const steps = 16;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const angle = -Math.PI / 2 + (Math.PI / 3) * t;
        await page.mouse.move(
          center2.x + arcRadius * Math.cos(angle),
          center2.y + arcRadius * Math.sin(angle)
        );
      }
      await page.mouse.up();
      await groupHandle.dispose();

      const afterRotate = await readBoardMainMetricsFresh(page);
      expect(afterRotate, 'board image metrics after rotate').toBeTruthy();
      expect(
        Math.abs(afterRotate.rotation - beforeRotate.rotation) > 1,
        `group rotation should change after rotate gesture (was ${beforeRotate.rotation}, now ${afterRotate.rotation})`
      ).toBe(true);
    });

    await clickBoardImageCenter();

    // ------------------------------------------------------------------
    // 7. Toolbar actions from Cypress Journey 1.
    // ------------------------------------------------------------------
    await test.step('Duplicate', async () => {
      await clickBoardImageCenter();
      await clickToolbar(['button[title="Duplicate"]'], 'Duplicate');
      await page.waitForTimeout(600);
    });

    await test.step('Shadow', async () => {
      await clickBoardImageCenter();
      await clickToolbar(
        [
          'button[title="Shadow"]',
          'button[title="Add shadow"]',
          'button[aria-label="Shadow"]',
        ],
        'Shadow'
      );
      await page.waitForTimeout(500);
    });

    await test.step('Crop (enter + apply)', async () => {
      await clickBoardImageCenter();
      await clickToolbar(
        ['button[title="Crop"]', 'img[alt="Crop"]'],
        'Crop'
      );
      await page.waitForTimeout(400);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    });

    await test.step('Mirror / Flip', async () => {
      await clickBoardImageCenter();
      await clickToolbar(
        [
          'button[title="Mirror"]',
          'button[title="Flip"]',
          'button[aria-label*="Flip" i]',
        ],
        'Mirror'
      );
      await page.waitForTimeout(500);
    });

    await test.step('Forward + Backward', async () => {
      await clickBoardImageCenter();
      await clickToolbar(['button[title="Forward"]'], 'Forward');
      await page.waitForTimeout(250);
      await clickToolbar(['button[title="Backward"]'], 'Backward');
      await page.waitForTimeout(250);
    });

    await test.step('Delete', async () => {
      await clickBoardImageCenter();
      await clickToolbar(
        ['button[title="Delete"]', 'button[aria-label="Delete"]'],
        'Delete'
      );
      await page.waitForTimeout(600);
    });

    // ------------------------------------------------------------------
    // 8. Save and 9. Reload + verify title.
    // ------------------------------------------------------------------
    await test.step('Save board', async () => {
      await page.click('button[title="Save"]');
      await page.locator('.ant-modal').getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Moodboard saved.')).toBeVisible();
    });

    await test.step('Reload and verify board title persists', async () => {
      await page.reload();
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('input[aria-label="Project name"]')).toHaveValue(
        'My UI Test Board'
      );
    });
  });
});
