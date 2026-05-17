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

  // Basic Body Parsing
  app.use(express.json({ limit: '100mb' }));

  // Global Request Logger - Focused on API and distinct events
  app.use((req, res, next) => {
    const { method, url } = req;
    const isApi = url.startsWith('/api/');
    
    if (isApi) {
      const start = Date.now();
      const timestamp = new Date().toISOString();
      console.log(`[API_REQ] ${timestamp} | ${method} | ${url}`);
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        if (res.statusCode >= 400) {
          console.error(`[API_ERR] ${res.statusCode} | ${method} | ${url} | ${duration}ms`);
        } else {
          console.log(`[API_END] ${res.statusCode} | ${method} | ${url} | ${duration}ms`);
        }
      });
    }
    next();
  });

  // API ROUTES - MUST BE BEFORE STATIC AND VITE
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "online", system: "OmniMind Core", timestamp: new Date().toISOString() });
  });

  app.get("/api/diagnostic", (req, res) => {
    res.json({ 
      status: "alive", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV,
      ai_ready: !!ai
    });
  });

  app.post("/api/neural/generate", async (req, res) => {
    const aiLogId = Math.random().toString(36).substring(7);
    console.log(`[AI_GATEWAY][${aiLogId}] POST Received. Model=${req.body?.model}`);
    
    try {
      if (!ai) {
        console.error(`[AI_GATEWAY][${aiLogId}] GEMINI_API_KEY missing`);
        return res.status(503).json({ error: "Neural Core Offline: Configuration Missing" });
      }

      const { model, contents, config } = req.body;
      if (!contents) return res.status(400).json({ error: "Missing contents" });

      const modelName = model?.includes('pro') ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      console.log(`[AI_GATEWAY][${aiLogId}] Executing on ${modelName}`);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: config || {}
      });

      res.json({ text: response.text });
      console.log(`[AI_GATEWAY][${aiLogId}] Success sent`);
    } catch (error: any) {
      console.error(`[AI_GATEWAY_ERROR][${aiLogId}]`, error);
      
      const isQuotaError = error.message?.includes('RESOURCE_EXHAUSTED') || 
                          error.message?.includes('429') || 
                          error.status === 429;
      
      if (isQuotaError) {
        return res.status(429).json({ 
          error: "Neural Matrix Quota Exhausted (429). Upgrading to a paid tier in 'Settings > Secrets' increases your quota and enables advanced models." 
        });
      }

      res.status(500).json({ error: error.message || "Neural Core Sync Failure" });
    }
  });

  // Final catch-all for unknown /api/* requests
  app.all("/api/*", (req, res) => {
    console.warn(`[API_MISS] 404 on ${req.method} ${req.url}`);
    res.status(404).json({ error: "Route not found in Neural Core" });
  });

  // VITE OR STATIC FALLBACKS AFTER API
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
      // Don't serve index.html for obviously missing source files
      if (req.url.startsWith('/src/') || req.url.endsWith('.ts') || req.url.endsWith('.tsx')) {
        return res.status(404).send('Source file not found');
      }
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
