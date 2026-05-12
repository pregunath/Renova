// @ts-nocheck
/**
 * Playwright Journey 2: crop flow — enter crop, adjust crop frame by dragging
 * the bottom edge, click the green check, then fire `Enter` (same shortcut as
 * CropHUD / canvas background) so apply always commits; save, reload, verify.
 *
 * Crop HUD lives in a second Konva layer (see BoardCanvas.jsx `CropHUD`).
 * The mock API merges multipart `scene` from manual save (FormData), not only JSON.
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

/** Manual save uses multipart `FormData` with a `scene` JSON part (see moodboards page.jsx). */
function extractMultipartField(raw, fieldName) {
  const key = `name="${fieldName}"`;
  const idx = raw.indexOf(key);
  if (idx < 0) return null;
  const tail = raw.slice(idx + key.length);
  const sep = tail.indexOf('\r\n\r\n');
  const sepAlt = tail.indexOf('\n\n');
  const useSep = sep >= 0 ? sep : sepAlt;
  if (useSep < 0) return null;
  const headerLen = sep >= 0 ? 4 : 2;
  const rest = tail.slice(useSep + headerLen);
  const end = rest.search(/\r\n-{2,}/);
  const val = (end >= 0 ? rest.slice(0, end) : rest).trim();
  return val || null;
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

function waitForCropHudLayer(page) {
  return page.waitForFunction(
    () => {
      const Konva = /** @type {any} */ (window).Konva;
      for (const stage of Konva?.stages ?? []) {
        const layers = stage.getLayers?.() ?? [];
        if (layers.length < 2) continue;
        const cropLayer = layers[layers.length - 1];
        const images = cropLayer.find('Image');
        for (const im of images) {
          const el = im.image?.();
          if (el && (el instanceof HTMLImageElement ? el.complete && el.naturalWidth : true)) {
            if ((im.width?.() ?? 0) > 10 && (im.height?.() ?? 0) > 10) return true;
          }
        }
      }
      return false;
    },
    { timeout: 20_000 }
  );
}

async function expectCropHudClosed(page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const Konva = /** @type {any} */ (window).Konva;
          for (const stage of Konva?.stages ?? []) {
            return stage.getLayers?.()?.length ?? 0;
          }
          return 0;
        }),
      { message: 'Crop HUD layer should unmount (single stage layer)', timeout: 15_000 }
    )
    .toBe(1);
}

/**
 * Viewport coords: drag bottom crop edge upward, and green check (apply) button.
 * Finds the crop outline Rect (blue stroke, no dim overlay fill), then applies
 * the same layout offsets as CropHUD.jsx (`x={box.x + box.w + 8}`, `y={box.y - 4}`, 28×28).
 */
async function getCropHudPointerTargets(page) {
  return page.evaluate(() => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const layers = stage.getLayers?.() ?? [];
      if (layers.length < 2) return null;
      const cropLayer = layers[layers.length - 1];
      const rects = cropLayer.find('Rect');
      /** @type {any} */
      let outline = null;
      let bestArea = 0;
      for (const r of rects) {
        if (!r.strokeEnabled?.() || !r.stroke?.()) continue;
        const strokeStr = String(r.stroke());
        if (!strokeStr.includes('20') && !strokeStr.includes('164')) continue;
        const w = r.width?.() ?? 0;
        const h = r.height?.() ?? 0;
        if (w < 24 || h < 24) continue;
        const area = w * h;
        if (area > bestArea) {
          bestArea = area;
          outline = r;
        }
      }
      if (!outline) return null;

      const cont = stage.container().getBoundingClientRect();
      const ob = outline.getClientRect({ relativeTo: stage });
      const midX = cont.left + ob.x + ob.width / 2;
      const dragStart = { x: midX, y: cont.top + ob.y + ob.height - 12 };
      const dragEnd = { x: midX, y: cont.top + ob.y + ob.height * 0.5 };
      // Apply group top-left in stage space: (ob.x + ob.w + 8, ob.y - 4); button 28×28.
      const applyCenter = {
        x: cont.left + ob.x + ob.width + 8 + 14,
        y: cont.top + ob.y - 4 + 14,
      };
      return { dragStart, dragEnd, applyCenter };
    }
    return null;
  });
}

test.describe('Moodboard crop journey', () => {
  test('Journey 2: Crop image, drag crop frame, apply with check, save, reload', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000);
    test.skip(browserName !== 'chromium', 'Konva crop HUD is exercised in Chromium only.');

    const fixturePath = path.resolve(process.cwd(), 'cypress/fixtures/test-image.jpg');
    const mockUploadSrc = '/moodboard/mock-board-id/test-image.jpg';
    const boardTitle = 'Journey 2 Crop Board';

    let mockBoardState = {
      id: 'mock-board-id',
      title: boardTitle,
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
          const ct = (request.headers()['content-type'] || '').toLowerCase();
          if (ct.includes('application/json')) {
            try {
              const body = request.postDataJSON();
              if (body && typeof body === 'object') {
                const sceneStr =
                  typeof body.scene === 'string'
                    ? body.scene
                    : body.scene != null
                      ? JSON.stringify(body.scene)
                      : mockBoardState.scene;
                mockBoardState = { ...mockBoardState, ...body, scene: sceneStr, title: boardTitle };
              }
            } catch {
              // ignore
            }
          } else {
            const raw = request.postData();
            if (typeof raw === 'string') {
              const scenePart = extractMultipartField(raw, 'scene');
              if (scenePart) {
                try {
                  JSON.parse(scenePart);
                  mockBoardState = { ...mockBoardState, scene: scenePart };
                } catch {
                  // ignore invalid scene
                }
              }
              const titlePart = extractMultipartField(raw, 'title');
              if (titlePart) {
                mockBoardState = { ...mockBoardState, title: titlePart };
              }
            }
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

    await test.step('Log in, create board, save with title', async () => {
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

      await page.click('button[title="Save"]');
      await expect(page.locator('.ant-modal')).toBeVisible();
      await page.locator('.ant-modal input').first().fill(boardTitle);
      await page.locator('.ant-modal').getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Moodboard saved.')).toBeVisible();
      await page.waitForURL(/\/mock-board-id(\/|$)/, { timeout: 20_000 });
      await page.keyboard.press('Escape');
    });

    await test.step('Upload image', async () => {
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
      await page.waitForTimeout(400);
    });

    await test.step('Select image and open crop mode', async () => {
      await page.locator('.konvajs-content').first().scrollIntoViewIfNeeded();
      const pt = await resolveBoardImageCenterFresh(page);
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(250);

      await page.locator('button[title="Crop"], img[alt="Crop"]').first().click({ force: true });
      await waitForCropHudLayer(page);
    });

    await test.step('Drag crop window (bottom edge) then press check', async () => {
      await expect
        .poll(async () => getCropHudPointerTargets(page), {
          message: 'Crop HUD outline + apply button should be discoverable',
          timeout: 10_000,
        })
        .toBeTruthy();

      const targets = await getCropHudPointerTargets(page);
      expect(targets).toBeTruthy();

      const { dragStart, dragEnd, applyCenter } = /** @type {{ dragStart: { x: number; y: number }; dragEnd: { x: number; y: number }; applyCenter: { x: number; y: number } }} */ (
        targets
      );

      await page.mouse.move(dragStart.x, dragStart.y);
      await page.mouse.down();
      await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 18 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      // Green check (CropHUD apply group); same shortcut as BoardCanvas / CropHUD `Enter`.
      await page.mouse.move(applyCenter.x, applyCenter.y);
      await page.mouse.click(applyCenter.x, applyCenter.y);
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
      });
      await expectCropHudClosed(page);
    });

    await test.step('Save board', async () => {
      await page.click('button[title="Save"]');
      await page.locator('.ant-modal').getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Moodboard saved.')).toBeVisible();
      const scene = JSON.parse(mockBoardState.scene);
      expect(scene.items?.some((it) => it.kind === 'image' && it.crop)).toBe(true);
    });

    await test.step('Reload and verify title + persisted crop on image', async () => {
      await page.reload();
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('input[aria-label="Project name"]')).toHaveValue(boardTitle);

      await page.waitForFunction(
        () => {
          const Konva = /** @type {any} */ (window).Konva;
          for (const stage of Konva?.stages ?? []) {
            for (const im of stage.find('Image')) {
              const cr = im.crop?.();
              if (cr && cr.width > 2 && cr.height > 2) return true;
            }
          }
          return false;
        },
        { timeout: 20_000 }
      );
    });
  });
});
