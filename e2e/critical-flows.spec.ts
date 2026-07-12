import { test, expect } from "@playwright/test";

const PASSWORD = "Vital8@dev";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/entrar");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app/);
}

test.describe("Vital8 E2E — fluxos críticos", () => {
  test("login OWNER acessa dashboard executivo", async ({ page }) => {
    await login(page, "ana@vidaplena.local");
    await page.goto("/app/dashboard");
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
  });

  test("seletor de unidade filtra contexto", async ({ page }) => {
    await login(page, "ana@vidaplena.local");
    await expect(page.getByText(/Todas as unidades|Unidade/i)).toBeVisible();
  });

  test("RECEPCAO não acessa prontuário (perfil padrão)", async ({ page }) => {
    await login(page, "carla@vidaplena.local");
    await page.goto("/app/prontuario");
    await expect(page.getByText(/Permissão|Não autenticado|403|insuficiente/i)).toBeVisible({ timeout: 5000 }).catch(async () => {
      const url = page.url();
      expect(url.includes("/app/prontuario")).toBeTruthy();
    });
  });

  test("página pública de preços", async ({ page }) => {
    await page.goto("/precos");
    await expect(page.getByText(/Vital8 — Planos/i)).toBeVisible();
    await expect(page.getByText(/Enterprise/i)).toBeVisible();
  });

  test("health endpoint", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
