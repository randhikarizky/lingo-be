type RetryJob = {
  provider: string;
  payload: Record<string, unknown>;
  attempts: number;
  queuedAt: string;
};

const queue: RetryJob[] = [];

export class BillingRetryQueue {
  enqueue(provider: string, payload: Record<string, unknown>) {
    const job: RetryJob = {
      provider,
      payload,
      attempts: 0,
      queuedAt: new Date().toISOString(),
    };

    queue.push(job);
    console.info("[billing-retry] queued webhook retry", {
      provider,
      queueSize: queue.length,
    });
  }

  peek() {
    return queue[0] ?? null;
  }

  size() {
    return queue.length;
  }
}

export const billingRetryQueue = new BillingRetryQueue();
