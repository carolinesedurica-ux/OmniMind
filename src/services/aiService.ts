import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  // 1. Try Environment Variables
  let apiKey = (typeof process !== 'undefined' && (process.env.API_KEY || process.env.GEMINI_API_KEY)) || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  // 2. Try Session Storage Fallback (for testing Vercel without redeploy)
  if (!apiKey && typeof window !== 'undefined') {
    apiKey = window.sessionStorage.getItem('OMNIMIND_AI_KEY');
  }

  if (!apiKey) {
    if (typeof window !== 'undefined') {
      if ((window as any).aistudio?.openSelectKey) {
        (window as any).aistudio.openSelectKey();
      }
      
      const isVercel = window.location.hostname.includes('vercel.app');
      if (isVercel) {
        throw new Error("API Key Missing: Set GEMINI_API_KEY in Vercel Environment Variables (prefixed with VITE_ for client-side) and redeploy. Alternatively, use window.sessionStorage.setItem('OMNIMIND_AI_KEY', 'YOUR_KEY') in the console for temporary access.");
      }
    }
    throw new Error("Neural Core Offline: No API key found. Configure GEMINI_API_KEY to enable synthesis.");
  }
  return new GoogleGenAI({ apiKey });
};

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
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data: base64, mimeType } },
        { text: `Analyze this file. Produce a comprehensive extraction in JSON format.
        Include a title, summary, transcript/breakdown (broken into segments with speaker and topic), key topics, and key quotes.
        Respond ONLY with a JSON object following the schema.` }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          doc_type: { type: Type.STRING },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          language: { type: Type.STRING },
          speakers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                role: { type: Type.STRING }
              },
              required: ["id", "name"]
            }
          },
          transcript_segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.STRING },
                end: { type: Type.STRING },
                speaker: { type: Type.STRING },
                text: { type: Type.STRING },
                topic: { type: Type.STRING }
              },
              required: ["start", "end", "speaker", "text", "topic"]
            }
          },
          key_topics: { type: Type.ARRAY, items: { type: Type.STRING } },
          key_quotes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                location: { type: Type.STRING }
              },
              required: ["text", "location"]
            }
          }
        },
        required: ["doc_type", "title", "summary", "language", "speakers", "transcript_segments", "key_topics", "key_quotes"]
      }
    }
  });

  const content = JSON.parse(response.text || "{}");
  return {
    ...content,
    speakers: content.speakers || [],
    transcript_segments: content.transcript_segments || [],
    key_topics: content.key_topics || [],
    key_quotes: content.key_quotes || []
  };
};

export const indexData = async (ingestionJson: string): Promise<IndexingResult> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{
      role: 'user',
      parts: [{
        text: `From this ingestion payload, extract structured entities, relationships, risks, obligations, and deadlines. 
        Respond ONLY with a JSON object.
        
        INGESTION:
        ${ingestionJson.slice(0, 50000)}`
      }]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                mentions: { type: Type.ARRAY, items: { type: Type.STRING } },
                context: { type: Type.STRING }
              },
              required: ["name", "type", "mentions", "context"]
            }
          },
          risks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                severity: { type: Type.STRING },
                evidence: { type: Type.STRING },
                rationale: { type: Type.STRING }
              },
              required: ["title", "severity", "evidence", "rationale"]
            }
          },
          obligations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                party: { type: Type.STRING },
                obligation: { type: Type.STRING },
                evidence: { type: Type.STRING }
              }
            }
          },
          deadlines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                date_iso: { type: Type.STRING },
                evidence: { type: Type.STRING }
              }
            }
          }
        },
        required: ["entities", "risks"]
      }
    }
  });

  const content = JSON.parse(response.text || "{}");
  return {
    ...content,
    entities: content.entities || [],
    risks: content.risks || [],
    obligations: content.obligations || [],
    deadlines: content.deadlines || []
  };
};

export const askWorkspace = async (question: string, context: string): Promise<any> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{
      role: 'user',
      parts: [{
        text: `QUESTION: ${question}\n\nCONTEXT:\n${context.slice(0, 80000)}\n\nProvide grounded answer with citations. JSON format.`
      }]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          confidence: { type: Type.STRING },
          citations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                quote: { type: Type.STRING },
                location: { type: Type.STRING },
                why: { type: Type.STRING }
              }
            }
          }
        },
        required: ["answer", "confidence", "citations"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateExecutiveBrief = async (workspaceContext: string, focus?: string): Promise<any> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{
      role: 'user',
      parts: [{
        text: `Produce an executive brief for a leadership team.\nFOCUS: ${focus || 'General executive summary'}\n\nWORKSPACE CONTEXT:\n${workspaceContext.slice(0, 80000)}\n\nRespond ONLY with a JSON object.`
      }]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          tldr: { type: Type.STRING },
          key_findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          risk_summary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                risk: { type: Type.STRING },
                severity: { type: Type.STRING }
              }
            }
          },
          recommended_actions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                priority: { type: Type.STRING },
                owner: { type: Type.STRING }
              }
            }
          },
          next_steps_email: { type: Type.STRING }
        },
        required: ["title", "tldr", "key_findings", "risk_summary", "recommended_actions", "next_steps_email"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};


