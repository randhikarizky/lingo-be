import { check, sleep } from "k6";
import http from "k6/http";
import { Counter } from "k6/metrics";
import { BASE_URL, LOAD_TEST_PASSWORD, THRESHOLDS } from "../config.js";
import {
  createConversation,
  loadTestEmail,
  login,
  postChat,
} from "../lib/http-helpers.js";

const quotaHits = new Counter("quota_exceeded_total");
const chatSuccess = new Counter("chat_success_total");

export const options = {
  scenarios: {
    free_users_chat: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 250,
      maxDuration: "5m",
    },
  },
  thresholds: {
    ...THRESHOLDS.chat,
    quota_exceeded_total: ["count>=1"],
  },
};

export default function chatQuota() {
  const vuIndex = (__VU - 1) % 10;
  const email = loadTestEmail(vuIndex + 1);
  const jar = http.cookieJar();

  login(email, LOAD_TEST_PASSWORD, jar);

  const conversationId = createConversation(jar);
  if (!conversationId) {
    return;
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = postChat(
      jar,
      conversationId,
      `Load test message ${attempt + 1} from VU ${__VU}`,
    );

    if (response.status === 200) {
      chatSuccess.add(1);
    }

    if (response.status === 403) {
      quotaHits.add(1);
      check(response, {
        "quota error code": (r) => {
          const body = r.json();
          return body?.data?.code === "QUOTA_EXCEEDED";
        },
      });
      break;
    }

    check(response, {
      "chat ok or quota": (r) => r.status === 200 || r.status === 403,
    });

    sleep(0.3);
  }
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const quota = data.metrics.quota_exceeded_total?.values?.count ?? 0;
  const success = data.metrics.chat_success_total?.values?.count ?? 0;

  return {
    stdout: [
      "",
      "=== Chat Quota Load Test ===",
      `Base URL: ${BASE_URL}`,
      `p95 latency: ${p95.toFixed(2)} ms`,
      `failed rate: ${(failed * 100).toFixed(2)}%`,
      `chat success: ${success}`,
      `quota exceeded hits: ${quota}`,
      "",
    ].join("\n"),
  };
}
