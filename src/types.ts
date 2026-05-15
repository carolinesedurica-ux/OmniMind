export enum DocType {
  VIDEO = 'video',
  AUDIO = 'audio',
  PDF = 'pdf',
  TEXT = 'text'
}

export interface IngestionResult {
  doc_type: DocType;
  title: string;
  summary: string;
  language: string;
  speakers: { id: string; name: string; role?: string }[];
  transcript_segments: { start: string; end: string; speaker: string; text: string; topic: string }[];
  key_topics: string[];
  key_quotes: { text: string; location: string }[];
}

export interface IndexingResult {
  entities: { name: string; type: string; mentions: string[]; context: string }[];
  risks: { title: string; severity: 'high' | 'medium' | 'low'; evidence: string; rationale: string }[];
  obligations: { party: string; obligation: string; evidence: string }[];
  deadlines: { label: string; date_iso: string; evidence: string }[];
}

export interface AgentEvent {
  agent: string;
  action: string;
  status: 'working' | 'completed' | 'error';
  timestamp: string;
}

export interface AuditResult extends IndexingResult {
  trace: AgentEvent[];
}
