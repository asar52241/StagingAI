import { expect, test, type Page } from "@playwright/test";

const pendingPayment = { invId: 123, outSum: "50.00" };

async function savePendingPayment(page: Page) {
  await page.addInitScript((payment) => {
    localStorage.setItem("stagingai_pending", JSON.stringify(payment));
  }, pendingPayment);
}

async function expectUsableLanding(page: Page) {
  await page.locator('input[type="number"]').fill("10");
  await expect(page.getByText("450 ₽", { exact: true })).toBeVisible();
  // Wait for any asynchronous redirect; hydration alone can finish before navigation.
  await expect(page.waitForURL(/\/studio(?:[?#]|$)/, { timeout: 1500 })).rejects.toThrow(/Timeout/);
  await expect(page.getByText(/Оплата ещё не подтверждена/)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
    return route.abort();
  });
});

for (const path of ["/", "/?utm_source=yandex&yclid=123#pricing"]) {
  test(`pending checkout does not redirect landing ${path}`, async ({ page }) => {
    await savePendingPayment(page);
    let statusRequests = 0;
    await page.route("**/api/payment/status?**", (route) => {
      statusRequests++;
      return route.fulfill({ status: 403, json: { paid: false } });
    });

    await page.goto(path);
    await expectUsableLanding(page);
    await expect(page).toHaveURL(`http://127.0.0.1:3310${path}`);
    expect(statusRequests).toBe(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("stagingai_pending")!))).toEqual(pendingPayment);
  });
}

test("back to landing works after an unconfirmed payment", async ({ page }) => {
  await savePendingPayment(page);
  await page.route("**/api/payment/status?**", (route) => route.fulfill({ status: 403, json: { paid: false } }));
  await page.goto("/studio?paid=true");
  await expect(page.getByText(/Оплата ещё не подтверждена/)).toBeVisible();

  await page.getByRole("link", { name: "← На лендинг" }).click();
  await expectUsableLanding(page);
  await expect(page).toHaveURL("http://127.0.0.1:3310/");
  await page.reload();
  await expectUsableLanding(page);
  await expect(page).toHaveURL("http://127.0.0.1:3310/");
});

for (const hasPendingPayment of [true, false]) {
  test(`payment return on landing preserves verification parameters (pending: ${hasPendingPayment})`, async ({ page }) => {
    if (hasPendingPayment) await savePendingPayment(page);
    const queries: URLSearchParams[] = [];
    await page.route("**/api/payment/status?**", (route) => {
      queries.push(new URL(route.request().url()).searchParams);
      return route.fulfill({ json: { paid: true, count: 1 } });
    });

    // Legacy merchant return URLs can point at / without the paid=true marker.
    await page.goto("/?InvId=456&OutSum=50.000000&SignatureValue=test-signature");
    await expect(page.getByText(/Фотографии не найдены в браузере/)).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:3310/studio");
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      expect(Object.fromEntries(query)).toEqual({ invId: "456", outSum: "50.000000", sig: "test-signature" });
    }
  });
}

test("cancelled payment return on landing stays cancelled", async ({ page }) => {
  await savePendingPayment(page);
  let statusRequests = 0;
  await page.route("**/api/payment/status?**", (route) => {
    statusRequests++;
    return route.fulfill({ json: { paid: false } });
  });

  await page.goto("/?paid=false");
  await expect(page.getByText("Оплата отменена или не прошла. Попробуйте ещё раз.")).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3310/studio");
  expect(statusRequests).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("stagingai_pending"))).toBeNull();
});
