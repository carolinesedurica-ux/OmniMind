import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = (typeof process !== 'undefined' && (process.env.API_KEY || process.env.GEMINI_API_KEY)) || 
                 (import.meta as any).env?.VITE_GEMINI_API_KEY ||
                 (typeof window !== 'undefined' && window.sessionStorage.getItem('OMNIMIND_AI_KEY'));

  if (!apiKey) {
    if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
      (window as any).aistudio.openSelectKey();
    }
    throw new Error("Neural Core Offline: GEMINI_API_KEY missing. Access denied.");
  }
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
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
    model: "gemini-1.5-flash",
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data: base64, mimeType } },
        { text: `System Command: You are a Deep Extraction Agent specializing in Enterprise Dark Data.
        Perform a high-fidelity multimodal analysis of the attached file.
        
        TASKS:
        1. Contextual Reconstruction: Reconstruct the core narrative or technical objective.
        2. Entity Matrix: Identify every stakeholder, technical component, project ID, and legal entity.
        3. Neural Segmentation: Break the content into logical segments with precise timestamps (if applicable) and thematic tags.
        4. Intelligence Synthesis: Core summary, key topics, and high-impact quotes with exact locations.
        
        Respond ONLY with a JSON object.` }
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

export interface AgentEvent {
  agent: string;
  action: string;
  status: 'working' | 'completed' | 'error';
  timestamp: string;
}

export interface AuditResult extends IndexingResult {
  trace: AgentEvent[];
}

export const runMultiAgentAudit = async (files: any[], onEvent?: (event: AgentEvent) => void): Promise<AuditResult> => {
  const trace: AgentEvent[] = [];
  const addEvent = (agent: string, action: string, status: 'working' | 'completed' | 'error' = 'working') => {
    const event = { agent, action, status, timestamp: new Date().toISOString() };
    trace.push(event);
    if (onEvent) onEvent(event);
  };

  addEvent('ORCHESTRATOR', 'Analyzing workspace context and initializing sub-agents');
  
  // 1. Data Aggregation
  addEvent('INGEST_AGENT', 'Aggregating cross-document fragments');
  const context = files.map(f => `FILE: ${f.title}\nSUMMARY: ${f.summary}\nTOPICS: ${f.key_topics.join(', ')}`).join('\n\n');
  addEvent('INGEST_AGENT', 'Context mapping completed', 'completed');

  // 2. Specialized Specialist Calls (Parallelized)
  addEvent('COMPLIANCE_AGENT', 'Scanning for regulatory risks and obligations');
  addEvent('ENTITY_AGENT', 'Extracting high-value technical entities');
  
  const [indexing, strategist] = await Promise.all([
    indexData(context),
    generateExecutiveBrief(context, "Full Enterprise Audit")
  ]);

  addEvent('COMPLIANCE_AGENT', 'Risk assessment finished', 'completed');
  addEvent('ENTITY_AGENT', 'Entity mapping finalized', 'completed');
  
  addEvent('STRATEGIST_AGENT', 'Synthesizing final executive intelligence');
  addEvent('STRATEGIST_AGENT', 'Brief generation complete', 'completed');

  addEvent('ORCHESTRATOR', 'Audit finalized. Outputting results stream.', 'completed');

  return {
    ...indexing,
    trace
  };
};

export const indexData = async (ingestionJson: string): Promise<IndexingResult> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{
      role: 'user',
      parts: [{
        text: `System Command: You are the Relational Intelligence Agent.
        Your task is to ingest raw multmodal extractions and synthesize a coherent knowledge graph.
        
        REQUIRED OUTPUTS:
        - Entities: People, organizations, technologies, and projects mentioned.
        - Risk Ledger: Forensic identification of operational, legal, or technical risks with severity.
        - Obligations: Explicit commitments or requirements discovered in the data.
        - Deadlines: Chronological milestones with supporting evidence.
        
        Respond ONLY with a JSON object.
        
        INGESTION SOURCE:
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
    model: "gemini-1.5-flash",
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
    model: "gemini-1.5-pro",
    contents: [{
      role: 'user',
      parts: [{
        text: `You are the OmniMind Strategic Briefing Agent. 
        Produce a high-precision executive brief for a leadership team based on the following raw data.
        Perform a rigorous risk audit and identify mission-critical recommended actions.
        
        FOCUS: ${focus || 'General executive summary'}
        
        WORKSPACE CONTEXT:
        ${workspaceContext.slice(0, 1000000)}
        
        Respond ONLY with a JSON object.`
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


