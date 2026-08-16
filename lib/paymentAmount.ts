import { LEGAL } from "@/config/legal";

const MAX_AMOUNT_CENTS = LEGAL.maxPhotosPerOrder * LEGAL.pricePerPhoto * 100;

/** Converts a decimal amount to integer kopecks without floating-point rounding. */
export function parseAmountCents(value: string): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;

  const [wholePart, fractionPart = ""] = value.split(".");
  // Robokassa can return trailing zeroes beyond the two fractional digits.
  if (fractionPart.length > 2 && !/^0+$/.test(fractionPart.slice(2))) return null;
  const fraction = `${fractionPart.slice(0, 2)}00`.slice(0, 2);
  const cents = Number(wholePart) * 100 + Number(fraction);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

export function photoCountFromAmount(value: string): number | null {
  const cents = parseAmountCents(value);
  const priceCents = LEGAL.pricePerPhoto * 100;
  if (cents === null || cents % priceCents !== 0) return null;

  const count = cents / priceCents;
  if (!Number.isInteger(count) || count < LEGAL.minPhotosPerOrder || count > LEGAL.maxPhotosPerOrder) {
    return null;
  }
  return count;
}

export function isValidPhotoCount(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= LEGAL.minPhotosPerOrder &&
    value <= LEGAL.maxPhotosPerOrder;
}

export function amountCentsForPhotoCount(count: number): number {
  return count * LEGAL.pricePerPhoto * 100;
}

export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
