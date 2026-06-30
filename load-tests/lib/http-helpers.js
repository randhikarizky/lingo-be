import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "../config.js";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export function login(email, password, jar) {
  const response = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: JSON_HEADERS,
      jar,
      tags: { name: "auth_login" },
    }
  );

  check(response, {
    "login status 200": (r) => r.status === 200,
  });

  return response;
}

export function loadTestEmail(index) {
  return `loadtest${index}@lingora.app`;
}

export function createConversation(jar) {
  const response = http.post(
    `${BASE_URL}/api/v1/conversations`,
    JSON.stringify({
      characterId: "maya",
      personality: "santai",
      language: "en",
      scenarioType: "restaurant",
      difficulty: "beginner",
    }),
    {
      headers: JSON_HEADERS,
      jar,
      tags: { name: "conversation_create" },
    }
  );

  check(response, {
    "create conversation 200": (r) => r.status === 200,
  });

  if (response.status !== 200) {
    return null;
  }

  const body = response.json();
  return body?.data?.id ?? null;
}

export function postChat(jar, conversationId, content) {
  return http.post(
    `${BASE_URL}/api/v1/ai/chat`,
    JSON.stringify({
      conversationId,
      model: "gpt-5-2",
      messages: [{ role: "user", content }],
    }),
    {
      headers: JSON_HEADERS,
      jar,
      tags: { name: "ai_chat" },
    }
  );
}

export function postSynthesize(jar, conversationId, text) {
  return http.post(
    `${BASE_URL}/api/v1/speech/synthesize`,
    JSON.stringify({
      text,
      conversationId,
      language: "en",
    }),
    {
      headers: {
        ...JSON_HEADERS,
        Accept: "audio/mpeg, audio/*",
      },
      jar,
      tags: { name: "speech_synthesize" },
    }
  );
}

export function postTranscribe(jar, conversationId) {
  const audioBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x08]);

  return http.post(
    `${BASE_URL}/api/v1/speech/transcribe`,
    {
      audio: http.file(audioBytes, "loadtest.webm", "audio/webm"),
      conversationId,
      language: "en",
    },
    {
      jar,
      tags: { name: "speech_transcribe" },
    }
  );
}

export function getHealthReady() {
  return http.get(`${BASE_URL}/api/v1/health/ready`, {
    tags: { name: "health_ready" },
  });
}
