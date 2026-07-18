import { expect, test } from "@playwright/test";

test.describe("Agent Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays an agent button", async ({ page }) => {
    const agentButton = page.getByTestId("agent-selector");
    await expect(agentButton).toBeVisible();
  });

  test("opens agent selector popover on click", async ({ page }) => {
    const agentButton = page.getByTestId("agent-selector");
    await agentButton.click();

    await expect(page.getByPlaceholder("Search agents...")).toBeVisible();
  });

  test("can search for agents", async ({ page }) => {
    const agentButton = page.getByTestId("agent-selector");
    await agentButton.click();

    const searchInput = page.getByPlaceholder("Search agents...");
    await searchInput.fill("Aselsan");

    await expect(page.getByRole("option", { name: /Aselsan/ })).toBeVisible();
  });

  test("can close agent selector by clicking outside", async ({ page }) => {
    const agentButton = page.getByTestId("agent-selector");
    await agentButton.click();

    await expect(page.getByPlaceholder("Search agents...")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByPlaceholder("Search agents...")).not.toBeVisible();
  });

  test("shows available agents", async ({ page }) => {
    const agentButton = page.getByTestId("agent-selector");
    await agentButton.click();

    const availableAgents = page.getByRole("group", { name: "Agents" });
    await expect(availableAgents).toBeVisible();
    await expect(
      availableAgents.getByRole("option", { name: /Aselsan/ })
    ).toBeVisible();
  });

  test("can select an agent", async ({ page }) => {
    const agentButton = page.getByTestId("agent-selector");
    await agentButton.click();

    await page.getByRole("option", { name: /Aselsan/ }).click();

    await expect(page.getByPlaceholder("Search agents...")).not.toBeVisible();
    await expect(agentButton).toContainText("Aselsan");
  });
});
