import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as streamPOST } from '../app/api/investigate/stream/route';
import { resetRateLimitStores } from '../lib/security/rateLimiter';

describe('Investigation End-to-End Streamed Pipeline', () => {

  beforeEach(() => {
    resetRateLimitStores();
  });

  describe('1. Schema Validation & Limit Enforcement', () => {
    it('should reject prompts exceeding 10,000 characters with 400 Bad Request', async () => {
      const hugePrompt = 'A'.repeat(10001);
      const req = new NextRequest('http://localhost:3000/api/investigate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: hugePrompt })
      });

      const res = await streamPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes('10000 characters'));
      assert.equal(json.code, 'VALIDATION_FAILED');
    });

    it('should reject requests with empty prompt and zero attachments with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/investigate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '   ', attachments: [] })
      });

      const res = await streamPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes('at least one attachment'));
    });

    it('should reject conversation history exceeding 50 turns with 400', async () => {
      const excessiveHistory = Array.from({ length: 51 }, (_, i) => ({
        id: `turn_${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));

      const req = new NextRequest('http://localhost:3000/api/investigate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Valid query',
          conversationHistory: excessiveHistory
        })
      });

      const res = await streamPOST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes('50 messages'));
    });
  });

  describe('2. Rate Limiting Enforcement', () => {
    it('should throttle excessive rapid requests with 429 Too Many Requests', async () => {
      const clientIp = '192.0.2.42';
      let lastStatus = 200;

      // Anonymous limit is 30 requests per minute
      for (let i = 0; i < 35; i++) {
        const req = new NextRequest('http://localhost:3000/api/investigate/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': clientIp
          },
          body: JSON.stringify({ prompt: `Speed check query ${i}` })
        });

        const res = await streamPOST(req);
        lastStatus = res.status;
        if (lastStatus === 429) {
          const json = await res.json();
          assert.ok(json.code === 'RATE_LIMITED' || json.code === 'SPEND_LIMIT_EXCEEDED');
          assert.ok(json.error.includes('Rate limit') || json.error.includes('Spend protection') || json.error.includes('quota'));
          break;
        }
      }

      assert.equal(lastStatus, 429);
    });
  });

  describe('3. Complete Streamed Investigation Execution', () => {
    it('should stream a full investigation with stages, briefing tokens, and metadata', async () => {
      const prompt = 'Dear consumer electricity power will be disconnected tonight at 9.30 pm from power office. Contact officer at 9821012345';

      const req = new NextRequest('http://localhost:3000/api/investigate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.99'
        },
        body: JSON.stringify({ prompt })
      });

      const res = await streamPOST(req);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));
      assert.ok(res.headers.get('x-request-id'));

      // Read SSE stream
      assert.ok(res.body);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';
      const stagesReceived: string[] = [];
      const tokensReceived: string[] = [];
      let metaEvent: Record<string, unknown> | null = null;
      let doneReceived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });

        const lines = streamBuffer.split('\n\n');
        streamBuffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;
          const matchEvent = block.match(/event:\s*(\w+)/);
          const matchData = block.match(/data:\s*([\s\S]+)/);

          if (matchEvent && matchData) {
            const eventType = matchEvent[1];
            try {
              const data = JSON.parse(matchData[1]);
              if (eventType === 'stage') {
                stagesReceived.push(data.id);
              } else if (eventType === 'token') {
                tokensReceived.push(data.text);
              } else if (eventType === 'meta') {
                metaEvent = data;
              } else if (eventType === 'done') {
                doneReceived = true;
              }
            } catch {
              // Non-JSON SSE payload
            }
          }
        }
      }

      // Assert complete pipeline behavior
      assert.equal(doneReceived, true, 'Stream did not emit done event');
      assert.ok(stagesReceived.length >= 3, `Expected multiple pipeline stages, got: ${stagesReceived.join(', ')}`);
      assert.ok(stagesReceived.includes('coordinate') || stagesReceived.includes('plan') || stagesReceived.includes('synthesize'));

      // Assert synthesized briefing tokens
      const fullText = tokensReceived.join('');
      assert.ok(fullText.length > 50, 'Synthesized briefing tokens were empty');
      assert.ok(
        fullText.toLowerCase().includes('finding') ||
        fullText.toLowerCase().includes('fact') ||
        fullText.toLowerCase().includes('scam') ||
        fullText.toLowerCase().includes('power') ||
        fullText.toLowerCase().includes('electricity')
      );

      // Assert forensic metadata
      assert.ok(metaEvent, 'Meta event was not emitted in stream');
      const meta = metaEvent as {
        caseId: string;
        verdicts: { scamRisk: string };
        statutes: { statutoryViolationCount: number };
        certificate: { status: string; sha256Fingerprint: string };
        manipulationAudit: { overallIndex: number };
      };
      assert.ok(meta.caseId);
      assert.ok(meta.verdicts);
      assert.equal(meta.verdicts.scamRisk, 'High');
      assert.ok(meta.statutes);
      assert.ok(meta.statutes.statutoryViolationCount >= 1);
      assert.ok(meta.certificate);
      assert.equal(meta.certificate.status, 'EVIDENCE_INSUFFICIENT');
      assert.equal(meta.certificate.sha256Fingerprint.length, 64);
      assert.ok(meta.manipulationAudit);
      assert.ok(meta.manipulationAudit.overallIndex > 0);
    });
  });
});
