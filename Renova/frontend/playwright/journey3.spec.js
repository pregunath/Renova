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

async function readDrawingMetricsFresh(page) {
  return page.evaluate(() => {
    const Konva = /** @type {any} */ (window).Konva;
    const resolveDrawingNode = (line) => {
      let node = line?.getParent?.();
      while (node && typeof node.id === 'function' && !node.id()) {
        node = node.getParent?.();
      }
      return node || line?.getParent?.() || null;
    };
    for (const stage of Konva?.stages ?? []) {
      const lines = stage.find('.drawingLine');
      if (!lines.length) continue;
      const line = lines[lines.length - 1];
      const g = resolveDrawingNode(line);
      if (!g) continue;
      const rect = g.getClientRect({ relativeTo: stage });
      return {
        w: rect.width ?? 0,
        h: rect.height ?? 0,
        rot: g.rotation?.() ?? 0,
        hasLine: true,
      };
    }
    return { w: 0, h: 0, rot: 0, hasLine: false };
  });
}

async function resolveDrawingCenterFresh(page) {
  return page.evaluate(() => {
    const Konva = /** @type {any} */ (window).Konva;
    const resolveDrawingNode = (line) => {
      let node = line?.getParent?.();
      while (node && typeof node.id === 'function' && !node.id()) {
        node = node.getParent?.();
      }
      return node || line?.getParent?.() || null;
    };
    for (const stage of Konva?.stages ?? []) {
      const lines = stage.find('.drawingLine');
      if (!lines.length) continue;
      const g = resolveDrawingNode(lines[lines.length - 1]);
      if (!g) continue;
      const st = g.getStage();
      const container = st.container().getBoundingClientRect();
      const box = g.getClientRect({ relativeTo: st });
      return {
        x: container.left + box.x + box.width / 2,
        y: container.top + box.y + box.height / 2,
      };
    }
    return { x: 0, y: 0 };
  });
}

test.describe('Moodboard pen journey', () => {
  test('Journey 3: draw line, resize bigger, rotate, save and reload', async ({ page, browserName }) => {
    // Transformer pointer math is only reliable in Chromium; skip other browsers.
    test.skip(
      browserName !== 'chromium',
      'Konva Transformer pointer behavior is validated in Chromium only.'
    );
    test.setTimeout(60_000);
    const boardTitle = 'Journey 3 Pen Board';

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

    await test.step('Draw a simple pen line', async () => {
      await page.getByRole('button', { name: /^Board$/ }).click({ force: true });
      await page.locator('button[title="Add drawing"]').click({ force: true });
      const stage = page.locator('.konvajs-content').first();
      const box = await stage.boundingBox();
      expect(box).toBeTruthy();

      const start = { x: box.x + box.width * 0.2, y: box.y + box.height * 0.3 };
      const end = { x: box.x + box.width * 0.72, y: box.y + box.height * 0.62 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 34 });
      await page.mouse.up();
      await page.waitForTimeout(250);

      await expect
        .poll(async () => (await readDrawingMetricsFresh(page)).hasLine, {
          timeout: 10_000,
          message: 'Drawing line should exist on Konva stage',
        })
        .toBe(true);

      // Toggle draw mode off before transform interactions.
      await page.locator('button[title="Add drawing"]').click({ force: true });
    });

    const before = await readDrawingMetricsFresh(page);

    await test.step('Select drawing then resize bigger', async () => {
      const center = await resolveDrawingCenterFresh(page);
      await page.mouse.click(center.x, center.y);
      await waitForTransformerAttached(page);

      const topRight = await getTransformerAnchorClientPoint(page, 'top-right');
      expect(topRight).toBeTruthy();
      const dragTo = {
        x: topRight.x + 45,
        y: topRight.y - 45,
      };

      await page.mouse.move(topRight.x, topRight.y);
      await page.mouse.down();
      await page.mouse.move(dragTo.x, dragTo.y, { steps: 16 });
      await page.mouse.up();

      await expect
        .poll(async () => {
          const now = await readDrawingMetricsFresh(page);
          return now.w * now.h - before.w * before.h;
        }, { timeout: 10_000, message: 'Drawing area should increase after resize' })
        .toBeGreaterThan(5);
    });

    await test.step('Rotate drawing around using rotater handle', async () => {
      const center = await resolveDrawingCenterFresh(page);
      await page.mouse.click(center.x, center.y);
      await waitForTransformerAttached(page);

      const rotater = await getTransformerAnchorClientPoint(page, 'rotater');
      expect(rotater).toBeTruthy();

      const radius = Math.hypot(rotater.x - center.x, rotater.y - center.y) || 90;
      await page.mouse.move(rotater.x, rotater.y);
      await page.mouse.down();
      const steps = 16;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const angle = -Math.PI / 2 + (Math.PI / 3) * t;
        await page.mouse.move(
          center.x + radius * Math.cos(angle),
          center.y + radius * Math.sin(angle)
        );
      }
      await page.mouse.up();

      // Diagnostic dump: capture Konva Transformer and drawing group state.
      const diag = await page.evaluate(() => {
        const Konva = /** @type {any} */ (window).Konva;
        const stages = (Konva?.stages ?? []).map((st) => {
          const trs = st.find('Transformer').map((tr) => ({
            nodes: (tr.nodes?.() || []).map((n) => ({
              className: n.className && n.className(),
              name: n.name && n.name(),
              rotation: typeof n.rotation === 'function' ? n.rotation() : null,
            })),
            anchors: tr.find('.rotater') ? true : false,
          }));
          return {
            transformerCount: trs.length,
            transformers: trs,
          };
        });

        let drawingInfo = null;
        for (const st of Konva?.stages ?? []) {
          const lines = st.find('.drawingLine');
          if (!lines.length) continue;
          const line = lines[lines.length - 1];
          const g = line.getParent();
          drawingInfo = {
            groupRotation: typeof g.rotation === 'function' ? g.rotation() : null,
            groupScaleX: typeof g.scaleX === 'function' ? g.scaleX() : null,
            groupScaleY: typeof g.scaleY === 'function' ? g.scaleY() : null,
            parentClass: g.getParent()?.className && g.getParent().className(),
          };
          break;
        }

        return { stages, drawingInfo };
      });

      // eslint-disable-next-line no-console
      console.log('ROTATE-DIAG', JSON.stringify(diag));

      await expect
        .poll(async () => Math.abs((await readDrawingMetricsFresh(page)).rot), {
          timeout: 10_000,
          message: 'Drawing rotation should change after rotate gesture',
        })
        .toBeGreaterThan(1);
    });

    await test.step('Save and reload verify persisted transformed drawing', async () => {
      await page.click('button[title="Save"]');
      await page.locator('.ant-modal').getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Moodboard saved.')).toBeVisible();

      const parsed = JSON.parse(mockBoardState.scene);
      const drawingItem = parsed.items?.find((it) => it.kind === 'drawing');
      expect(drawingItem).toBeTruthy();
      expect((drawingItem.w ?? 0) > before.w || (drawingItem.h ?? 0) > before.h).toBe(true);
      expect(Math.abs(drawingItem.rot ?? 0)).toBeGreaterThan(1);

      await page.reload();
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('input[aria-label="Project name"]')).toHaveValue(boardTitle);

      await expect
        .poll(async () => {
          const m = await readDrawingMetricsFresh(page);
          return { hasLine: m.hasLine, rot: Math.abs(m.rot) };
        }, { timeout: 12_000 })
        .toMatchObject({ hasLine: true });
    });
  });
});

