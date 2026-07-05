import { check, sleep } from "k6";
import http from "k6/http";
import { BASE_URL, LOAD_TEST_PASSWORD, THRESHOLDS } from "../config.js";
import {
  createConversation,
  loadTestEmail,
  login,
  postChat,
  getHealthReady,
} from "../lib/http-helpers.js";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: THRESHOLDS.smoke,
};

export default function smoke() {
  const ready = getHealthReady();
  check(ready, {
    "health ready 200": (r) => r.status === 200,
  });

  const jar = http.cookieJar();
  login(loadTestEmail(1), LOAD_TEST_PASSWORD, jar);

  const conversationId = createConversation(jar);
  if (!conversationId) {
    return;
  }

  const chat = postChat(
    jar,
    conversationId,
    "Hello, I would like to order food.",
  );
  check(chat, {
    "chat status 200": (r) => r.status === 200,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, opts) {
  const { metrics } = data;
  const p95 = metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const failed = metrics.http_req_failed?.values?.rate ?? 0;

  return [
    "",
    "=== Lingora Smoke Summary ===",
    `Base URL: ${BASE_URL}`,
    `p95 latency: ${p95.toFixed(2)} ms`,
    `failed rate: ${(failed * 100).toFixed(2)}%`,
    "",
  ].join("\n");
}
