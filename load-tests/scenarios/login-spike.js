import { check } from "k6";
import http from "k6/http";
import { BASE_URL, LOAD_TEST_PASSWORD, THRESHOLDS } from "../config.js";
import { loadTestEmail, login } from "../lib/http-helpers.js";

export const options = {
  scenarios: {
    login_spike: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1m",
      duration: "1m",
      preAllocatedVUs: 10,
      maxVUs: 25,
    },
  },
  thresholds: THRESHOLDS.login,
};

export default function loginSpike() {
  const email = loadTestEmail((__VU % 10) + 1);
  const jar = http.cookieJar();
  const response = login(email, LOAD_TEST_PASSWORD, jar);

  check(response, {
    "login ok or rate limited": (r) => r.status === 200 || r.status === 429,
  });
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const total = data.metrics.http_reqs?.values?.count ?? 0;
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;

  return {
    stdout: [
      "",
      "=== Login Spike Load Test ===",
      `Base URL: ${BASE_URL}`,
      `total requests: ${total}`,
      `p95 latency: ${p95.toFixed(2)} ms`,
      `failed rate: ${(failed * 100).toFixed(2)}%`,
      "Note: 429 expected — auth rate limit 20 req / 15 min per IP",
      "",
    ].join("\n"),
  };
}
