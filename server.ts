import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

console.log("[SERVER_INIT] Orchestration Layer Loading...");

dotenv.config();

// Initialize Gemini
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

// Initialize Firebase Admin securely using environment variables
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (key.startsWith('{')) {
      const serviceAccount = JSON.parse(key);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin initialized successfully using Service Account.");
    } else {
      console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT_KEY is set but does not appear to be a JSON Service Account key.");
    }
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));

  // Body parser error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.error("[BODY_PARSER_ERROR] Malformed JSON in request body");
      return res.status(400).json({ error: "Malformed JSON payload" });
    }
    next();
  });

  app.use((req, res, next) => {
    console.log(`[REQUEST] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // Diagnostic endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "online", system: "OmniMind Core", timestamp: new Date().toISOString() });
  });

  app.get("/api/neural/health", (req, res) => {
    console.log("[HEALTH_CHECK] Responding to neural health query");
    res.json({ 
      status: "online", 
      gateway: "OmniMind Neural Matrix", 
      ai_available: !!ai,
      timestamp: new Date().toISOString()
    });
  });

  // Gemini Proxy Endpoint
  app.post("/api/neural/generate", async (req, res) => {
    console.log(`[AI_GATEWAY] Entering Generate Protocol: ${req.body?.model || 'unspecified'}`);
    try {
      if (!ai) {
        console.error("[AI_GATEWAY] Error: GEMINI_API_KEY missing or initialization failed");
        return res.status(503).json({ error: "Neural Core Offline: GEMINI_API_KEY is not configured." });
      }

      const { model, contents, config } = req.body;
      
      // Map models to robust versions according to skill guidelines
      const modelName = model?.includes('pro') ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      
      console.log(`[AI_GATEWAY] Dispatching to Model=${modelName}`);
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents || [],
        config: config || {}
      });

      const text = response.text;
      
      if (!text) {
        console.warn("[AI_GATEWAY] Warning: Received empty response from model");
        throw new Error("AI Protocol returned empty response sequence.");
      }

      console.log(`[AI_GATEWAY] Protocol Success: Received ${text.length} characters`);
      res.json({ text });
    } catch (error: any) {
      console.error("[AI_GATEWAY_ERROR]", error);
      const status = error.message?.includes('quota') || error.message?.includes('429') ? 429 : 500;
      res.status(status).json({ 
        error: error.message || "Neural Core Sync Failure",
        protocol: "GEMINI_v3_PREVIEW",
        code: error.status || status
      });
    }
  });

  // Explicitly catch all other API routes to prevent falling through to SPA fallback
  app.all("/api/*", (req, res) => {
    console.warn(`[404_API] Unmatched API Route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
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
