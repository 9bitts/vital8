import { test, expect } from "@playwright/test";

const PASSWORD = "Vital8@dev";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/entrar");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app/);
}

test.describe("Login lockout", () => {
  test("bloqueia após 10 tentativas com senha errada", async ({ page }) => {
    const email = `lockout-${Date.now()}@test.local`;
    for (let i = 0; i < 10; i++) {
      await page.goto("/entrar");
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', "senha-errada-123");
      await page.click('button[type="submit"]');
    }
    await page.goto("/entrar");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "senha-errada-123");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Muitas tentativas/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Isolamento multi-unidade", () => {
  test("usuário com unidade selecionada não vê appointment de outra unidade", async ({
    page,
  }) => {
    await login(page, "ana@vidaplena.local");
    await page.goto("/app/agenda");

    const branchSwitcher = page.getByRole("combobox").or(page.getByLabel(/unidade/i));
    if (await branchSwitcher.count()) {
      await branchSwitcher.first().click();
      const norte = page.getByText("Unidade Norte");
      if (await norte.count()) {
        await norte.click();
      }
    }

    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Sala Norte 1/i);
  });
});
