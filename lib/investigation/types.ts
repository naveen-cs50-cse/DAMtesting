export type FactualCorrectness = 'Supported' | 'Contradicted' | 'Mixed' | 'Unverified';
export type ScamRisk = 'Low' | 'Medium' | 'High';
export type EvidenceSufficiency = 'Sufficient' | 'Partial' | 'Insufficient';
export type TaskType = 'verification' | 'scam_check' | 'research' | 'document_analysis' | 'conversational';

export interface ThreatEntities {
  phones?: string[];
  urls?: string[];
  senderIds?: string[];
  amounts?: string[];
}

export interface DocumentPageFinding {
  pageNumber: number;
  hasEmbeddedText: boolean;
  charCount: number;
  wordCount: number;
  ocrApplied: boolean;
  extractedSnippet: string;
  circularNumbers: string[];
  authorities: string[];
  dates: string[];
  signaturesOrStamps: string[];
  signaturesDetected: boolean;
  urls: string[];
  phones: string[];
  amounts: string[];
  anomalies: string[];
}

export interface DocumentAnomaly {
  type: string;
  severity: string;
  description: string;
  citation?: string;
  pageNumber: number;
  details: string;
}

export interface RegulatoryMatch {
  source?: string;
  authority: string;
  schemePattern: string;
  verified: boolean;
  status: 'corroborated' | 'deviant' | 'suspicious' | string;
  details?: string;
  notes: string;
  url?: string;
}

export interface DocumentExtractedIdentifiers {
  circularNumber?: string | null;
  circularNumbers: string[];
  issuingAuthority?: string | null;
  issuingAuthorities: string[];
  issueDate?: string | null;
  dates: string[];
  urls: string[];
  phones: string[];
  amounts: string[];
  monetaryAmounts: string[];
  signatoryNames: string[];
  stamps: string[];
  signaturesOrStamps: string[];
}

export interface DocumentAnalysis {
  status: 'success' | 'scanned_fallback' | 'encrypted' | 'corrupted' | 'unreadable' | 'oversized' | string;
  error?: string;
  errorDetails?: string;
  pageCount: number;
  totalCharacters: number;
  extractionMethod: 'embedded_text' | 'ocr_transcribed' | 'hybrid' | 'failed' | string;
  circularNumber?: string | null;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  dates: string[];
  signaturesDetected: boolean;
  signatureDetails: string[];
  stampsDetected: boolean;
  urls: string[];
  phones: string[];
  amounts: string[];
  anomalies: DocumentAnomaly[];
  pageFindings: DocumentPageFinding[];
  pages: DocumentPageFinding[];
  extractedIdentifiers: DocumentExtractedIdentifiers;
  regulatoryCrossCheck?: {
    matchedKnownRegulatoryPattern: boolean;
    patternDescription?: string;
    isRecognizedFormat: boolean;
    verificationNotice: string;
  };
  regulatoryMatches: RegulatoryMatch[];
  forensicSummary: string;
  summary: string;
}

export interface UrlAnalysisResult {
  url: string;
  finalUrl: string;
  canonicalUrl?: string;
  domain: string;
  status: 'success' | 'blocked' | 'deleted' | 'private' | 'timeout' | 'ssrf_blocked' | 'error';
  statusCode?: number;
  redirectHistory: string[];
  title?: string;
  author?: string;
  publishedDate?: string;
  extractedText: string;
  wordCount: number;
  isSocialPost?: boolean;
  socialPlatform?: 'twitter' | 'reddit' | 'youtube' | 'telegram' | 'other';
  outgoingLinks: string[];
  downloadLinks: string[];
  domainRisk: {
    isPunycode: boolean;
    hasHomoglyphs: boolean;
    isDeceptiveSubdomain: boolean;
    typosquatTarget?: string;
    riskLevel: 'Low' | 'Medium' | 'High';
    warnings: string[];
  };
  claims: string[];
  errorDetails?: string;
}

export interface Attachment {
  id?: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  preview?: string;
  previewUrl?: string;
  isUrl?: boolean;
  extractedText?: string;
  ocrStatus?: 'pending' | 'success' | 'failed' | 'empty';
  threatEntities?: ThreatEntities;
  documentAnalysis?: DocumentAnalysis;
  urlAnalysis?: UrlAnalysisResult;
}

export interface ClaimFinding {
  claim: string;
  label: FactualCorrectness;
  supporting: string;
  contradicting: string;
}

export interface SourceImpact {
  sourceId: number;
  domain: string;
  authorityWeight: number;
  relevanceScore: number;
  recencyScore: number;
  stance: 'supports' | 'contradicts' | 'context';
  impactRole: 'primary_contradiction' | 'primary_support' | 'corroborating' | 'contextual' | 'insufficient_relevance' | 'neutral_context';
  explanation: string;
}

export interface VerdictExplanation {
  summary: string;
  factualRationale: string;
  scamRationale: string;
  sufficiencyRationale: string;
  sourceImpacts: SourceImpact[];
}

export interface IndexedSource {
  id: number;
  domain: string;
  title: string;
  date: string;
  type: 'Government' | 'Fact-checker' | 'News' | 'Registry';
  url: string;
  passage: string;
  stance: 'supports' | 'contradicts' | 'context';
  authorityScore?: number;
  relevanceScore?: number;
  recencyScore?: number;
  impactRole?: SourceImpact['impactRole'];
  impactExplanation?: string;
  isFixture?: boolean;
}

export interface InvestigationVerdicts {
  factualCorrectness: FactualCorrectness;
  scamRisk: ScamRisk;
  evidenceSufficiency: EvidenceSufficiency;
  riskTriggers: string[];
  explanation?: VerdictExplanation;
}

export interface ActivityStage {
  id: 'analyze' | 'search' | 'read' | 'challenger' | 'synthesize';
  title: string;
  status: 'running' | 'completed' | 'failed';
  summary?: string;
  details?: {
    taskType?: TaskType;
    queries?: string[];
    attachmentsCount?: number;
    sources?: unknown[];
    passages?: string[];
    challengerAudit?: string[];
    explanation?: VerdictExplanation;
    [key: string]: unknown;
  };
}

export interface InvestigationMeta {
  caseId: string;
  taskType: TaskType;
  verdicts: InvestigationVerdicts;
  claims: ClaimFinding[];
  sources: IndexedSource[];
  challengerAudit: string[];
  verdictExplanation?: VerdictExplanation;
  forensics?: import('./forensics').EntityForensics;
  incidentReport?: import('./incidentReport').IncidentReport | null;
  manipulationAudit?: import('./manipulation').ManipulationAudit;
  statutes?: import('./statutes').StatutoryAudit;
  certificate?: import('./certificate').VerificationCertificate;
  documentAnalysis?: DocumentAnalysis;
  urlAnalysis?: UrlAnalysisResult;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  attachments?: Attachment[];
  createdAt: string;
  fullText?: string;
  stages?: ActivityStage[];
  meta?: InvestigationMeta | null;
  isLive?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  caseId: string;
  createdAt: string;
  turns: ChatTurn[];
  isPinned?: boolean;
  folderId?: string | null;
}
