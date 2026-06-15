import type { Page } from '@playwright/test';

/** Shared inbox API stubs used across Playwright specs (pins, saved views, thread events, etc.). */
export async function installInboxApiStubs(page: Page): Promise<void> {
  await page.route('**/api/inbox/pins**', async route => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }
    if (method === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pinned: true, pins: [] }),
      });
      return;
    }
    if (method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/inbox/saved-views**', async route => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as { name?: string; config?: Record<string, unknown> };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'saved-view-1',
          name: body.name ?? 'Saved',
          config: body.config ?? { filter: 'all' },
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      return;
    }
    if (method === 'DELETE' && url.includes('/saved-views/')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/inbox/threads/events**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}
