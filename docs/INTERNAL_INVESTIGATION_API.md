# UseDAM Shared Internal Investigation API (v1)

This specification documents the shared, versioned internal investigation API for UseDAM. It provides a unified backend service reused across:
1. **The Webapp Workspace** (interactive chat interface)
2. **The Browser Extension** (real-time feed overlay, right-click fact-checking, and clone site detection)
3. **The WhatsApp Verification Adapter** (automated inbound message verification and scam alerts)

---

## 🏛️ Architecture Overview

The API decouples client ingestion from the heavy multi-stage verification pipeline:
- **Immediate Response (Background Processing):** Investigation creation (`POST /api/v1/investigations`) validates the payload, checks rate limits/spend protection, verifies idempotency, spawns background execution, and immediately returns `202 Accepted` with an `investigationId`.
- **Reusable Core Engine:** All clients reuse `lib/investigation/service.ts`, which coordinates URL forensics, statutory cross-examination, multi-registry searches, evidence-driven verdict calculation, and cryptographic certificate generation.
- **Real-Time Streaming with Replay:** `GET /api/v1/investigations/:id/stream` provides an SSE connection that emits live events (`stage`, `token`, `meta`, `done`, `error`) and replays past events if a client reconnects mid-investigation.
- **Preserved Citations & Uncertainty:** In accordance with evidence-first design, findings cite primary sources (`[1]`, `[2]`), and claims lacking official circulars are marked `Unverified` (Insufficient Evidence) without hallucination.

---

## 🔐 Authentication & Client Security Architecture

### 1. Browser Extension
> [!IMPORTANT]
> **Never embed a shared master API key or secret in extension code.** Public client extension bundles can be disassembled and inspected.

- **Unauthenticated / Free Tier:**
  The extension generates a unique device installation UUID stored in `chrome.storage.local` and sends:
  ```http
  X-Client-Device-Id: dev_8f29ab43-4c92-491a-9694-8149e2908811
  X-Client-Source: extension
  ```
  The server assigns device-level ownership and applies the anonymous rate limit tier (30 requests/min). Other devices cannot access or stream this investigation.
- **Authenticated Tier:**
  The extension uses Supabase OAuth / PKCE or session tokens obtained from user login on the webapp. The token is transmitted as:
  ```http
  Authorization: Bearer <user_jwt_token>
  ```

### 2. WhatsApp Integration Adapter
- WhatsApp messages arrive via webhooks (e.g. Meta Cloud API or Twilio) to a private backend server or serverless adapter.
- Because this adapter runs server-side, it holds the internal service secret in its environment:
  ```http
  Authorization: Bearer <DAM_INTERNAL_API_KEY>
  X-Caller-Source: whatsapp
  ```
- Authenticated server services bypass single-user device isolation, allowing the bot to initiate and fetch investigations on behalf of WhatsApp users while still honoring global spend protection limits.

### 3. Webapp Client
- The webapp passes device identifiers or authenticated Supabase session tokens, sharing the exact same rate limiters and background processing pipeline.

---

## ⚙️ Investigation Modes

The API supports three calibrated investigation modes:
| Mode | Description | Resource Profile |
|---|---|---|
| `evidence` | **Default**. Evidence-first verification with cross-registry statutory analysis and deep citation extraction. | Standard |
| `quick` | Fast triage check for rapid social feed overlays and lightweight checks. Limits query depth. | Fast / Low Spend |
| `deep` | Comprehensive forensic investigation with multi-jurisdictional registry cross-checks. | Thorough |

> [!WARNING]
> Modes not implemented (such as `job_check`) are explicitly rejected with `HTTP 400 Bad Request` and error code `INVALID_MODE`.

---

## 📡 API Endpoints

### 1. Create Investigation
**`POST /api/v1/investigations`**

Queues a new investigation for background processing.

#### Headers
| Header | Type | Description |
|---|---|---|
| `Content-Type` | `string` | `application/json` (Required) |
| `Idempotency-Key` | `string` | Optional client-generated UUID to prevent duplicate investigations on network retries |
| `X-Client-Device-Id` | `string` | Extension or client device identifier (e.g. `dev_<uuid>`) |
| `Authorization` | `string` | `Bearer <token>` (User JWT or Server Service Key) |

#### Request Body
```json
{
  "prompt": "Verify this SMS: 'Dear Consumer electricity power will be disconnected tonight at 9:30 PM call electricity officer at 9821456789'",
  "mode": "evidence",
  "lang": "en",
  "attachments": []
}
```

#### Response: `202 Accepted` (New Investigation)
```json
{
  "investigationId": "inv_a8f92bd0mvcct",
  "caseId": "DAM-2026-4821",
  "status": "processing",
  "mode": "evidence",
  "isIdempotentReplay": false,
  "createdAt": "2026-10-17T12:00:00.000Z",
  "updatedAt": "2026-10-17T12:00:00.000Z",
  "links": {
    "self": "/api/v1/investigations/inv_a8f92bd0mvcct",
    "stream": "/api/v1/investigations/inv_a8f92bd0mvcct/stream",
    "followUp": "/api/v1/investigations/inv_a8f92bd0mvcct/follow-up"
  }
}
```

#### Response: `200 OK` (Idempotent Retry Replay)
If the same client resends the request with the identical `Idempotency-Key`, the existing investigation is returned without triggering duplicate background processing:
```json
{
  "investigationId": "inv_a8f92bd0mvcct",
  "caseId": "DAM-2026-4821",
  "status": "processing",
  "mode": "evidence",
  "isIdempotentReplay": true,
  "createdAt": "2026-10-17T12:00:00.000Z",
  "updatedAt": "2026-10-17T12:00:00.000Z",
  "links": { ... }
}
```

---

### 2. Read Investigation Status & Results
**`GET /api/v1/investigations/:id`**

Fetches the current status, stages, briefing, verdicts, evidence citations, and certificates.

#### Response: `200 OK`
```json
{
  "investigationId": "inv_a8f92bd0mvcct",
  "caseId": "DAM-2026-4821",
  "status": "completed",
  "mode": "evidence",
  "lang": "en",
  "prompt": "Verify this SMS: 'Dear Consumer electricity power will be disconnected tonight at 9:30 PM call electricity officer at 9821456789'",
  "briefing": "This communication is **a fraudulent scam** [1].\n\nLegitimate utility distribution companies never issue immediate disconnection notices via personal 10-digit mobile numbers without statutory notice under Section 56 of the Electricity Act 2003.",
  "stages": [
    {
      "id": "analyze",
      "title": "Analysing Request & Scope",
      "status": "completed",
      "summary": "Identified task as SCAM CHECK with 2 verification queries. Mode: evidence."
    },
    {
      "id": "search",
      "title": "Querying Authoritative Registries",
      "status": "completed",
      "summary": "Indexed 2 authoritative records across primary domains (rbi.org.in, pib.gov.in)"
    },
    {
      "id": "challenger",
      "title": "Adversarial Challenger Verification",
      "status": "completed",
      "summary": "Audit complete: Contradicted (Threat: High Risk)."
    },
    {
      "id": "synthesize",
      "title": "Synthesizing Intelligence Briefing",
      "status": "completed",
      "summary": "Briefing synthesized with verified citations and actionable citizen guidance."
    }
  ],
  "verdicts": {
    "factualCorrectness": "Contradicted",
    "scamRisk": "High",
    "evidenceSufficiency": "Sufficient",
    "verdictStatus": "false",
    "confidenceScore": 94,
    "riskTriggers": ["Electricity Disconnection Extortion", "Unverified 10-digit Helpline"]
  },
  "sources": [
    {
      "id": 1,
      "domain": "pib.gov.in",
      "title": "PIB Fact Check: Fake Electricity Disconnection SMS Alerts",
      "url": "https://pib.gov.in/FactCheck/electricity-scam",
      "authority": "high",
      "stance": "contradicts",
      "passage": "Power distribution utilities never send disconnection threats demanding payment to personal mobile numbers."
    }
  ],
  "certificate": {
    "caseId": "DAM-2026-4821",
    "status": "CONTRADICTED_DISINFORMATION",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "applicableStatutes": ["Section 56, Electricity Act 2003", "Section 204 BNS"]
  },
  "incidentReport": { ... },
  "error": null,
  "createdAt": "2026-10-17T12:00:00.000Z",
  "completedAt": "2026-10-17T12:00:02.400Z"
}
```

---

### 3. Stream Investigation Events (SSE)
**`GET /api/v1/investigations/:id/stream`**

Establishes a Server-Sent Events (SSE) connection. If the client connects while processing is underway, earlier stages and tokens are replayed immediately before live events continue.

#### Headers
```http
Accept: text/event-stream
X-Client-Device-Id: dev_<uuid>
```

#### Event Format
```
event: stage
data: {"id":"analyze","title":"Analysing Request & Scope","status":"completed","summary":"Identified task as SCAM CHECK."}

event: stage
data: {"id":"search","title":"Querying Authoritative Registries","status":"completed","summary":"Indexed 2 records."}

event: token
data: {"text":"This communication is **a fraudulent scam**."}

event: meta
data: {"caseId":"DAM-2026-4821","verdicts":{"factualCorrectness":"Contradicted","scamRisk":"High"}}

event: done
data: {"success":true,"investigationId":"inv_a8f92bd0mvcct"}
```

---

### 4. Follow-Up Inputs & Advisory
**`POST /api/v1/investigations/:id/follow-up`**

Submits follow-up instructions (e.g. asking for a bank grievance letter or 1930 reporting steps) for an existing completed investigation.

#### Request Body
```json
{
  "prompt": "Draft a formal dispute letter for my bank manager"
}
```

#### Response: `200 OK`
```json
{
  "investigationId": "inv_a8f92bd0mvcct",
  "turn": {
    "id": "turn_k8f921a",
    "role": "assistant",
    "content": "### Formal Dispute & Fraud Complaint Letter\n*(Ready to copy and submit to your Bank Branch Manager)*\n...",
    "taskType": "follow_up"
  },
  "updatedAt": "2026-10-17T12:01:10.000Z"
}
```

---

## 🚫 Standard Error Responses

Errors follow a structured, predictable format with HTTP status codes:
```json
{
  "error": "Investigation mode 'job_check' is not supported. Supported modes: 'evidence', 'quick', 'deep'.",
  "code": "INVALID_MODE",
  "requestId": "5a9f24b1-8b29-4d22-83b1-9f9392ab8102",
  "timestamp": "2026-10-17T12:00:00.000Z",
  "details": {
    "receivedMode": "job_check",
    "supportedModes": ["evidence", "quick", "deep"]
  }
}
```

| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `INVALID_MODE` | Unsupported investigation mode requested |
| `400` | `VALIDATION_FAILED` | Prompt exceeds 10,000 characters or payload malformed |
| `403` | `FORBIDDEN_INVESTIGATION_ACCESS` | Client does not own the requested investigation |
| `404` | `INVESTIGATION_NOT_FOUND` | Specified investigation ID does not exist |
| `429` | `RATE_LIMITED` | Client rate limit exceeded (Retry-After header present) |
| `429` | `SPEND_LIMIT_EXCEEDED` | Hourly provider token spend budget reached |

---

## 🧪 Local Testing Instructions

### 1. Run the Automated API Test Suite
```bash
npx tsx --test tests/sharedInvestigationApi.test.ts
```

### 2. Run All Workspace Unit & E2E Suites
```bash
npm test
```

### 3. Test Endpoint Manually with cURL
```bash
# 1. Queue an investigation
curl -X POST http://localhost:3000/api/v1/investigations \
  -H "Content-Type: application/json" \
  -H "X-Client-Device-Id: dev_local_tester_01" \
  -H "Idempotency-Key: test-key-100" \
  -d '{"prompt": "Verify RBI fake 500 currency note circular", "mode": "evidence"}'

# 2. Inspect status
curl http://localhost:3000/api/v1/investigations/<investigationId> \
  -H "X-Client-Device-Id: dev_local_tester_01"

# 3. Stream real-time events
curl http://localhost:3000/api/v1/investigations/<investigationId>/stream \
  -H "X-Client-Device-Id: dev_local_tester_01"
```

---

## 🚀 Exact Next Steps for Connecting Each Client

### 1. Browser Extension
1. In `manifest.json`, grant permissions for `https://your-dam-domain.com/api/v1/*`.
2. In the background service worker, initialize or read `chrome.storage.local.get('dam_device_id')`. If absent, generate a random UUID `dev_${crypto.randomUUID()}` and persist it.
3. For right-click context menu selections or active tab fact-checks:
   - Make a `POST /api/v1/investigations` with header `X-Client-Device-Id: <dam_device_id>` and `mode: "quick"` for fast badge overlays.
   - Open an EventSource connection to `/api/v1/investigations/:id/stream` to render the animated progress badge inside the injected feed card.

### 2. WhatsApp Integration Adapter
1. In your WhatsApp webhook listener service (e.g. Express or Cloudflare worker):
   - Set environment variable `DAM_INTERNAL_API_KEY=dam_srv_<your_strong_random_secret>`.
   - On receiving an inbound message with user text or attachment media:
     - Make a `POST /api/v1/investigations` with `Authorization: Bearer <DAM_INTERNAL_API_KEY>`.
     - Set `Idempotency-Key: msg_${message.id}` using WhatsApp's inbound message ID to prevent duplicate processing on webhook retries.
     - Poll `GET /api/v1/investigations/:id` or listen to the stream until `status === 'completed'`.
     - Format the resulting `briefing`, `verdicts`, and citation links into a WhatsApp response template and reply to the user.

### 3. Webapp Client
- The webapp already utilizes the shared backend service through the refactored `/api/investigate/stream` endpoint with zero breaking changes.
- For deep history linking and background case persistence, the webapp can optionally store the returned `investigationId` in URL query params (`?case=DAM-2026-...`) to permit reloading in-progress investigations across browser reloads.
