import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDocumentBytes,
  extractDocumentEntities,
  detectDocumentAnomalies,
  crossCheckRegulatoryPatterns,
  analyzePdfDocument,
} from '../lib/investigation/documentAnalysis';

// Helper to create a minimal valid text PDF
function createMinimalPdf(textContent: string): Buffer {
  const streamContent = `BT\n/F1 12 Tf\n72 712 Td\n(${textContent.replace(/[()\\]/g, '\\$&')}) Tj\nET`;
  const pdfStr = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamContent.length} >>
stream
${streamContent}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000370 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
450
%%EOF`;
  return Buffer.from(pdfStr);
}

test('Document Analysis: validateDocumentBytes enforces MIME signatures, extensions, and limits', () => {
  // Valid PDF header
  const validPdfBytes = Buffer.from('%PDF-1.4 sample content');
  const validRes = validateDocumentBytes(validPdfBytes, 'circular.pdf', 'application/pdf');
  assert.equal(validRes.valid, true);
  assert.equal(validRes.detectedType, 'pdf');
  assert.equal(validRes.isPdf, true);

  // Extension spoofing (fake .pdf extension with HTML bytes)
  const fakePdfBytes = Buffer.from('<html><body>Hello</body></html>');
  const spoofedRes = validateDocumentBytes(fakePdfBytes, 'spoofed.pdf', 'application/pdf');
  assert.equal(spoofedRes.valid, false);
  assert.ok(spoofedRes.error?.includes('File signature mismatch'));

  // Oversized byte validation
  const hugeBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB > 15MB limit
  hugeBuffer.write('%PDF-1.4');
  const hugeRes = validateDocumentBytes(hugeBuffer, 'huge.pdf', 'application/pdf');
  assert.equal(hugeRes.valid, false);
  assert.ok(hugeRes.error?.includes('exceeds the maximum allowed limit of 15MB'));
});

test('Document Analysis: Entity extraction parses circular numbers, dates, authorities, and amounts', () => {
  const sampleGazetteText = `
    RESERVE BANK OF INDIA
    CENTRAL OFFICE, MUMBAI
    Circular No: RBI/2026-27/04/DOR.STR.REC.09/21.04.048/2026-27
    Date: 12th April 2026
    Notification regarding withdrawal of banknotes under Section 24 of the RBI Act.
    Penalty amount: Rs. 50,000 for non-compliance.
    Helpline: 022-22601000 or visit https://rbi.org.in
    Authorized Signatory: Chief General Manager
  `;

  const entities = extractDocumentEntities(sampleGazetteText);
  assert.ok(entities.circularNumbers.length > 0, 'Should extract RBI circular number');
  assert.ok(entities.circularNumbers[0].includes('RBI/2026-27'), 'Circular number should match pattern');
  assert.ok(entities.authorities.includes('Reserve Bank of India'), 'Authority should be RBI');
  assert.ok(entities.dates.length > 0, 'Dates should be extracted');
  assert.ok(entities.amounts.length > 0, 'Monetary amounts should be parsed');
  assert.ok(entities.urls.includes('https://rbi.org.in'), 'URL should be extracted');
  assert.ok(entities.signaturesOrStamps.includes('Chief General Manager'), 'Signatory should be detected');
});

test('Document Analysis: Anomaly detection flags mismatched dates, unofficial webmail, and coercive urgency', () => {
  const suspiciousText = `
    GOVERNMENT OF INDIA
    MINISTRY OF FINANCE
    Contact our nodal officer at: mofficial@gmail.com
    Date of issuance: 12-05-2026
    Effective implementation date: 01-01-2023
    Pay your outstanding arrears within 2 hours or your electricity will be disconnected tonight.
  `;

  const entities = extractDocumentEntities(suspiciousText);
  const anomalies = detectDocumentAnomalies(suspiciousText, entities, true);
  const types = anomalies.map(a => a.type);

  assert.ok(types.includes('unofficial_domain'), 'Should flag @gmail.com on official government letterhead');
  assert.ok(types.includes('mismatched_dates'), 'Should flag contradictory chronology between 2026 and 2023');
  assert.ok(types.includes('suspicious_urgency'), 'Should flag 2-hour disconnection coercion');
  assert.ok(types.includes('missing_reference_number'), 'Should flag missing formal gazette / file reference');
});

test('Document Analysis: Regulatory pattern matching corroborates RBI and union notifications', () => {
  const rbiText = 'Reserve Bank of India Master Direction on Know Your Customer';
  const match = crossCheckRegulatoryPatterns('RBI/2026-27/18', 'Reserve Bank of India', rbiText);
  assert.ok(match);
  assert.equal(match.matchedKnownRegulatoryPattern, true);
  assert.equal(match.isRecognizedFormat, true);
  assert.ok(match.patternDescription?.includes('RBI Master Circular'));
});

test('Document Analysis: analyzePdfDocument handles text PDFs correctly', async () => {
  const pdfBytes = createMinimalPdf(
    'RESERVE BANK OF INDIA RBI/2026-27/04/DOR Dated: 12-04-2026 Amount: Rs 50,000 Signatory: CGM'
  );

  const res = await analyzePdfDocument(pdfBytes, 'rbi_order.pdf');
  assert.equal(res.status, 'success');
  assert.equal(res.pageCount, 1);
  assert.ok(res.pageFindings.length === 1);
  assert.equal(res.pageFindings[0].hasEmbeddedText, true);
  assert.ok(res.circularNumber?.includes('RBI/2026-27'));
  assert.equal(res.issuingAuthority, 'Reserve Bank of India');
});

test('Document Analysis: Safe failure states for corrupted PDFs', async () => {
  const corruptedBytes = Buffer.from('%PDF-1.4\nCorrupted binary garbage without PDF trailer');
  const res = await analyzePdfDocument(corruptedBytes, 'corrupt.pdf');
  assert.equal(res.status, 'corrupted');
  assert.ok(res.error?.includes('PDF parsing error'));
});

test('Document Analysis: Non-forgery language guarantee', async () => {
  const suspiciousText = `
    MINISTRY OF COMMUNICATIONS
    Email us at: support@gmail.com
    Immediate payment required within 1 hour.
  `;
  const pdfBytes = createMinimalPdf(suspiciousText);
  const res = await analyzePdfDocument(pdfBytes, 'suspicious.pdf');

  // Ensure forensic summary does NOT accuse of forgery solely from heuristics
  assert.ok(res.anomalies.length > 0);
  assert.ok(res.summary.includes('flagged for manual verification'));
  assert.doesNotMatch(res.summary, /this document is a forgery/i);
  assert.doesNotMatch(res.summary, /this document is forged/i);
});
