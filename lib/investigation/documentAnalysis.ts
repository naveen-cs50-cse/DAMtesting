import {
  DocumentAnalysis,
  DocumentAnomaly,
  DocumentPageFinding,
  RegulatoryMatch,
  ThreatEntities
} from './types';
import { performOcr } from './ocr';

export const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15MB maximum
export const MAX_DOCUMENT_PAGES = 30; // 30 pages maximum

export interface ByteValidationResult {
  valid: boolean;
  error?: string;
  detectedType: 'pdf' | 'png' | 'jpeg' | 'webp' | 'unknown';
  isPdf: boolean;
}

/**
 * Validates uploaded file bytes, magic byte signatures, extension, and size limit.
 */
export function validateDocumentBytes(
  buffer: Buffer,
  originalName: string,
  claimedType: string
): ByteValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: 'Empty file payload: 0 bytes received.',
      detectedType: 'unknown',
      isPdf: false
    };
  }

  // 1. Size Validation
  if (buffer.length > MAX_DOCUMENT_SIZE) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb}MB) exceeds the maximum allowed limit of 15MB.`,
      detectedType: 'unknown',
      isPdf: false
    };
  }

  // 2. Extension validation
  const lowerName = (originalName || '').toLowerCase();
  const ext = lowerName.split('.').pop() || '';
  const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Disallowed file extension .${ext}. Allowed extensions: .pdf, .png, .jpg, .jpeg, .webp.`,
      detectedType: 'unknown',
      isPdf: false
    };
  }

  // 3. Inspect actual magic bytes
  let detectedType: 'pdf' | 'png' | 'jpeg' | 'webp' | 'unknown' = 'unknown';

  // PDF Magic Bytes: "%PDF-" (0x25, 0x50, 0x44, 0x46, 0x2D) anywhere in the first 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 1024));
  const pdfIndex = headerSlice.indexOf(Buffer.from('%PDF-'));
  if (pdfIndex !== -1) {
    detectedType = 'pdf';
  } else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedType = 'png';
  } else if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    detectedType = 'jpeg';
  } else if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    detectedType = 'webp';
  }

  // Extension / MIME spoofing check
  if (ext === 'pdf' && detectedType !== 'pdf') {
    return {
      valid: false,
      error: 'File signature mismatch: File has .pdf extension but lacks standard %PDF- magic bytes.',
      detectedType,
      isPdf: false
    };
  }

  if (claimedType === 'application/pdf' && detectedType !== 'pdf') {
    return {
      valid: false,
      error: 'Content-Type mismatch: application/pdf declared, but uploaded bytes do not contain a valid PDF structure.',
      detectedType,
      isPdf: false
    };
  }

  if (detectedType === 'unknown') {
    return {
      valid: false,
      error: 'Unsupported binary payload: Magic bytes do not match PDF, PNG, JPEG, or WebP.',
      detectedType: 'unknown',
      isPdf: false
    };
  }

  return {
    valid: true,
    detectedType,
    isPdf: detectedType === 'pdf'
  };
}

/**
 * Extracts regulatory entities (circular numbers, authorities, dates, stamps, amounts).
 */
export function extractDocumentEntities(text: string): {
  circularNumbers: string[];
  authorities: string[];
  dates: string[];
  signaturesOrStamps: string[];
  urls: string[];
  phones: string[];
  amounts: string[];
} {
  // 1. Circular / Notification reference numbers
  const circularPatterns = [
    /\b(RBI\/\d{4}[-/]\d{2,4}\/\d+)\b/gi,
    /\b(F\.?\s*No\.?\s*[\w\d/.-]+)\b/gi,
    /\b(No\.?\s*[\d]+[-/][\w\d/.-]+)\b/gi,
    /\b(Notification\s+No\.?\s*[\w\d/.-]+)\b/gi,
    /\b(Circular\s+No\.?\s*[\w\d/.-]+)\b/gi,
    /\b(D\.?O\.?\s*No\.?\s*[\w\d/.-]+)\b/gi,
    /\b(Order\s+No\.?\s*[\w\d/.-]+)\b/gi,
    /\b(Ref(?:erence)?\.?\s*[:#]?\s*[\w\d/.-]+)\b/gi,
    /\b(TRAI\/[\w\d/.-]+)\b/gi,
    /\b(BESCOM\/[\w\d/.-]+)\b/gi
  ];

  const circularNumbers: string[] = [];
  for (const regex of circularPatterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const m of matches) {
        const clean = m.trim().replace(/^[,\s;]+|[,\s;]+$/g, '');
        if (clean.length >= 6 && !circularNumbers.includes(clean)) {
          circularNumbers.push(clean);
        }
      }
    }
  }

  // 2. Issuing Authorities
  const authorityPatterns = [
    'Reserve Bank of India',
    'Telecom Regulatory Authority of India',
    'Ministry of Finance',
    'Department of Telecommunications',
    'Press Information Bureau',
    'Central Board of Indirect Taxes and Customs',
    'Central Board of Direct Taxes',
    'Indian Computer Emergency Response Team',
    'CERT-In',
    'Unique Identification Authority of India',
    'Securities and Exchange Board of India',
    'State Electricity Regulatory Commission',
    'Central Bureau of Investigation',
    'Ministry of Home Affairs',
    'Indian Cyber Crime Coordination Centre',
    'Government of India'
  ];

  const authorities: string[] = [];
  for (const auth of authorityPatterns) {
    if (new RegExp(`\\b${auth.replace('-', '\\-')}\\b`, 'i').test(text)) {
      if (!authorities.includes(auth)) {
        authorities.push(auth);
      }
    }
  }

  // 3. Dates
  const dateRegex = /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,\s]+\d{4})\b|\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b|\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;
  const dates: string[] = [];
  const dateMatches = text.match(dateRegex);
  if (dateMatches) {
    for (const d of dateMatches) {
      const clean = d.trim();
      if (!dates.includes(clean)) dates.push(clean);
    }
  }

  // 4. Signatures, Seals, and Stamps
  const sigStampPatterns = [
    /\b(?:Digitally\s+signed\s+by\s+[\w\s.]+)/gi,
    /\b(?:e-?Sign\s+verified)/gi,
    /\b(?:Signed\s+by:?\s*[\w\s.]+)/gi,
    /\b(?:Authorized\s+Signatory)/gi,
    /\b(?:Chief\s+General\s+Manager)/gi,
    /\b(?:Under\s+Secretary\s+to\s+the\s+Govt\.?\s+of\s+India)/gi,
    /\b(?:Joint\s+Secretary)/gi,
    /\b(?:Deputy\s+General\s+Manager)/gi,
    /\b(?:Section\s+Officer)/gi,
    /\b(?:Official\s+Seal)/gi,
    /\b(?:Stamp\s+and\s+Signature)/gi
  ];

  const signaturesOrStamps: string[] = [];
  for (const regex of sigStampPatterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const m of matches) {
        const clean = m.trim();
        if (!signaturesOrStamps.includes(clean)) {
          signaturesOrStamps.push(clean);
        }
      }
    }
  }

  // 5. URLs
  const urlRegex = /\b(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+/gi;
  const urls: string[] = [];
  const urlMatches = text.match(urlRegex);
  if (urlMatches) {
    for (const u of urlMatches) {
      const clean = u.replace(/[.,;)]+$/, '');
      if (!urls.includes(clean)) urls.push(clean);
    }
  }

  // 6. Phone numbers
  const phoneRegex = /\b(?:\+91[-.\s]?)?[6-9]\d{9}\b|\b1800[-.\s]?\d{3}[-.\s]?\d{3,4}\b|\b1930\b/g;
  const phones: string[] = [];
  const phoneMatches = text.match(phoneRegex);
  if (phoneMatches) {
    for (const p of phoneMatches) {
      const clean = p.replace(/\s+/g, '');
      if (!phones.includes(clean)) phones.push(clean);
    }
  }

  // 7. Monetary Amounts
  const amountRegex = /(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{2})?(?:\s*(?:Crore|Lakh|thousand|cr|lakhs))?/gi;
  const amounts: string[] = [];
  const amountMatches = text.match(amountRegex);
  if (amountMatches) {
    for (const a of amountMatches) {
      const clean = a.trim();
      if (!amounts.includes(clean)) amounts.push(clean);
    }
  }

  return {
    circularNumbers,
    authorities,
    dates,
    signaturesOrStamps,
    urls,
    phones,
    amounts
  };
}

/**
 * Detects structural and regulatory inconsistencies in the document.
 * Strictly adheres to rule: Do not claim that a document is forged solely from visual heuristics.
 */
export function detectDocumentAnomalies(
  text: string,
  entities: ReturnType<typeof extractDocumentEntities>,
  hasAuthority: boolean,
  pageNum: number = 1
): DocumentAnomaly[] {
  const anomalies: DocumentAnomaly[] = [];
  const lower = text.toLowerCase();

  // 1. Mismatched Dates
  // Extract all 4-digit years from extracted dates
  const years = Array.from(
    new Set(
      entities.dates
        .map(d => {
          const match = d.match(/\b(20\d\d|19\d\d)\b/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((y): y is number => y !== null)
    )
  );

  if (years.length >= 2) {
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    // If the document claims a 2026 header but cites a 2016-2022 mandate without context
    if (maxYear - minYear >= 3 && !lower.includes('supersedes') && !lower.includes('amendment')) {
      const desc = `Temporal discrepancy identified: Document references conflicting calendar years (${minYear} vs ${maxYear}) without explicit amendment context.`;
      anomalies.push({
        type: 'mismatched_dates',
        severity: 'medium',
        description: desc,
        details: desc,
        pageNumber: pageNum,
        citation: `Years: ${years.join(', ')}`
      });
    }
  }

  // 2. Unofficial Domain on Government Letterhead
  const claimsOfficialGov =
    hasAuthority ||
    lower.includes('government of india') ||
    lower.includes('reserve bank of india') ||
    lower.includes('ministry of');

  if (claimsOfficialGov) {
    const freeMailMatches = text.match(/\b[\w.-]+@(gmail|yahoo|hotmail|outlook|rediffmail)\.com\b/gi);
    if (freeMailMatches) {
      const desc = `Unofficial public webmail provider (${freeMailMatches[0]}) listed as official administrative contact; Indian ministries mandatorily use official @nic.in or @gov.in domains.`;
      anomalies.push({
        type: 'unofficial_domain',
        severity: 'high',
        description: desc,
        details: desc,
        pageNumber: pageNum,
        citation: freeMailMatches[0]
      });
    }

    const suspiciousUrls = entities.urls.filter(u => {
      const lowerU = u.toLowerCase();
      return (
        lowerU.includes('bit.ly') ||
        lowerU.includes('tinyurl') ||
        lowerU.includes('.apk') ||
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(lowerU)
      );
    });

    if (suspiciousUrls.length > 0) {
      const desc = `Purported statutory notification contains unverified URL or direct application package download (${suspiciousUrls[0]}).`;
      anomalies.push({
        type: 'unofficial_domain',
        severity: 'high',
        description: desc,
        details: desc,
        pageNumber: pageNum,
        citation: suspiciousUrls[0]
      });
    }
  }

  // 3. Missing Reference Number
  const isPurportedGazetteOrOrder =
    lower.includes('gazette of india') ||
    lower.includes('extraordinary gazette') ||
    lower.includes('statutory order') ||
    lower.includes('public notice') ||
    lower.includes('master circular');

  if ((isPurportedGazetteOrOrder || claimsOfficialGov) && entities.circularNumbers.length === 0) {
    const desc = 'Absence of mandatory statutory file reference or circular identifier (e.g. F.No., Gazette ID) standard on official publications.';
    anomalies.push({
      type: 'missing_reference_number',
      severity: 'medium',
      description: desc,
      details: desc,
      pageNumber: pageNum,
      citation: 'No circular/file number extracted'
    });
  }

  // 4. Suspicious Urgency & Coercive Language
  const hasExtortionTone =
    (lower.includes('arrest') && lower.includes('immediately')) ||
    (lower.includes('disconnect') && lower.includes('tonight')) ||
    lower.includes('penalty will increase every hour') ||
    lower.includes('digital arrest warrant');

  if (hasExtortionTone) {
    const desc = 'Imminent threat or coercive penalty language detected, which diverges from standard administrative due process.';
    anomalies.push({
      type: 'suspicious_urgency',
      severity: 'high',
      description: desc,
      details: desc,
      pageNumber: pageNum,
      citation: 'Immediate penalty/arrest threat phrasing'
    });
  }

  return anomalies;
}

/**
 * Cross-references extracted identifiers against official regulatory schemas.
 */
export function crossCheckRegulatoryPatterns(
  circularNumber?: string | null,
  authority?: string | null,
  text: string = ''
): DocumentAnalysis['regulatoryCrossCheck'] {
  const lowerText = text.toLowerCase();

  if (circularNumber) {
    if (/^RBI\/\d{4}[-/]\d{2,4}\/\d+$/i.test(circularNumber)) {
      return {
        matchedKnownRegulatoryPattern: true,
        patternDescription: 'RBI Master Circular / Notification Numbering Specification',
        isRecognizedFormat: true,
        verificationNotice: `Format aligns with official Reserve Bank of India notification protocol. Primary record verification required via rbi.org.in.`
      };
    }

    if (/^F\.?\s*No\.?/i.test(circularNumber)) {
      return {
        matchedKnownRegulatoryPattern: true,
        patternDescription: 'Government of India Secretariat File Numbering Protocol (F.No.)',
        isRecognizedFormat: true,
        verificationNotice: 'Conforms to union ministry central secretariat file numbering standards.'
      };
    }
  }

  if (authority === 'Reserve Bank of India' && (lowerText.includes('500') || lowerText.includes('withdraw'))) {
    return {
      matchedKnownRegulatoryPattern: true,
      patternDescription: 'High-incidence viral currency rumor circular pattern',
      isRecognizedFormat: false,
      verificationNotice: 'Notice subject matches recurring PIB-debunked rumor regarding ₹500 banknote demonetization.'
    };
  }

  return {
    matchedKnownRegulatoryPattern: false,
    isRecognizedFormat: false,
    verificationNotice: 'Format does not match standard indexed union regulatory numbering schema.'
  };
}

function createDocumentAnalysisFallback(
  status: DocumentAnalysis['status'],
  error: string,
  summary: string,
  pageCount = 0
): DocumentAnalysis {
  return {
    status,
    error,
    errorDetails: error,
    pageCount,
    totalCharacters: 0,
    extractionMethod: 'failed',
    circularNumber: null,
    issuingAuthority: null,
    issueDate: null,
    dates: [],
    signaturesDetected: false,
    signatureDetails: [],
    stampsDetected: false,
    urls: [],
    phones: [],
    amounts: [],
    anomalies: [],
    pageFindings: [],
    pages: [],
    extractedIdentifiers: {
      circularNumber: null,
      circularNumbers: [],
      issuingAuthority: null,
      issuingAuthorities: [],
      issueDate: null,
      dates: [],
      urls: [],
      phones: [],
      amounts: [],
      monetaryAmounts: [],
      signatoryNames: [],
      stamps: [],
      signaturesOrStamps: []
    },
    regulatoryMatches: [],
    forensicSummary: summary,
    summary
  };
}

/**
 * Production-quality parser and analyzer for PDF documents.
 */
export async function analyzePdfDocument(
  buffer: Buffer,
  fileName: string,
  apiKey?: string
): Promise<DocumentAnalysis> {
  // 1. Byte and signature validation
  const byteValidation = validateDocumentBytes(buffer, fileName, 'application/pdf');
  if (!byteValidation.valid) {
    return createDocumentAnalysisFallback(
      'corrupted',
      byteValidation.error || 'Invalid file bytes',
      `Document analysis failed: ${byteValidation.error}`
    );
  }

  // 2. Load and parse PDF structure
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  try {
    await parser.load();
    const parsedTextResult = await parser.getText();
    const rawPages: Array<{ text: string; num: number }> = parsedTextResult.pages || [];
    const totalPages = parsedTextResult.total || rawPages.length || 1;

    // 3. Enforce maximum page limit
    if (totalPages > MAX_DOCUMENT_PAGES) {
      await parser.destroy().catch(() => {});
      return createDocumentAnalysisFallback(
        'oversized',
        `Document has ${totalPages} pages, exceeding the maximum allowed limit of ${MAX_DOCUMENT_PAGES} pages.`,
        `Document rejected: Page count (${totalPages}) exceeds maximum ceiling of ${MAX_DOCUMENT_PAGES} pages.`,
        totalPages
      );
    }

    // 4. Page-by-page text processing and OCR fallback check
    const pageFindings: DocumentPageFinding[] = [];
    let cumulativeText = '';
    let hasScannedPages = false;
    let hasDigitalPages = false;

    for (let i = 0; i < rawPages.length; i++) {
      const pageNum = rawPages[i].num || i + 1;
      let pageText = (rawPages[i].text || '').trim();
      const hasEmbeddedText = pageText.length >= 40;
      let ocrApplied = false;

      if (hasEmbeddedText) {
        hasDigitalPages = true;
      } else {
        hasScannedPages = true;
        // If page has almost no digital text, it is likely a scanned bitmap page
        if (apiKey) {
          try {
            // Attempt OCR on the scanned page
            const base64Page = `data:application/pdf;base64,${buffer.toString('base64')}`;
            const ocrRes = await performOcr(base64Page, 'application/pdf', apiKey);
            if (ocrRes.text && ocrRes.text.length > pageText.length) {
              pageText = ocrRes.text;
              ocrApplied = true;
            }
          } catch {
            // Safe fallback if vision OCR is unconfigured
          }
        }
      }

      cumulativeText += `\n[Page ${pageNum}]\n` + pageText;

      const pageEntities = extractDocumentEntities(pageText);
      const pageAnomalies = detectDocumentAnomalies(pageText, pageEntities, pageEntities.authorities.length > 0, pageNum);

      pageFindings.push({
        pageNumber: pageNum,
        hasEmbeddedText,
        wordCount: pageText ? pageText.split(/\s+/).filter(Boolean).length : 0,
        ocrApplied,
        charCount: pageText.length,
        extractedSnippet: pageText.slice(0, 180).replace(/\s+/g, ' '),
        circularNumbers: pageEntities.circularNumbers,
        authorities: pageEntities.authorities,
        dates: pageEntities.dates,
        signaturesOrStamps: pageEntities.signaturesOrStamps,
        signaturesDetected: pageEntities.signaturesOrStamps.length > 0,
        urls: pageEntities.urls,
        phones: pageEntities.phones,
        amounts: pageEntities.amounts,
        anomalies: pageAnomalies.map(a => a.description)
      });
    }

    await parser.destroy().catch(() => {});

    // 5. Aggregate document-wide entities & anomalies
    const documentEntities = extractDocumentEntities(cumulativeText);
    const anomalies = detectDocumentAnomalies(
      cumulativeText,
      documentEntities,
      documentEntities.authorities.length > 0,
      1
    );

    const primaryCircular = documentEntities.circularNumbers[0] || null;
    const primaryAuthority = documentEntities.authorities[0] || null;
    const primaryDate = documentEntities.dates[0] || null;
    const signaturesDetected = documentEntities.signaturesOrStamps.length > 0;
    const stampsDetected = documentEntities.signaturesOrStamps.some(s => /seal|stamp/i.test(s));

    const extractionMethod: DocumentAnalysis['extractionMethod'] =
      hasDigitalPages && hasScannedPages
        ? 'hybrid'
        : hasDigitalPages
        ? 'embedded_text'
        : 'ocr_transcribed';

    const regulatoryCrossCheck = crossCheckRegulatoryPatterns(
      primaryCircular,
      primaryAuthority,
      cumulativeText
    );

    // If completely blank / no extractable text
    if (cumulativeText.trim().length === 0) {
      const fallback = createDocumentAnalysisFallback(
        'unreadable',
        'Document contains no extractable text or legible scanned content.',
        'Document is blank, corrupted, or contains illegible bitmap images with no extractable text.',
        totalPages
      );
      fallback.pageFindings = pageFindings;
      fallback.pages = pageFindings;
      return fallback;
    }

    // Build structured, legally cautious summary
    const summaryParts: string[] = [];
    summaryParts.push(`Parsed ${totalPages} page(s) via ${extractionMethod.replace('_', ' ')} (${cumulativeText.length} characters).`);
    if (primaryAuthority) summaryParts.push(`Purported Authority: ${primaryAuthority}.`);
    if (primaryCircular) summaryParts.push(`Extracted Identifier: ${primaryCircular}.`);
    if (primaryDate) summaryParts.push(`Issue Date: ${primaryDate}.`);
    if (anomalies.length > 0) {
      summaryParts.push(`${anomalies.length} formatting/metadata anomaly(s) flagged for manual verification.`);
    } else {
      summaryParts.push('No obvious metadata or date formatting discrepancies detected.');
    }

    const regulatoryMatches: RegulatoryMatch[] = [];
    if (regulatoryCrossCheck) {
      regulatoryMatches.push({
        source: primaryAuthority || 'Union Regulatory Protocol',
        authority: primaryAuthority || 'Regulatory Authority',
        schemePattern: regulatoryCrossCheck.patternDescription || primaryCircular || 'Official Pattern',
        verified: regulatoryCrossCheck.matchedKnownRegulatoryPattern,
        status: regulatoryCrossCheck.matchedKnownRegulatoryPattern ? 'corroborated' : 'deviant',
        details: regulatoryCrossCheck.verificationNotice,
        notes: regulatoryCrossCheck.verificationNotice
      });
    }

    const signatoryNames = documentEntities.signaturesOrStamps.filter(s => !/seal|stamp/i.test(s));
    const stamps = documentEntities.signaturesOrStamps.filter(s => /seal|stamp/i.test(s));

    return {
      status: 'success',
      pageCount: totalPages,
      totalCharacters: cumulativeText.length,
      extractionMethod,
      circularNumber: primaryCircular,
      issuingAuthority: primaryAuthority,
      issueDate: primaryDate,
      dates: documentEntities.dates,
      signaturesDetected,
      signatureDetails: documentEntities.signaturesOrStamps,
      stampsDetected,
      urls: documentEntities.urls,
      phones: documentEntities.phones,
      amounts: documentEntities.amounts,
      anomalies,
      pageFindings,
      pages: pageFindings,
      extractedIdentifiers: {
        circularNumber: primaryCircular,
        circularNumbers: documentEntities.circularNumbers,
        issuingAuthority: primaryAuthority,
        issuingAuthorities: documentEntities.authorities,
        issueDate: primaryDate,
        dates: documentEntities.dates,
        urls: documentEntities.urls,
        phones: documentEntities.phones,
        amounts: documentEntities.amounts,
        monetaryAmounts: documentEntities.amounts,
        signatoryNames,
        stamps,
        signaturesOrStamps: documentEntities.signaturesOrStamps
      },
      regulatoryCrossCheck,
      regulatoryMatches,
      forensicSummary: summaryParts.join(' '),
      summary: summaryParts.join(' ')
    };
  } catch (err: unknown) {
    await parser.destroy().catch(() => {});
    const errMessage = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : '';

    if (errName === 'PasswordException' || errMessage.toLowerCase().includes('password')) {
      return createDocumentAnalysisFallback(
        'encrypted',
        'Document is password-protected or encrypted. Please upload an unlocked PDF.',
        'Document cannot be processed because it is encrypted with a password.'
      );
    }

    return createDocumentAnalysisFallback(
      'corrupted',
      `PDF parsing error: ${errMessage}`,
      `PDF is corrupted or structurally damaged: ${errMessage}`
    );
  }
}

/**
 * Extracts all threat entities from document analysis for downstream forensic modules.
 */
export function extractThreatEntitiesFromDocument(analysis: DocumentAnalysis): ThreatEntities {
  return {
    phones: analysis.phones,
    urls: analysis.urls,
    amounts: analysis.amounts
  };
}
