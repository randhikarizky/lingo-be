import { check, sleep } from "k6";
import http from "k6/http";
import { BASE_URL, LOAD_TEST_PASSWORD, THRESHOLDS } from "../config.js";
import {
  createConversation,
  loadTestEmail,
  login,
  postChat,
  postSynthesize,
  postTranscribe,
} from "../lib/http-helpers.js";

export const options = {
  scenarios: {
    voice_pipeline: {
      executor: "constant-vus",
      vus: 5,
      duration: "2m",
    },
  },
  thresholds: THRESHOLDS.voice,
};

export default function voicePipeline() {
  const vuIndex = (__VU - 1) % 5;
  const email = loadTestEmail(vuIndex + 11);
  const jar = http.cookieJar();

  login(email, LOAD_TEST_PASSWORD, jar);

  const conversationId = createConversation(jar);
  if (!conversationId) {
    return;
  }

  const transcribe = postTranscribe(jar, conversationId);
  check(transcribe, {
    "transcribe 200": (r) => r.status === 200,
  });

  const chat = postChat(
    jar,
    conversationId,
    "I want to practice ordering in English.",
  );
  check(chat, {
    "chat 200 or 403": (r) => r.status === 200 || r.status === 403,
  });

  if (chat.status === 200) {
    const synth = postSynthesize(
      jar,
      conversationId,
      "Sure, let's practice your restaurant order.",
    );
    check(synth, {
      "synthesize 200": (r) => r.status === 200,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;

  return {
    stdout: [
      "",
      "=== Voice Pipeline Load Test ===",
      `Base URL: ${BASE_URL}`,
      `p95 latency: ${p95.toFixed(2)} ms`,
      `failed rate: ${(failed * 100).toFixed(2)}%`,
      "",
    ].join("\n"),
  };
}
