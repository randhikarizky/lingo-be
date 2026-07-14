import crypto from "crypto";

export type DuitkuConfig = {
  merchantCode: string;
  apiKey: string;
  callbackUrl: string;
  returnUrl: string;
  environment: "sandbox" | "production";
};

export function getDuitkuConfig(): DuitkuConfig | null {
  const merchantCode = process.env.DUITKU_MERCHANT_CODE?.trim();
  const apiKey = process.env.DUITKU_API_KEY?.trim();

  if (!merchantCode || !apiKey) {
    return null;
  }

  const environment =
    process.env.DUITKU_ENV?.trim() === "production" ? "production" : "sandbox";

  return {
    merchantCode,
    apiKey,
    callbackUrl:
      process.env.DUITKU_CALLBACK_URL?.trim() ||
      `${process.env.APP_BASE_URL?.trim() || "http://localhost:4626"}/api/v1/billing/webhook/duitku`,
    returnUrl:
      process.env.DUITKU_RETURN_URL?.trim() ||
      `${process.env.FRONTEND_BASE_URL?.trim() || "http://localhost:3626"}/pricing/payment/return`,
    environment,
  };
}

export function getDuitkuBaseUrl(environment: DuitkuConfig["environment"]) {
  return environment === "production"
    ? "https://passport.duitku.com/webapi"
    : "https://sandbox.duitku.com/webapi";
}

export function createDuitkuSignature(
  stringToSign: string,
  apiKey: string,
): string {
  return crypto.createHmac("sha256", apiKey).update(stringToSign).digest("hex");
}

export function verifyDuitkuWebhookSignature(input: {
  merchantCode: string;
  amount: string | number;
  merchantOrderId: string;
  signature: string;
  apiKey: string;
}) {
  const amount = String(input.amount);
  const stringToSign = `${input.merchantCode}${amount}${input.merchantOrderId}`;
  const expected = createDuitkuSignature(stringToSign, input.apiKey);

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(input.signature, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export type DuitkuPaymentMethod = {
  paymentMethod: string;
  paymentName: string;
  paymentImage?: string;
  totalFee?: string;
};

export type DuitkuInquiryResponse = {
  merchantCode?: string;
  reference?: string;
  paymentUrl?: string;
  vaNumber?: string;
  amount?: number;
  statusCode?: string;
  statusMessage?: string;
};

export class DuitkuClient {
  constructor(private readonly config: DuitkuConfig) {}

  private get apiBase() {
    return getDuitkuBaseUrl(this.config.environment);
  }

  private formatDatetime(date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  async getPaymentMethods(amount: number): Promise<DuitkuPaymentMethod[]> {
    const datetime = this.formatDatetime();
    const signature = createDuitkuSignature(
      `${this.config.merchantCode}${amount}${datetime}`,
      this.config.apiKey,
    );

    const response = await fetch(
      `${this.apiBase}/api/merchant/paymentmethod/getpaymentmethod`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantcode: this.config.merchantCode,
          amount,
          datetime,
          signature,
        }),
      },
    );

    const data = (await response.json()) as {
      paymentFee?: DuitkuPaymentMethod[];
      responseCode?: string;
      responseMessage?: string;
    };

    if (!response.ok || data.responseCode !== "00") {
      throw new Error(
        data.responseMessage || "Gagal memuat metode pembayaran Duitku",
      );
    }

    return data.paymentFee ?? [];
  }

  async createInquiry(input: {
    merchantOrderId: string;
    paymentAmount: number;
    productDetails: string;
    email: string;
    customerVaName: string;
    paymentMethod?: string;
    expiryPeriodMinutes?: number;
  }): Promise<DuitkuInquiryResponse> {
    const signature = createDuitkuSignature(
      `${this.config.merchantCode}${input.merchantOrderId}${input.paymentAmount}`,
      this.config.apiKey,
    );

    const response = await fetch(`${this.apiBase}/api/merchant/v2/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantCode: this.config.merchantCode,
        paymentAmount: input.paymentAmount,
        paymentMethod: input.paymentMethod ?? "",
        merchantOrderId: input.merchantOrderId,
        productDetails: input.productDetails,
        email: input.email,
        customerVaName: input.customerVaName,
        callbackUrl: this.config.callbackUrl,
        returnUrl: this.config.returnUrl,
        signature,
        expiryPeriod: input.expiryPeriodMinutes ?? 60,
      }),
    });

    const data = (await response.json()) as DuitkuInquiryResponse;

    if (!response.ok || !data.paymentUrl) {
      throw new Error(
        data.statusMessage || "Gagal membuat transaksi pembayaran Duitku",
      );
    }

    return data;
  }

  async checkTransaction(merchantOrderId: string) {
    const signature = createDuitkuSignature(
      `${this.config.merchantCode}${merchantOrderId}`,
      this.config.apiKey,
    );

    const response = await fetch(
      `${this.apiBase}/api/merchant/transactionStatus`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantCode: this.config.merchantCode,
          merchantOrderId,
          signature,
        }),
      },
    );

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<{
      resultCode?: string;
      statusCode?: string;
      reference?: string;
      paymentMethod?: string;
    }>;
  }
}
