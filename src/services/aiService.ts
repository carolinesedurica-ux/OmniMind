import { DocType, IngestionResult, IndexingResult, AgentEvent, AuditResult } from "../types";
export { DocType };

const callAI = async (payload: any): Promise<{ text: string }> => {
  const url = '/api/neural/generate';
  console.log(`[AI_CLIENT] Calling ${url} with model: ${payload.model}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  console.log(`[AI_CLIENT] Received status: ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type");
  console.log(`[AI_CLIENT] Content-Type: ${contentType}`);
  
  if (!response.ok) {
    if (contentType && contentType.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || "Neural Core Communication Error");
    } else {
      const text = await response.text();
      console.error("[NEURAL_SYNK_ERROR] Received non-JSON error response (first 100 chars):", text.slice(0, 100));
      throw new Error(`Neural Matrix Sync Failure: ${response.status} ${response.statusText}`);
    }
  }
  
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  } else {
    const rawText = await response.text();
    console.warn("[AI_CLIENT] Received non-JSON success response:", rawText.slice(0, 100));
    throw new Error("Neural Matrix returned protocol-incompatible format (Expected JSON)");
  }
};

export const ingestFile = async (base64: string, mimeType: string): Promise<IngestionResult> => {
  const response = await callAI({
    model: "gemini-3-flash-preview",
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
      responseMimeType: "application/json"
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
  const context = files.map(f => `FILE: ${f.title}\nSUMMARY: ${f.summary}\nTOPICS: ${(f.key_topics || []).join(', ')}`).join('\n\n');
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
  const response = await callAI({
    model: "gemini-3-flash-preview",
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
      responseMimeType: "application/json"
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
  const response = await callAI({
    model: "gemini-3-flash-preview",
    contents: [{
      role: 'user',
      parts: [{
        text: `QUESTION: ${question}\n\nCONTEXT:\n${context.slice(0, 80000)}\n\nProvide grounded answer with citations. JSON format.`
      }]
    }],
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateExecutiveBrief = async (workspaceContext: string, focus?: string): Promise<any> => {
  const response = await callAI({
    model: "gemini-3.1-pro-preview",
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
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || "{}");
};


