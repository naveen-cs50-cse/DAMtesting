export type FactualCorrectness = 'Supported' | 'Contradicted' | 'Mixed' | 'Unverified';
export type ScamRisk = 'Low' | 'Medium' | 'High';
export type EvidenceSufficiency = 'Sufficient' | 'Partial' | 'Insufficient';
export type TaskType = 'verification' | 'scam_check' | 'research' | 'document_analysis';

export interface Attachment {
  name: string;
  type: string;
  size: number;
  url?: string;
  preview?: string;
  isUrl?: boolean;
}

export interface ClaimFinding {
  claim: string;
  label: FactualCorrectness;
  supporting: string;
  contradicting: string;
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
}

export interface InvestigationVerdicts {
  factualCorrectness: FactualCorrectness;
  scamRisk: ScamRisk;
  evidenceSufficiency: EvidenceSufficiency;
  riskTriggers: string[];
}

export interface ActivityStage {
  id: 'analyze' | 'search' | 'read' | 'challenger' | 'synthesize';
  title: string;
  status: 'running' | 'completed' | 'failed';
  summary?: string;
  details?: Record<string, any>;
}

export interface InvestigationMeta {
  caseId: string;
  taskType: TaskType;
  verdicts: InvestigationVerdicts;
  claims: ClaimFinding[];
  sources: IndexedSource[];
  challengerAudit: string[];
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

export interface Conversation {
  id: string;
  title: string;
  caseId: string;
  createdAt: string;
  turns: ChatTurn[];
}
