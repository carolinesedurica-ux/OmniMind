import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export const ingestFile = async (base64: string, mimeType: string): Promise<IngestionResult> => {
  const response = await fetch('/api/ai/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType })
  });
  if (!response.ok) throw new Error('Ingestion failed');
  return response.json();
};

export const indexData = async (ingestionJson: string): Promise<IndexingResult> => {
  const response = await fetch('/api/ai/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingestionJson })
  });
  if (!response.ok) throw new Error('Indexing failed');
  return response.json();
};

export const askWorkspace = async (question: string, context: string): Promise<any> => {
  const response = await fetch('/api/ai/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context })
  });
  if (!response.ok) throw new Error('Query failed');
  return response.json();
};

export const generateExecutiveBrief = async (workspaceContext: string, focus?: string): Promise<any> => {
  const response = await fetch('/api/ai/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceContext, focus })
  });
  if (!response.ok) throw new Error('Action generation failed');
  return response.json();
};
