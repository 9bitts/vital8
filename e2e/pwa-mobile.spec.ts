import { test, expect } from "@playwright/test";

const PASSWORD = "Vital8@dev";

async function loginMobile(page: import("@playwright/test").Page, email: string) {
  await page.goto("/entrar");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app/);
}

test.describe("PWA Mobile — Fase 14", () => {
  test("manifest e rota /m/hoje acessíveis", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Apenas projeto mobile");

    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBeTruthy();
    const body = await manifest.json();
    expect(body.display).toBe("standalone");
    expect(body.shortcuts?.length).toBeGreaterThanOrEqual(3);

    await loginMobile(page, "ana@vidaplena.local");
    await page.goto("/m/hoje");
    await expect(page.getByText(/Fila agora|Nenhum paciente/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Hoje" })).toBeVisible();
  });

  test("modo offline exibe banner e bloqueia prontuário mobile", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Apenas projeto mobile");

    await loginMobile(page, "ana@vidaplena.local");
    await page.goto("/m/hoje");
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(/offline|cache offline/i)).toBeVisible({ timeout: 10000 });

    await page.goto("/m/atendimento/fake-id");
    await expect(page.getByText(/indisponível offline|Conteúdo clínico/i)).toBeVisible();
    await context.setOffline(false);
  });

  test("API mobile sync exige autenticação", async ({ request }) => {
    const res = await request.get("/api/mobile/sync/appointments");
    expect(res.status()).toBe(401);
  });

  test("cache-key retorna material após login", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Apenas projeto mobile");

    await loginMobile(page, "ana@vidaplena.local");
    const cookies = await page.context().cookies();
    const res = await request.get("/api/mobile/cache-key", {
      headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.data.keyMaterial).toBeTruthy();
  });
});
