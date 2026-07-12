import type { BillingProduct, BillingProductId } from "../types/billing.types";

const MONTHLY_BASE_PRICE = 139_000;
const MULTI_MONTH_DISCOUNT_PERCENT = 10;

function buildProduct(
  id: BillingProductId,
  durationMonths: number,
  durationLabel: string,
): BillingProduct {
  const listPrice = MONTHLY_BASE_PRICE * durationMonths;
  const discountPercent =
    durationMonths > 1 ? MULTI_MONTH_DISCOUNT_PERCENT : 0;
  const finalPrice = Math.round(listPrice * (1 - discountPercent / 100));

  return {
    id,
    planId: "PRO",
    label: "Lingora Pro",
    durationMonths,
    durationLabel,
    listPrice,
    finalPrice,
    discountPercent,
    currency: "IDR",
  };
}

export const BILLING_CATALOG: Record<BillingProductId, BillingProduct> = {
  "pro-1m": buildProduct("pro-1m", 1, "1 Bulan"),
  "pro-3m": buildProduct("pro-3m", 3, "3 Bulan"),
  "pro-6m": buildProduct("pro-6m", 6, "6 Bulan"),
  "pro-12m": buildProduct("pro-12m", 12, "1 Tahun"),
  "pro-24m": buildProduct("pro-24m", 24, "2 Tahun"),
};

export const BILLING_PRODUCT_ORDER: BillingProductId[] = [
  "pro-1m",
  "pro-3m",
  "pro-6m",
  "pro-12m",
  "pro-24m",
];

export function getBillingProduct(productId: BillingProductId): BillingProduct {
  const product = BILLING_CATALOG[productId];
  if (!product) {
    throw new Error("Paket pembayaran tidak valid");
  }
  return product;
}

export function listBillingProducts() {
  return BILLING_PRODUCT_ORDER.map((id) => {
    const product = BILLING_CATALOG[id];
    return {
      id: product.id,
      planId: product.planId,
      label: product.label,
      durationMonths: product.durationMonths,
      durationLabel: product.durationLabel,
      listPrice: product.listPrice,
      finalPrice: product.finalPrice,
      discountPercent: product.discountPercent,
      currency: product.currency,
      priceLabel: formatIdr(product.finalPrice),
      listPriceLabel: formatIdr(product.listPrice),
      savingsLabel:
        product.discountPercent > 0
          ? `Hemat ${product.discountPercent}% vs ${formatIdr(product.listPrice)}`
          : null,
    };
  });
}

export function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
