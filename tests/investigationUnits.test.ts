import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coordinateInvestigation } from '../lib/investigation/coordinator';
import { extractEntitiesFromText } from '../lib/investigation/ocr';
import { validateAndNormalizeUrl, isPrivateOrReservedIp, analyzeDomainRisk } from '../lib/investigation/urlIngestion';
import { evaluateStatutoryContradictions } from '../lib/investigation/statutes';
import { analyzeManipulationVectors } from '../lib/investigation/manipulation';
import { generateVerificationCertificate } from '../lib/investigation/certificate';
import { generateSmartTitle } from '../lib/investigation/naming';
import { verifyAndChallenge } from '../lib/investigation/verifier';
import { IndexedSource, DocumentAnalysis, UrlAnalysisResult } from '../lib/investigation/types';

describe('Unit Tests: Core Investigation Modules', () => {

  describe('1. Coordinator: Task Planning & Query Formulation', () => {
    it('should classify prompt as scam_check for coercive urgency and banking keywords', () => {
      const plan = coordinateInvestigation('Dear consumer, your electricity power cut tonight at 9:30 PM. Download APK');
      assert.equal(plan.taskType, 'scam_check');
      assert.ok(plan.queries.length > 0);
    });

    it('should classify prompt as research for policy and overview inquiries', () => {
      const plan = coordinateInvestigation('Overview of RBI sovereign green bond policy and guidelines');
      assert.equal(plan.taskType, 'research');
      assert.ok(plan.queries.some(q => q.toLowerCase().includes('green bond')));
    });

    it('should classify attachments with PDFs as document_analysis', () => {
      const plan = coordinateInvestigation('Check this document', [
        {
          id: '1',
          name: 'gazette.pdf',
          type: 'application/pdf',
          size: 1024,
          url: 'blob:pdf'
        }
      ]);
      assert.equal(plan.taskType, 'document_analysis');
    });

    it('should extract queries from document identifiers and URL forensics', () => {
      const plan = coordinateInvestigation('Verify this message', [
        {
          id: '2',
          name: 'doc.pdf',
          type: 'application/pdf',
          size: 2048,
          url: 'blob:doc',
          documentAnalysis: {
            isPdf: true,
            extractedIdentifiers: {
              circularNumbers: ['RBI/2026/104'],
              issuingAuthorities: ['Reserve Bank of India']
            },
            anomalies: [],
            regulatoryCorroboration: []
          } as unknown as DocumentAnalysis,
          urlAnalysis: {
            inputUrl: 'https://sbi.co.in.attacker.xyz/login',
            normalizedUrl: 'https://sbi.co.in.attacker.xyz/login',
            domain: 'sbi.co.in.attacker.xyz',
            ip: '198.51.100.1',
            domainRisk: {
              warnings: [],
              isPunycode: false,
              hasHomoglyphs: false,
              isDeceptiveSubdomain: true,
              typosquatTarget: 'State Bank of India (sbi.co.in)'
            },
            claims: ['Update KYC within 24 hours']
          } as unknown as UrlAnalysisResult
        }
      ]);

      const allQueries = plan.queries.join(' ');
      assert.ok(allQueries.includes('RBI/2026/104'));
      assert.ok(allQueries.includes('Reserve Bank of India'));
      assert.ok(allQueries.includes('fake phishing website advisory'));
    });
  });

  describe('2. OCR & Text Entity Extraction', () => {
    it('should extract Indian mobile numbers, DLT sender IDs, URLs, and currency amounts', () => {
      const text = `
        URGENT: Disconnection notice from CP-SBIINB.
        Your electricity bill of ₹4,250 is pending.
        Contact officer at +91 98210 12345 or 8877665544 immediately.
        Pay at https://quickpay-bill.in/pay or risk penalty of Rs. 1000.
      `;

      const entities = extractEntitiesFromText(text);

      assert.ok(entities.phones && entities.phones.length >= 2);
      assert.ok(entities.phones.some(p => p.includes('9821012345') || p.includes('8877665544')));
      assert.ok(entities.senderIds && entities.senderIds.includes('CP-SBIINB'));
      assert.ok(entities.urls && entities.urls.some(u => u.includes('quickpay-bill.in/pay')));
      assert.ok(entities.amounts && entities.amounts.some(a => a.includes('4,250') || a.includes('1000')));
    });

    it('should return empty entity lists for plain benign text', () => {
      const entities = extractEntitiesFromText('Just a simple conversation text without numbers or links');
      assert.deepEqual(entities.phones || [], []);
      assert.deepEqual(entities.urls || [], []);
      assert.deepEqual(entities.senderIds || [], []);
      assert.deepEqual(entities.amounts || [], []);
    });
  });

  describe('3. URL Forensics & Security Checks', () => {
    it('should normalize URLs and strip tracking parameters', () => {
      const normalized = validateAndNormalizeUrl('https://example.com/page?utm_source=twitter&id=123&fbclid=abc#frag');
      assert.equal(normalized.url, 'https://example.com/page?id=123');
      assert.equal(normalized.domain, 'example.com');
    });

    it('should reject non-HTTP protocols and embedded credentials', () => {
      assert.throws(() => validateAndNormalizeUrl('ftp://files.example.com'), /Only HTTP and HTTPS/);
      assert.throws(() => validateAndNormalizeUrl('javascript:alert(1)'), /Only HTTP and HTTPS/);
      assert.throws(() => validateAndNormalizeUrl('https://user:pass@example.com/'), /credentials/);
    });

    it('should detect private, loopback, and cloud metadata IP addresses', () => {
      assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
      assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
      assert.equal(isPrivateOrReservedIp('172.16.5.1'), true);
      assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
      assert.equal(isPrivateOrReservedIp('169.254.169.254'), true); // AWS metadata
      assert.equal(isPrivateOrReservedIp('::1'), true);
      assert.equal(isPrivateOrReservedIp('8.8.8.8'), false); // Public DNS
      assert.equal(isPrivateOrReservedIp('104.26.10.228'), false);
    });

    it('should detect punycode, homoglyphs, and deceptive subdomains', () => {
      const punyRisk = analyzeDomainRisk('xn--sbi-8ka.com');
      assert.equal(punyRisk.isPunycode, true);

      const homoglyphRisk = analyzeDomainRisk('sbі-bank.com'); // Cyrillic і
      assert.equal(homoglyphRisk.hasHomoglyphs, true);

      const deceptiveRisk = analyzeDomainRisk('sbi.co.in.banking-secure.com');
      assert.equal(deceptiveRisk.isDeceptiveSubdomain, true);
      assert.ok(deceptiveRisk.typosquatTarget?.includes('State Bank of India'));
    });
  });

  describe('4. Statutory Audit & Legal Provisions', () => {
    it('should match Indian Electricity Act Section 56 for disconnection threats', () => {
      const audit = evaluateStatutoryContradictions('Electricity bill power cut tonight bijli disconnection');
      assert.ok(audit.statutoryViolationCount >= 1);
      const electricityClause = audit.applicableStatutes.find(s => s.act.includes('Electricity Act'));
      assert.ok(electricityClause);
      assert.ok(electricityClause.statutoryRule.includes('15 clear days notice'));
    });

    it('should match BNS Section 204 for Digital Arrest and police extortion', () => {
      const audit = evaluateStatutoryContradictions('Digital arrest by CBI customs officer on Skype call');
      assert.ok(audit.applicableStatutes.some(s => s.act.includes('Bharatiya Nyaya Sanhita')));
    });

    it('should match TRAI and RBI regulations for unsolicited SMS and banking APKs', () => {
      const audit = evaluateStatutoryContradictions(
        'Dear customer, install APK to update bank KYC card block OTP',
        '',
        { phones: ['9821098210'] }
      );
      assert.ok(audit.applicableStatutes.some(s => s.act.includes('Reserve Bank of India')));
      assert.ok(audit.applicableStatutes.some(s => s.act.includes('TRAI')));
    });
  });

  describe('5. Manipulation Vector Analysis', () => {
    it('should detect high false urgency and coercion in scam messages', () => {
      const text = 'URGENT: Your power will be disconnected tonight immediately within 2 hours. Arrest warrant issued!';
      const audit = analyzeManipulationVectors(text);
      assert.ok(audit.overallIndex >= 60);
      assert.ok(audit.threatLevel === 'Severe' || audit.threatLevel === 'Critical');

      const urgencyVector = audit.vectors.find(v => v.id === 'urgency');
      assert.ok(urgencyVector && urgencyVector.score > 0);
      assert.ok(urgencyVector.detectedTriggers.length >= 2);

      const fearVector = audit.vectors.find(v => v.id === 'fear');
      assert.ok(fearVector && fearVector.score > 0);
    });

    it('should score low on calm, non-manipulative informative queries', () => {
      const text = 'What is the standard procedure to apply for an agricultural solar subsidy?';
      const audit = analyzeManipulationVectors(text);
      assert.equal(audit.overallIndex, 0);
      assert.equal(audit.threatLevel, 'Low');
    });
  });

  describe('6. Cryptographic Verification Certificates', () => {
    it('should generate a valid certificate with SHA-256 fingerprint and status', () => {
      const cert = generateVerificationCertificate(
        'DAM-2026-IND-1001',
        'Electricity disconnection notification from unofficial sender',
        { factualCorrectness: 'Contradicted', scamRisk: 'High', evidenceSufficiency: 'Sufficient' },
        ['Indian Electricity Act 2003 Section 56'],
        3
      );

      assert.ok(cert.certificateId.startsWith('CERT-DAM-2026-IND-1001-'));
      assert.equal(cert.status, 'VERIFIED_FRAUD');
      assert.equal(cert.sha256Fingerprint.length, 64);
      assert.ok(cert.qrPayload.includes(cert.certificateId));
      assert.ok(cert.issuingAuthority.includes('DAM Intelligence Engine'));
    });

    it('should set status to VERIFIED_AUTHENTIC for supported official circulars', () => {
      const cert = generateVerificationCertificate(
        'DAM-2026-IND-1002',
        'Official Gazette notification on green bonds',
        { factualCorrectness: 'Supported', scamRisk: 'Low', evidenceSufficiency: 'Sufficient' }
      );
      assert.equal(cert.status, 'VERIFIED_AUTHENTIC');
    });

    it('should set status to EVIDENCE_INSUFFICIENT for unverified claims', () => {
      const cert = generateVerificationCertificate(
        'DAM-2026-IND-1003',
        'Unconfirmed WhatsApp forward with no sources',
        { factualCorrectness: 'Unverified', scamRisk: 'Low', evidenceSufficiency: 'Insufficient' }
      );
      assert.equal(cert.status, 'EVIDENCE_INSUFFICIENT');
    });
  });

  describe('7. Smart Title Generation', () => {
    it('should generate accurate concise case titles for common Indian vectors', () => {
      assert.equal(generateSmartTitle('Dear consumer electricity power bill cut tonight'), 'Electricity Bill Disconnection Threat');
      assert.equal(generateSmartTitle('Install this SBI Yono APK immediately'), 'Malicious Banking APK Notice');
      assert.equal(generateSmartTitle('TRAI mobile number disconnected warning'), 'TRAI / DoT Mobile Number Threat');
      assert.equal(generateSmartTitle('CBI digital arrest warrant on video call'), 'Digital Arrest / CBI Extortion Call');
      assert.equal(generateSmartTitle('RBI ₹500 note demonetization currency ban'), 'RBI ₹500 Note Withdrawal Claim');
    });

    it('should strip conversational prompts cleanly', () => {
      const title = generateSmartTitle('Please verify if this circular from ministry is authentic');
      assert.ok(!title.toLowerCase().startsWith('please verify'));
    });
  });

  describe('8. Verifier Integration', () => {
    it('should delegate to verdict engine and return verdicts and challenger audit', () => {
      const sources: IndexedSource[] = [
        {
          id: 1,
          domain: 'rbi.org.in',
          title: 'RBI Official Notification',
          date: 'Feb 2026',
          type: 'Government',
          url: 'https://rbi.org.in/press/notice',
          passage: 'The policy has been duly notified and approved.',
          stance: 'supports'
        }
      ];

      const res = verifyAndChallenge('RBI policy notified', 'verification', sources);
      assert.ok(res.verdicts);
      assert.ok(res.claims);
      assert.ok(res.challengerAudit.length > 0);
      assert.equal(res.verdicts.factualCorrectness, 'Supported');
    });
  });
});
