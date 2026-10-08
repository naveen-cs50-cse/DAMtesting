import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as healthGET } from '../app/api/health/route';
import { GET as readyGET } from '../app/api/ready/route';
import { GET as configGET } from '../app/api/config/route';
import { POST as searchPOST } from '../app/api/search/route';
import { GET as watchtowerGET } from '../app/api/watchtower/route';
import { POST as uploadPOST, GET as uploadGET } from '../app/api/upload/route';
import { POST as ingestUrlPOST } from '../app/api/ingest-url/route';
import { resetRateLimitStores } from '../lib/security/rateLimiter';

describe('Route Integration Tests', () => {

  beforeEach(() => {
    resetRateLimitStores();
  });

  describe('1. Health & Readiness Endpoints', () => {
    it('GET /api/health should return 200 OK with runtime diagnostics', async () => {
      const res = await healthGET();
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, 'healthy');
      assert.ok(typeof json.uptimeSeconds === 'number');
      assert.ok(json.timestamp);
      assert.ok(json.service);
    });

    it('GET /api/ready should return 200 OK with readiness checks', async () => {
      const res = await readyGET();
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, 'ready');
      assert.ok(json.checks);
      assert.equal(json.checks.runtime, 'ok');
      assert.equal(json.checks.memory, 'ok');
      assert.ok(typeof json.heapUsedMb === 'number');
    });
  });

  describe('2. Configuration Endpoint', () => {
    it('GET /api/config should return 200 and masked key status', async () => {
      const res = await configGET();
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok('hasOpenAI' in json);
      assert.ok('hasTavily' in json);
      if (json.maskedOpenAI) {
        assert.ok(json.maskedOpenAI.includes('...'));
      }
      if (json.maskedTavily) {
        assert.ok(json.maskedTavily.includes('...'));
      }
    });
  });

  describe('3. Search API Route (/api/search)', () => {
    it('should reject requests missing a query with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const res = await searchPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error);
    });

    it('should reject queries exceeding 500 characters with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'A'.repeat(501) })
      });

      const res = await searchPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes('500 character'));
    });

    it('should reject unconfigured provider or handle query with structured response', async () => {
      const req = new NextRequest('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'RBI 500 note demonetization circular' })
      });

      const res = await searchPOST(req);
      assert.ok(res.status === 200 || res.status === 400);
      const json = await res.json();
      assert.ok(json.results || json.error);
    });
  });

  describe('4. Watchtower API Route (/api/watchtower)', () => {
    it('should accept queries via GET and return sanitized threat feed and metrics', async () => {
      const req = new NextRequest('http://localhost:3000/api/watchtower?q=electricity&category=All', {
        method: 'GET'
      });

      const res = await watchtowerGET(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.feed));
      assert.ok(typeof json.count === 'number');
    });
  });

  describe('5. Upload API Route (/api/upload)', () => {
    it('should reject invalid or spoofed document bytes with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'fake.pdf',
          type: 'application/pdf',
          base64: Buffer.from('<script>alert(1)</script>').toString('base64')
        })
      });

      const res = await uploadPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error);
    });

    it('should accept valid image bytes and return attachment metadata', async () => {
      // 1x1 PNG bytes
      const validPngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89
      ]);
      const base64Png = `data:image/png;base64,${validPngBytes.toString('base64')}`;

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'evidence_screenshot.png',
          type: 'image/png',
          base64: base64Png
        })
      });

      const res = await uploadPOST(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(json.file);
      assert.ok(json.file.id);
      assert.equal(json.file.name, 'evidence_screenshot.png');
      assert.ok(json.file.previewUrl.includes('/api/upload?fileId='));

      // Retrieve via GET /api/upload?fileId=
      const getReq = new NextRequest(`http://localhost:3000${json.file.previewUrl}`, {
        method: 'GET'
      });
      const getRes = await uploadGET(getReq);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.headers.get('content-type'), 'image/png');
    });

    it('should return 404 for unknown file IDs', async () => {
      const getReq = new NextRequest('http://localhost:3000/api/upload?fileId=nonexistent_12345', {
        method: 'GET'
      });
      const getRes = await uploadGET(getReq);
      assert.equal(getRes.status, 404);
    });
  });

  describe('6. URL Ingestion API Route (/api/ingest-url)', () => {
    it('should reject invalid or missing URL in payload with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/ingest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const res = await ingestUrlPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error);
    });

    it('should block SSRF attempts targeting private IP ranges with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/ingest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://127.0.0.1:8080/admin' })
      });

      const res = await ingestUrlPOST(req);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.ok(json.error.includes('SSRF') || json.error.includes('Private'));
    });
  });
});
