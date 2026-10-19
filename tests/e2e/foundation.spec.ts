import { expect, test } from '@playwright/test';

test('ממשק עברי מקבל מוכנות אמיתית מהשרת ומבסיס הנתונים', async ({
  page,
  request,
}) => {
  await expect
    .poll(async () =>
      (await request.get('http://127.0.0.1:3001/api/v1/health/ready')).status(),
    )
    .toBe(200);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'השרת ובסיס הנתונים זמינים לפיתוח',
  );
  await page.getByRole('button', { name: 'בדיקה חוזרת' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'השרת ובסיס הנתונים זמינים לפיתוח',
  );
});

test('כשל שירות מוצג ואפשר להתאושש ממנו', async ({ page }) => {
  await page.route('**/api/v1/health/ready', (route) =>
    route.fulfill({ status: 503, json: { status: 'not_ready' } }),
  );
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('החיבור אינו זמין');
  await page.unroute('**/api/v1/health/ready');
  await page.getByRole('button', { name: 'בדיקה חוזרת' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'השרת ובסיס הנתונים זמינים לפיתוח',
  );
});

test('מסך צר אינו גולש אופקית וקישור הדילוג נגיש במקלדת', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'מעבר לתוכן' })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('בקשה שנתקעה מסתיימת בהודעת כשל ואינה משאירה טעינה קבועה', async ({
  page,
}) => {
  await page.route('**/api/v1/health/ready', () => {});
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('החיבור אינו זמין', {
    timeout: 8_000,
  });
  await expect(page.getByRole('button', { name: 'בדיקה חוזרת' })).toBeEnabled();
});

test('השרת אינו חושף נתיב לקוחות לפני מימוש אימות והרשאות', async ({
  request,
}) => {
  const response = await request.get('http://127.0.0.1:3001/api/v1/customers');
  expect(response.status()).toBe(404);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
});
