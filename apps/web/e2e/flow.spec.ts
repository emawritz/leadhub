import { test, expect } from '@playwright/test';

test('login, filtra y exporta', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('demo@leadhub.com');
  await page.getByPlaceholder('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText(/resultados/)).toBeVisible();
  await page.getByLabel('con email').check();
  await expect(page).toHaveURL(/hasEmail=true/);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('leads.csv');
});
