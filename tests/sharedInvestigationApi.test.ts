import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as createInvestigationPOST } from '../app/api/v1/investigations/route';
import { GET as getInvestigationGET } from '../app/api/v1/investigations/[id]/route';
import { GET as streamInvestigationGET } from '../app/api/v1/investigations/[id]/stream/route';
import { POST as followUpPOST } from '../app/api/v1/investigations/[id]/follow-up/route';
import { resetRateLimitStores } from '../lib/security/rateLimiter';
import { resetInvestigationStore } from '../lib/investigation/store';

describe('Shared Internal Investigation API (v1)', () => {
  beforeEach(() => {
    resetRateLimitStores();
    resetInvestigationStore();
  });

  describe('1. Input Validation & Mode Enforcement', () => {
    it('should reject malformed or non-JSON payloads with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      });

      const res = await createInvestigationPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'BAD_REQUEST');
    });

    it('should reject empty prompt and empty attachments with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '   ', attachments: [] })
      });

      const res = await createInvestigationPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'VALIDATION_FAILED');
      assert.ok(json.error.includes('at least one attachment'));
    });

    it('should reject unsupported mode "job_check" with 400 INVALID_MODE', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Verify this part-time telegram job offering 5000 rs per day',
          mode: 'job_check'
        })
      });

      const res = await createInvestigationPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, 'INVALID_MODE');
      assert.ok(json.error.includes("'job_check' is not supported"));
      assert.deepEqual(json.details.supportedModes, ['evidence', 'quick', 'deep']);
    });

    it('should accept supported modes: evidence, quick, deep with 202 Accepted', async () => {
      for (const mode of ['evidence', 'quick', 'deep']) {
        const req = new NextRequest('http://localhost:3000/api/v1/investigations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-device-id': `dev_mode_${mode}`
          },
          body: JSON.stringify({
            prompt: `Check suspicious message under mode ${mode}`,
            mode
          })
        });

        const res = await createInvestigationPOST(req);
        assert.equal(res.status, 202);
        const json = await res.json();
        assert.ok(json.investigationId.startsWith('inv_'));
        assert.ok(json.caseId.startsWith('DAM-2026-'));
        assert.equal(json.mode, mode);
        assert.ok(json.links.self);
        assert.ok(json.links.stream);
        assert.ok(json.links.followUp);
      }
    });
  });

  describe('2. Idempotency & Retry Deduplication', () => {
    it('should deduplicate retried requests with identical Idempotency-Key header', async () => {
      const idempotencyKey = 'client-req-uuid-999-abc';
      const payload = {
        prompt: 'Verify RBI circular regarding 500 note ban',
        mode: 'evidence'
      };

      const req1 = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'x-client-device-id': 'device-client-1'
        },
        body: JSON.stringify(payload)
      });

      const res1 = await createInvestigationPOST(req1);
      assert.equal(res1.status, 202);
      const json1 = await res1.json();
      const firstId = json1.investigationId;
      assert.equal(json1.isIdempotentReplay, false);

      // Second identical call with the same idempotency key
      const req2 = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'x-client-device-id': 'device-client-1'
        },
        body: JSON.stringify(payload)
      });

      const res2 = await createInvestigationPOST(req2);
      assert.equal(res2.status, 200);
      const json2 = await res2.json();
      assert.equal(json2.investigationId, firstId);
      assert.equal(json2.isIdempotentReplay, true);
    });
  });

  describe('3. Per-Investigation Ownership & Authentication', () => {
    it('should allow creator to access their investigation and reject unauthorized callers with 403', async () => {
      // 1. Client Alice creates an investigation
      const aliceReq = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-device-id': 'device_alice_token_123'
        },
        body: JSON.stringify({
          prompt: 'Verify electricity bill disconnect message'
        })
      });

      const aliceRes = await createInvestigationPOST(aliceReq);
      assert.equal(aliceRes.status, 202);
      const { investigationId } = await aliceRes.json();

      // 2. Alice reads the investigation -> 200 OK
      const aliceReadReq = new NextRequest(`http://localhost:3000/api/v1/investigations/${investigationId}`, {
        headers: { 'x-client-device-id': 'device_alice_token_123' }
      });
      const aliceReadRes = await getInvestigationGET(aliceReadReq, {
        params: Promise.resolve({ id: investigationId })
      });
      assert.equal(aliceReadRes.status, 200);
      const aliceData = await aliceReadRes.json();
      assert.equal(aliceData.investigationId, investigationId);

      // 3. Client Bob attempts to read Alice's investigation -> 403 Forbidden
      const bobReadReq = new NextRequest(`http://localhost:3000/api/v1/investigations/${investigationId}`, {
        headers: { 'x-client-device-id': 'device_bob_token_999' }
      });
      const bobReadRes = await getInvestigationGET(bobReadReq, {
        params: Promise.resolve({ id: investigationId })
      });
      assert.equal(bobReadRes.status, 403);
      const bobData = await bobReadRes.json();
      assert.equal(bobData.code, 'FORBIDDEN_INVESTIGATION_ACCESS');

      // 4. Server Service (WhatsApp adapter) can access with internal service key -> 200 OK
      const serviceReq = new NextRequest(`http://localhost:3000/api/v1/investigations/${investigationId}`, {
        headers: { 'Authorization': 'Bearer dam_srv_default_internal_key' }
      });
      const serviceRes = await getInvestigationGET(serviceReq, {
        params: Promise.resolve({ id: investigationId })
      });
      assert.equal(serviceRes.status, 200);
    });

    it('should return 404 for non-existent investigation ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/investigations/inv_missing_404', {
        headers: { 'x-client-device-id': 'device_alice_token_123' }
      });
      const res = await getInvestigationGET(req, {
        params: Promise.resolve({ id: 'inv_missing_404' })
      });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, 'INVESTIGATION_NOT_FOUND');
    });
  });

  describe('4. Background Processing & Investigation Status Lifecycle', () => {
    it('should transition from processing to completed and preserve evidence citations and verdicts', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-device-id': 'device_test_worker'
        },
        body: JSON.stringify({
          prompt: 'Verify this SMS: Dear Consumer electricity power will be disconnected at 9:30 PM call 9821456789'
        })
      });

      const createRes = await createInvestigationPOST(createReq);
      assert.equal(createRes.status, 202);
      const { investigationId } = await createRes.json();

      // Poll until background execution completes (within 3 seconds)
      let status = 'processing';
      let payload: Record<string, any> = {};

      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        const readReq = new NextRequest(`http://localhost:3000/api/v1/investigations/${investigationId}`, {
          headers: { 'x-client-device-id': 'device_test_worker' }
        });
        const readRes = await getInvestigationGET(readReq, {
          params: Promise.resolve({ id: investigationId })
        });
        assert.equal(readRes.status, 200);
        payload = await readRes.json();
        status = payload.status;
        if (status === 'completed') break;
      }

      assert.equal(status, 'completed');
      assert.ok(payload.briefing.length > 50);
      assert.ok(payload.stages.length >= 3);
      assert.ok(payload.verdicts);
      assert.ok(payload.certificate);
      assert.ok(payload.incidentReport);
      assert.ok(['Contradicted', 'Unverified'].includes(payload.verdicts.factualCorrectness));
      assert.equal(payload.verdicts.scamRisk, 'High');
    });
  });

  describe('5. Stream Progress & Replay', () => {
    it('should stream investigation progress and replay buffered state to connecting clients', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-device-id': 'device_stream_client'
        },
        body: JSON.stringify({
          prompt: 'Fact-check 500 currency note ban'
        })
      });

      const createRes = await createInvestigationPOST(createReq);
      const { investigationId } = await createRes.json();

      // Wait 300ms for some stages to process
      await new Promise(r => setTimeout(r, 300));

      const streamReq = new NextRequest(`http://localhost:3000/api/v1/investigations/${investigationId}/stream`, {
        headers: { 'x-client-device-id': 'device_stream_client' }
      });
      const streamRes = await streamInvestigationGET(streamReq, {
        params: Promise.resolve({ id: investigationId })
      });

      assert.equal(streamRes.status, 200);
      assert.equal(streamRes.headers.get('Content-Type'), 'text/event-stream');
      assert.ok(streamRes.body);

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let streamedData = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamedData += decoder.decode(value);
        if (streamedData.includes('event: done')) break;
      }

      assert.ok(streamedData.includes('event: stage'));
      assert.ok(streamedData.includes('event: done'));
    });
  });

  describe('6. Follow-Up Inputs & Advisory Drafting', () => {
    it('should accept follow-up inquiries on completed investigations', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/v1/investigations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-device-id': 'device_followup_client'
        },
        body: JSON.stringify({
          prompt: 'Verify fake police video call extortion'
        })
      });

      const createRes = await createInvestigationPOST(createReq);
      const { investigationId } = await createRes.json();

      // Submit follow-up asking for a formal complaint letter
      const followUpReq = new NextRequest(`http://localhost:3000/api/v1/investigations/${investigationId}/follow-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-device-id': 'device_followup_client'
        },
        body: JSON.stringify({
          prompt: 'Draft a formal complaint letter for my bank manager'
        })
      });

      const followUpRes = await followUpPOST(followUpReq, {
        params: Promise.resolve({ id: investigationId })
      });
      assert.equal(followUpRes.status, 200);
      const json = await followUpRes.json();
      assert.equal(json.investigationId, investigationId);
      assert.ok(json.turn.content.includes('Formal Dispute & Fraud Complaint Letter'));
      assert.ok(json.turn.content.includes('RBI Master Direction'));
    });
  });
});
