# UseDAM (Data & Abuse Monitoring) — Regulatory Intelligence Engine

UseDAM is an evidence-first misinformation investigation and regulatory verification platform for Indian citizens and enterprise risk teams. It correlates digital notices, viral forwards, uploaded documents (PDFs), images, and submitted URLs against indexed government gazettes, regulatory circulars (RBI, TRAI, MeitY, CERT-In), and primary authoritative registries.

---

## 🛠️ Developer Commands

### 1. Development Mode
Starts the Next.js development server with Turbopack and hot reloading at `http://localhost:3000`:
```bash
npm run dev
```

### 2. Linting
Runs ESLint with strict TypeScript rules and React 19 / Next.js compiler checks:
```bash
npm run lint
```
*Note: Rules enforce zero errors and zero warnings across all workspace components.*

### 3. Running Automated Tests
Runs all unit, integration, and end-to-end test suites using Node's native test runner (`node:test` via `tsx`):
```bash
npm test
```

You can also run specific test suites individually:
```bash
# Core Evidence-Driven Verdict Engine
npx tsx --test tests/verdictEngine.test.ts

# Production Document & PDF Forensics
npx tsx --test tests/documentAnalysis.test.ts

# Secure Server-Side URL Ingestion & SSRF Protection
npx tsx --test tests/urlIngestion.test.ts

# Core Pipeline Unit Tests (Coordinator, OCR, Forensics, Statutes, Manipulation, Certificate, Naming)
npx tsx --test tests/investigationUnits.test.ts

# API Route Integration Tests (Health, Ready, Config, Search, Watchtower, Upload, Ingest)
npx tsx --test tests/routeIntegration.test.ts

# End-to-End Streamed Investigation Pipeline
npx tsx --test tests/investigationE2E.test.ts
```

### 4. Production Build
Validates TypeScript typechecking and builds the production-optimized Next.js bundle:
```bash
npm run build
```

To run the built production server locally:
```bash
npm run start
```

---

## 🛡️ Safety, Security, & Quality Foundation

UseDAM enforces a multi-layered security and safety perimeter across all server endpoints:

### Server-Side Limits & Schema Validation (`lib/security/schemas.ts`)
- **Max Prompt Length**: 10,000 characters.
- **Max Conversation History**: 50 turns / messages.
- **Max Attachments**: 5 files per request.
- **Max Single File Size**: 15 MB.
- **Max Total Request Payload**: 25 MB.
- **Max Search Query**: 500 characters.
- **Max Submitted URL**: 2,048 characters.
- Strict input validation schemas reject malformed JSON, excessive depths, and boundary violations with HTTP 400 and structured error codes (`PROMPT_TOO_LONG`, `HISTORY_TOO_DEEP`, `FILE_TOO_LARGE`).

### Rate Limiting & Provider Spend Protection (`lib/security/rateLimiter.ts`)
- **Tiered Sliding-Window Rate Limiting**:
  - `anonymous`: 30 requests/minute, max 20 investigations/hour.
  - `authenticated` (via session or custom provider key): 120 requests/minute, max 100 investigations/hour.
- **Spend Protection Ceiling**: Limits hourly token consumption to guard against denial-of-wallet attacks and runaway automated loops (HTTP 429 with retry-after diagnostics).

### SSRF Defense & URL Hardening (`lib/investigation/urlIngestion.ts`)
- Enforces HTTP/HTTPS protocol exclusivity.
- Defends against Server-Side Request Forgery (SSRF) by verifying resolved DNS IPs against private (RFC 1918), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), multicast, and cloud metadata endpoints.
- Analyzes domain risk for Punycode (`xn--`), Cyrillic/Greek homoglyphs, typosquatting of Indian institutions (SBI, RBI, UIDAI, Parivahan), and deceptive subdomain routing.

### Provider Timeouts & Structured Errors (`lib/security/errors.ts`)
- External provider calls (OpenAI, Tavily) are wrapped in strict abortable timeouts (`withTimeout`).
- Consistent JSON error response shape: `{ error, code, requestId, details, timestamp }`.

### Structured Redacting Logger (`lib/security/logger.ts`)
- Every request is tagged with an `x-request-id` UUID.
- Logs structured JSON with automatic redaction of:
  - OpenAI / Google / Tavily API keys
  - Authorization / Bearer tokens
  - Indian PAN cards (`[A-Z]{5}[0-9]{4}[A-Z]`)
  - Aadhaar numbers (`\d{4}\s?\d{4}\s?\d{4}`)
  - Indian mobile numbers (`+91 ...`)
  - Email addresses
  - Raw base64 file payloads

### Observability & Liveness Endpoints
- **Liveness Probe**: `GET /api/health` — Returns service status, uptime, timestamp, and version (HTTP 200).
- **Readiness Probe**: `GET /api/ready` — Checks runtime readiness, DNS resolution, and memory heap thresholds (HTTP 200 or 503).
