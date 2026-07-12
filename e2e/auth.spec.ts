import { test, expect } from "@playwright/test";

test.describe("login credentials", () => {
  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill("nao-existe@vital8.test");
    await page.getByLabel("Senha").fill("SenhaInvalida1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
  });
});

test.describe("doctor8 SSO errors", () => {
  test("maps Doctor8SemConta error code", async ({ page }) => {
    await page.goto("/entrar?error=Doctor8SemConta");
    await expect(page.getByText(/não está cadastrado no vital8/i)).toBeVisible();
  });

  test("maps Doctor8CnpjDivergente error code", async ({ page }) => {
    await page.goto("/entrar?error=Doctor8CnpjDivergente");
    await expect(page.getByText(/CNPJ.*Doctor8.*não confere/i)).toBeVisible();
  });

  test("maps Doctor8OrganizacaoInativa error code", async ({ page }) => {
    await page.goto("/entrar?error=Doctor8OrganizacaoInativa");
    await expect(page.getByText(/aguarda aprovação|suspensa/i)).toBeVisible();
  });
});
