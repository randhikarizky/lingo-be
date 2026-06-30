# Lingora Load Tests (k6)

Light load tests for beta readiness. Default target: local backend on port **4626** with **mock AI/voice** (no provider cost).

## Prerequisites

1. [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed

   Windows:

   ```powershell
   winget install GrafanaLabs.k6
   # or: choco install k6
   ```

2. PostgreSQL + migrations applied
3. Backend running:

```powershell
cd lingora-be
$env:MOCK_AI="true"
$env:MOCK_VOICE="true"
npm run dev
```

## Setup test users

Creates `loadtest1@lingora.app` … `loadtest15@lingora.app` (password: `loadtest123`, plan FREE):

```powershell
npm run loadtest:setup
```

## Run scenarios

```powershell
# Quick sanity (1 VU, 30s)
npm run loadtest:smoke

# 10 concurrent FREE users → chat until quota 403
npm run loadtest:chat

# 5 VUs voice pipeline: STT → chat → TTS (2 min)
npm run loadtest:voice

# Login spike ~50 req/min (expect some 429 from rate limit)
npm run loadtest:login

# All scenarios
npm run loadtest:all
```

Custom base URL:

```powershell
$env:BASE_URL="http://localhost:4626"; npm run loadtest:smoke
```

## Scenarios

| Script | VUs | Goal |
|--------|-----|------|
| `smoke.js` | 1 | Health + login + 1 chat |
| `chat-quota.js` | 10 | Quota engine under concurrent chat |
| `voice-pipeline.js` | 5 | STT/chat/TTS latency baseline |
| `login-spike.js` | up to 25 | Auth + rate limit behavior |

## Metrics to watch

- **p95** `http_req_duration` — printed in terminal summary
- **http_req_failed** — should stay low except login spike (429)
- **quota_exceeded_total** — chat scenario should be ≥ 1

## Rate limits (current)

Per IP in middleware:

- Auth login/register: 20 / 15 min
- AI chat: 40 / min
- Speech: 30 / min

Login spike will hit 429 — that is expected and documents limiter works.

## Before production load test

Set `MOCK_AI=false` / `MOCK_VOICE=false` only with budget approval. Use separate staging env and lower VU count.
