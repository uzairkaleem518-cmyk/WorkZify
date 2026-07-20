import { expect, test } from "@playwright/test";
import {
  mockAdminDashboardData,
  mockAdminLogin,
  mockCategories,
  mockOtpSend,
  mockWorkerLogin,
  mockWorkerProfileMe,
  mockWorkerSearch,
} from "./mocks.js";

test.describe("Home search", () => {
  test("loads, shows results, and re-searches when a filter is applied", async ({ page }) => {
    await mockCategories(page);
    await mockWorkerSearch(page);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: /find trusted professionals/i })).toBeVisible();
    await expect(page.getByText("Ali Raza")).toBeVisible();

    // Re-searching should hit the API again with the typed query.
    const searchRequest = page.waitForRequest((req) => req.url().includes("/api/workers?") && req.url().includes("q=Ali"));
    await page.getByPlaceholder("Search worker by name...").fill("Ali");
    await page.getByRole("button", { name: "Search" }).click();
    await searchRequest;
  });

  test("shows an empty state when no workers match", async ({ page }) => {
    await mockCategories(page);
    await mockWorkerSearch(page, { workers: [], pagination: { page: 1, hasMore: false } });

    await page.goto("/");

    await expect(page.getByText("No workers found. Try a different search.")).toBeVisible();
  });
});

test.describe("Worker registration screens", () => {
  test("step 1 collects contact info and OTP, then advances to step 2", async ({ page }) => {
    await mockCategories(page);
    await mockOtpSend(page, { devCode: "123456" });

    await page.goto("/worker/register");
    await expect(page.getByText("Step 1 of 2")).toBeVisible();

    await page.getByPlaceholder("Full name").fill("Bilal Ahmed");
    await page.getByPlaceholder("Phone number").fill("03001234567");
    await page.getByPlaceholder("Email (for free OTP delivery)").fill("bilal@example.com");
    await page.getByRole("button", { name: "Send OTP" }).click();

    await expect(page.getByText(/OTP sent/i)).toBeVisible();
    await page.getByPlaceholder("6-digit OTP").fill("123456");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    await expect(page.getByPlaceholder("Choose a password")).toBeVisible();
    // CNIC/selfie uploads are exercised directly by the backend upload tests;
    // this screen-level smoke test confirms step 2 itself renders correctly.
  });

  test("blocks Send OTP when phone/email are invalid", async ({ page }) => {
    await mockCategories(page);

    await page.goto("/worker/register");
    await page.getByPlaceholder("Full name").fill("Bilal Ahmed");
    await page.getByPlaceholder("Phone number").fill("123"); // too short to be valid
    await page.getByRole("button", { name: "Send OTP" }).click();

    await expect(page.getByText(/fix the highlighted fields/i)).toBeVisible();
    await expect(page.getByText("Step 1 of 2")).toBeVisible(); // did not advance
  });
});

test.describe("Worker dashboard navigation", () => {
  test("logging in takes the worker to their dashboard with profile data", async ({ page }) => {
    await mockWorkerLogin(page);
    await mockWorkerProfileMe(page);

    await page.goto("/worker/login");
    await page.getByPlaceholder("Phone number").fill("03001234567");
    await page.getByPlaceholder("Password").fill("Password123");
    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page).toHaveURL(/\/worker\/dashboard/);
    await expect(page.getByRole("heading", { name: "My Dashboard" })).toBeVisible();
    await expect(page.getByText("Ali Raza")).toBeVisible();
    await expect(page.getByText("Approved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Profile" })).toBeVisible();
  });

  test("a visitor without a session is redirected away from the dashboard", async ({ page }) => {
    await page.goto("/worker/dashboard");
    await expect(page).toHaveURL(/\/worker\/login/);
  });

  test("shows the login error message on wrong credentials without navigating away", async ({ page }) => {
    await mockWorkerLogin(page, { status: 401 });

    await page.goto("/worker/login");
    await page.getByPlaceholder("Phone number").fill("03001234567");
    await page.getByPlaceholder("Password").fill("WrongPassword");
    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page.getByText("Invalid phone or password")).toBeVisible();
    await expect(page).toHaveURL(/\/worker\/login/);
  });
});

test.describe("Admin login", () => {
  test("logs in and reaches the admin dashboard route", async ({ page }) => {
    await mockAdminLogin(page);
    await mockAdminDashboardData(page);

    await page.goto("/admin/login");
    await page.getByPlaceholder("Admin email").fill("admin@workzify.com");
    await page.getByPlaceholder("Password").fill("AdminPass123");
    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test("shows an error and stays on the page with wrong credentials", async ({ page }) => {
    await mockAdminLogin(page, { status: 401 });

    await page.goto("/admin/login");
    await page.getByPlaceholder("Admin email").fill("admin@workzify.com");
    await page.getByPlaceholder("Password").fill("WrongPass");
    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
