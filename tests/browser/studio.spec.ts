import { expect, test, type Page } from "@playwright/test";

async function images(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8; canvas.height = 8;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fedcba"; ctx.fillRect(0, 0, 8, 8);
    return { png: canvas.toDataURL("image/png").split(",")[1], webp: canvas.toDataURL("image/webp").split(",")[1] };
  });
  return [
    { name: "room.png", mimeType: "image/png", buffer: Buffer.from(data.png, "base64") },
    { name: "room.webp", mimeType: "image/webp", buffer: Buffer.from(data.webp, "base64") },
    { name: "room.gif", mimeType: "image/gif", buffer: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64") },
  ];
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname === "127.0.0.1") return route.continue();
    return route.abort();
  });
});

test("WebP/GIF normalize, checkout restores, and failed photos retry without rerunning completed photos", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/studio");
  const files = await images(page);
  let calls = 0;
  await page.route("**/api/payment/create", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ photoCount: 3 });
    await route.fulfill({ json: { invId: 123, outSum: 150, paymentUrl: "http://127.0.0.1:3310/studio?paid=true&InvId=123&OutSum=150.00&SignatureValue=test" } });
  });
  await page.route("**/api/payment/status?**", (route) => route.fulfill({ json: { paid: true, count: 3 } }));
  await page.route("**/api/declutter", async (route) => {
    calls++;
    const multipart = route.request().postDataBuffer()!.toString("latin1");
    expect(multipart).toContain("Content-Type: image/png");
    expect(multipart).not.toContain("Content-Type: image/webp");
    expect(multipart).not.toContain("Content-Type: image/gif");
    if (calls === 1) return route.fulfill({ status: 502, json: { error: { message: "Test provider failure" } } });
    await route.fulfill({ contentType: "image/png", body: files[0].buffer });
  });
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await expect(page.getByRole("button", { name: "Оплатить 150 ₽ и запустить" })).toBeEnabled();
  await page.getByRole("button", { name: "Оплатить 150 ₽ и запустить" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Подтвердить/ }).click();
  await expect(page.getByRole("button", { name: "↓ Скачать", disabled: false })).toHaveCount(2);
  await expect.poll(() => calls).toBe(3);
  await page.reload();
  await expect(page.getByRole("button", { name: "↓ Скачать", disabled: false })).toHaveCount(2);
  expect(calls).toBe(3);
  await page.getByRole("button", { name: "↺ Переделать" }).first().click();
  await expect(page.getByRole("button", { name: "↓ Скачать", disabled: false })).toHaveCount(3);
  expect(calls).toBe(4);
  await page.reload();
  await expect(page.getByRole("button", { name: "↓ Скачать", disabled: false })).toHaveCount(3);
  expect(calls).toBe(4);
  await page.getByRole("button", { name: "Новый заказ" }).click();
  await expect(page.getByRole("button", { name: "↓ Скачать" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("cancelled checkout without InvId restores uploaded photos", async ({ page }) => {
  await page.goto("/studio");
  const files = await images(page);
  await page.route("**/api/payment/create", (route) => route.fulfill({ json: {
    invId: 124, outSum: 150, paymentUrl: "http://127.0.0.1:3310/studio?paid=false",
  } }));
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await page.getByRole("button", { name: "Оплатить 150 ₽ и запустить" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Подтвердить/ }).click();
  await expect(page.getByText("Оплата отменена или не прошла. Попробуйте ещё раз.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Оплатить 150 ₽ и запустить" })).toBeEnabled();
});

test("advertised package price matches studio checkout total", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="number"]').fill("10");
  await expect(page.getByText("450 ₽", { exact: true })).toBeVisible();
  await page.goto("/studio");
  const [file] = await images(page);
  await page.locator('input[type="file"]').first().setInputFiles(Array.from({ length: 10 }, (_, index) => ({ ...file, name: `${index}.png` })));
  await expect(page.getByRole("button", { name: "Оплатить 450 ₽ и запустить" })).toBeEnabled();
});

test("mask history restores alpha exactly across undo and redo", async ({ page }) => {
  await page.goto("/studio");
  const [file] = await images(page);
  await page.locator('input[type="file"]').first().setInputFiles([file]);
  await page.getByText("Удалить вручную (кисть)", { exact: true }).click();
  const preview = page.getByLabel("Mask preview layer");
  await expect(preview).toBeVisible();
  const mask = page.locator('canvas[aria-hidden="true"]');
  const snapshot = () => mask.evaluate((element: HTMLCanvasElement) => Array.from(element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data));
  const initial = await snapshot();
  expect(initial.every((value) => value === 255)).toBe(true);
  const box = (await preview.boundingBox())!;
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 2 / 3, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const edited = await snapshot();
  expect(edited.filter((_, index) => index % 4 === 3).some((alpha) => alpha < 255)).toBe(true);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  expect(await snapshot()).toEqual(initial);
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  const restored = await snapshot();
  expect(restored.filter((_, index) => index % 4 === 3)).toEqual(edited.filter((_, index) => index % 4 === 3));
});

test("paid order with missing browser photos can save replacements and recover results", async ({ page }) => {
  await page.route("**/api/payment/status?**", (route) => route.fulfill({ json: { paid: true, count: 3 } }));
  await page.goto("/studio?paid=true&InvId=125");
  await expect(page.getByText(/Фотографии не найдены в браузере/)).toBeVisible();
  const files = await images(page);
  let calls = 0;
  await page.route("**/api/declutter", (route) => {
    calls++;
    return route.fulfill({ contentType: "image/png", body: files[0].buffer });
  });
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await page.getByRole("button", { name: "Запустить обработку" }).click();
  await expect(page.getByRole("button", { name: "↓ Скачать", disabled: false })).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole("button", { name: "↓ Скачать", disabled: false })).toHaveCount(3);
  expect(calls).toBe(3);
});
