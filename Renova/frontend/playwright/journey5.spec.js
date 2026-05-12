// @ts-nocheck
import { test, expect } from '@playwright/test';

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

async function readTargetTextMetrics(page, targetText) {
  return page.evaluate((needle) => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const textNodes = stage.find('Text');
      for (let i = textNodes.length - 1; i >= 0; i -= 1) {
        const t = textNodes[i];
        if (String(t.text?.() ?? '') !== needle) continue;
        const g = t.getParent();
        const rect = g.getClientRect({ relativeTo: stage });
        return {
          exists: true,
          w: rect.width ?? 0,
          h: rect.height ?? 0,
          rot: g.rotation?.() ?? 0,
        };
      }
    }
    return { exists: false, w: 0, h: 0, rot: 0 };
  }, targetText);
}

async function resolveTargetTextCenter(page, targetText) {
  return page.evaluate((needle) => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const textNodes = stage.find('Text');
      for (let i = textNodes.length - 1; i >= 0; i -= 1) {
        const t = textNodes[i];
        if (String(t.text?.() ?? '') !== needle) continue;
        const g = t.getParent();
        const container = stage.container().getBoundingClientRect();
        const box = g.getClientRect({ relativeTo: stage });
        return {
          x: container.left + box.x + box.width / 2,
          y: container.top + box.y + box.height / 2,
        };
      }
    }
    return { x: 0, y: 0 };
  }, targetText);
}

test.describe('Moodboard text journey', () => {
  test('Journey 5: add text, edit, resize large, rotate, save and reload', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000);
    test.skip(browserName !== 'chromium', 'Transformer interactions are validated in Chromium.');

    const boardTitle = 'Journey 5 Text Board';
    const sampleText = 'Sample Text';

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
        await route.fulfill({ status: 201, body: JSON.stringify({ id: 'mock-board-id' }) });
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
        if (method === 'PATCH' || method === 'PUT') {
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
                mockBoardState = { ...mockBoardState, ...body, scene: sceneStr };
              }
            } catch {}
          } else {
            const raw = request.postData();
            if (typeof raw === 'string') {
              const title = extractMultipartField(raw, 'title');
              const scene = extractMultipartField(raw, 'scene');
              if (title) mockBoardState = { ...mockBoardState, title };
              if (scene) {
                try {
                  JSON.parse(scene);
                  mockBoardState = { ...mockBoardState, scene };
                } catch {}
              }
            }
          }
          await route.fulfill({ status: 200, body: JSON.stringify(mockBoardState) });
          return;
        }
        await route.fallback();
      }
    );

    await test.step('Open board', async () => {
      await page.goto(`${baseUrl}/auth?mode=login`);
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
      await page.goto(`${baseUrl}/dashboard/moodboards/mock-board-id`);
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });
    });

    await test.step('Insert text and edit to sample text', async () => {
      await page.getByRole('button', { name: /^Board$/ }).click({ force: true });
      await page.locator('button[title="Add text"]').first().click({ force: true });

      const stage = page.locator('.konvajs-content').first();
      const box = await stage.boundingBox();
      expect(box).toBeTruthy();
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

      await page.mouse.dblclick(center.x, center.y);
      const ta = page.locator('textarea').last();
      await expect(ta).toBeVisible({ timeout: 8_000 });
      await ta.fill(sampleText);
      await ta.press('Escape');
      await page.keyboard.press('Escape');
      await page.mouse.click(center.x + 8, center.y + 8);
      await page.waitForTimeout(200);

      await expect
        .poll(async () => (await readTargetTextMetrics(page, sampleText)).exists, {
          timeout: 10_000,
          message: 'Konva text with sample content should exist',
        })
        .toBe(true);
    });

    const before = await readTargetTextMetrics(page, sampleText);

    await test.step('Resize text larger', async () => {
      const center = await resolveTargetTextCenter(page, sampleText);
      await page.mouse.click(center.x, center.y);
      await waitForTransformerAttached(page);

      const topRight = await getTransformerAnchorClientPoint(page, 'top-right');
      expect(topRight).toBeTruthy();
      const dragTo = { x: topRight.x + 70, y: topRight.y - 55 };
      await page.mouse.move(topRight.x, topRight.y);
      await page.mouse.down();
      await page.mouse.move(dragTo.x, dragTo.y, { steps: 18 });
      await page.mouse.up();

      await expect
        .poll(async () => {
          const now = await readTargetTextMetrics(page, sampleText);
          return now.w * now.h - before.w * before.h;
        }, { timeout: 10_000, message: 'Text bounding area should increase after resize' })
        .toBeGreaterThan(10);
    });

    await test.step('Rotate text', async () => {
      const center = await resolveTargetTextCenter(page, sampleText);
      await page.mouse.click(center.x, center.y);
      await waitForTransformerAttached(page);

      const rotater = await getTransformerAnchorClientPoint(page, 'rotater');
      expect(rotater).toBeTruthy();
      const radius = Math.max(80, Math.hypot(rotater.x - center.x, rotater.y - center.y));

      await page.mouse.move(rotater.x, rotater.y);
      await page.mouse.down();
      for (let i = 1; i <= 16; i += 1) {
        const t = i / 16;
        const angle = -Math.PI / 2 + (Math.PI / 3) * t;
        await page.mouse.move(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
      }
      await page.mouse.up();

      await expect
        .poll(async () => Math.abs((await readTargetTextMetrics(page, sampleText)).rot), {
          timeout: 10_000,
          message: 'Text rotation should change after rotate gesture',
        })
        .toBeGreaterThan(1);
    });

    await test.step('Save and reload verify transformed text persisted', async () => {
      await page.click('button[title="Save"]');
      await page.locator('.ant-modal').getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Moodboard saved.')).toBeVisible();

      const parsed = JSON.parse(mockBoardState.scene);
      const txt = parsed.items?.find((it) => it.kind === 'text' && it.text === sampleText);
      expect(txt).toBeTruthy();
      expect((txt.w ?? 0) > before.w || (txt.h ?? 0) > before.h).toBe(true);
      expect(Math.abs(txt.rot ?? 0)).toBeGreaterThan(1);

      await page.reload();
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('input[aria-label="Project name"]')).toHaveValue(boardTitle);
      await expect
        .poll(async () => (await readTargetTextMetrics(page, sampleText)).exists, { timeout: 12_000 })
        .toBe(true);
    });
  });
});

