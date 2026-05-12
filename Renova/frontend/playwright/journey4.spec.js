// @ts-nocheck
import { test, expect } from '@playwright/test';

const mockJwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTksInJvbGUiOiJVU0VSIiwic3ViIjoidGVzdEBleGFtcGxlLmNvbSJ9.mock-signature';
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const targetHex = '#2a7284';

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

async function readStageBackgroundFill(page) {
  return page.evaluate(() => {
    const Konva = /** @type {any} */ (window).Konva;
    for (const stage of Konva?.stages ?? []) {
      const baseRect = stage.find('Rect')[0];
      if (!baseRect) continue;
      return String(baseRect.fill?.() ?? '');
    }
    return '';
  });
}

test.describe('Moodboard background journey', () => {
  test('Journey 4: set background by hex, done, save, reload, verify', async ({ page }) => {
    test.setTimeout(60_000);
    const boardTitle = 'Journey 4 Background Board';

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
              const bg = extractMultipartField(raw, 'background');
              const title = extractMultipartField(raw, 'title');
              const scene = extractMultipartField(raw, 'scene');
              if (bg) mockBoardState = { ...mockBoardState, background: bg };
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

    await test.step('Login and open board', async () => {
      await page.goto(`${baseUrl}/auth?mode=login`);
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'password123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
      await page.goto(`${baseUrl}/dashboard/moodboards/mock-board-id`);
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });
    });

    await test.step('Open background editor and set hex', async () => {
      await page.getByRole('button', { name: /^Board$/ }).click({ force: true });
      await page.getByRole('button', { name: /^Background$/ }).click({ force: true });
      await expect(page.getByRole('button', { name: /^Done$/ })).toBeVisible();
      await page.locator('input[type="text"][maxlength="7"]').first().fill(targetHex);
      await page.getByRole('button', { name: /^Done$/ }).click();
      await expect
        .poll(async () => (await readStageBackgroundFill(page)).toLowerCase(), {
          timeout: 8_000,
          message: 'Background fill should update after clicking Done',
        })
        .toContain('2a7284');
    });

    await test.step('Save and verify API state carries background', async () => {
      await page.click('button[title="Save"]');
      await page.locator('.ant-modal').getByRole('button', { name: /Save/i }).click();
      await expect(page.getByText('Moodboard saved.')).toBeVisible();
      expect(mockBoardState.background.toLowerCase()).toBe(targetHex);
    });

    await test.step('Reload and verify background persisted', async () => {
      await page.reload();
      await expect(page.locator('.konvajs-content').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('input[aria-label="Project name"]')).toHaveValue(boardTitle);

      await expect
        .poll(async () => (await readStageBackgroundFill(page)).toLowerCase(), {
          timeout: 10_000,
          message: 'Stage background fill should reflect saved hex',
        })
        .toContain('2a7284');
    });
  });
});

