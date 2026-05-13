import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: '100mb' }));

  // AI API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Omni Mind API" });
  });

  app.post("/api/ai/ingest", async (req, res) => {
    try {
      const { base64, mimeType } = req.body;
      const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType } },
        { text: `Analyze this file end-to-end. Produce a comprehensive structured extraction in JSON format.
        Include a concise title, an executive summary (8-12 sentences), a transcript OR structured breakdown of content, key topics, and key quotes.
        For video/audio: use HH:MM:SS timestamps. For PDF/text: use "page N" or "section: <heading>".
        Respond ONLY with a JSON object.` }
      ]);
      
      const responseText = result.response.text();
      // Clean up markdown if present
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (error) {
      console.error("Ingestion failed:", error);
      res.status(500).json({ error: "Ingestion failed" });
    }
  });

  app.post("/api/ai/index", async (req, res) => {
    try {
      const { ingestionJson } = req.body;
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await model.generateContent(`From this ingestion payload, extract structured entities, relationships, risks, obligations, and deadlines. 
      Cite evidence locations exactly. 
      Entity types: person, vendor, organization, project, product, risk, deadline, obligation, location, financial.
      Respond ONLY with a JSON object.
      
      INGESTION:
      ${ingestionJson.slice(0, 50000)}`);
      
      const responseText = result.response.text();
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (error) {
      console.error("Indexing failed:", error);
      res.status(500).json({ error: "Indexing failed" });
    }
  });

  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { question, context } = req.body;
      const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const result = await model.generateContent(`QUESTION: ${question}
      
      CONTEXT:
      ${context.slice(0, 80000)}
      
      Provide a grounded answer with citations. Respond ONLY with a JSON object containing 'answer', 'confidence', 'citations', 'contradictions', and 'follow_up_questions'.`);
      
      const responseText = result.response.text();
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (error) {
      console.error("Query failed:", error);
      res.status(500).json({ error: "Query failed" });
    }
  });

  app.post("/api/ai/action", async (req, res) => {
    try {
      const { workspaceContext, focus } = req.body;
      const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      const result = await model.generateContent(`Produce an executive brief for a leadership team based on this workspace context.
      FOCUS: ${focus || 'General executive summary'}
      
      WORKSPACE CONTEXT:
      ${workspaceContext.slice(0, 80000)}
      
      Respond ONLY with a JSON object containing 'title', 'tldr', 'key_findings', 'risk_summary', 'missing_evidence', 'recommended_actions', and 'next_steps_email'.`);
      
      const responseText = result.response.text();
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (error) {
      console.error("Action agent failed:", error);
      res.status(500).json({ error: "Action agent failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
