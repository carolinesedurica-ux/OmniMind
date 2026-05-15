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

  app.use((req, res, next) => {
    console.log(`[REQUEST] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // Diagnostic endpoint
  app.get("/api/neural/health", (req, res) => {
    console.log("[HEALTH_CHECK] Responding to health query");
    res.json({ 
      status: "online", 
      gateway: "OmniMind Neural Matrix", 
      ai_available: !!ai,
      timestamp: new Date().toISOString()
    });
  });

  // Gemini Proxy Endpoint - Renamed for clarity and to avoid any potential proxy collision
  app.post("/api/neural/generate", async (req, res) => {
    console.log(`[AI_GATEWAY] Entering Generate Protocol: ${req.body?.model || 'default'}`);
    try {
      if (!ai) {
        console.error("[AI_GATEWAY] Error: GEMINI_API_KEY missing");
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

  // Catch-all for API routes to diagnose 404s
  app.use("/api/*", (req, res) => {
    console.warn(`[404_API] Unmatched API Route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `API Route Not Found: ${req.originalUrl}` });
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
