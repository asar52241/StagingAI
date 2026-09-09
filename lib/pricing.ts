import { LEGAL } from "@/config/legal";

// Existing advertised packages; use one calculation for the quote and the charge.
const PACKAGES = [{ count: 10, price: 450 }, { count: 15, price: 700 }, { count: 20, price: 950 }, { count: 30, price: 1400 }];

export function getOrderPrice(count: number): number {
  if (!Number.isInteger(count) || count < LEGAL.minPhotosPerOrder || count > LEGAL.maxPhotosPerOrder) {
    throw new Error("Invalid photo count");
  }
  const prices = new Array<number>(count + 1).fill(Infinity);
  prices[0] = 0;
  for (let size = 1; size <= count; size++) {
    prices[size] = prices[size - 1] + LEGAL.pricePerPhoto;
    for (const pack of PACKAGES) {
      if (size >= pack.count) prices[size] = Math.min(prices[size], prices[size - pack.count] + pack.price);
    }
  }
  return prices[count];
}
