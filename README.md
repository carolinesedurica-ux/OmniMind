# OmniMind: Enterprise Knowledge Orchestrator

OmniMind is a sophisticated knowledge synthesis platform designed to ingest and transform corporate "dark data"—videos, audio recordings, technical manuals, and fragmented documentation—into structured, actionable intelligence.

## 🚀 Key Features

- **Neural Stream Extraction**: Real-time reconstruction of audiovisual segments into conversational transcripts with entity recognition.
- **Relational Knowledge Graph**: Automated extraction of entities (Technical Specs, Operators, Projects) from ingested data into a cross-referenced matrix.
- **Intelligence Briefs**: LLM-powered strategic synthesis that generates TL;DRs, key findings, risk audits, and recommended actions.
- **Multimodal Analysis**: Native processing of video, audio, and text using Gemini 1.5 Pro.
- **Dynamic Atmospheric UI**: A high-fidelity, reactive interface with cyber-noir aesthetics, dynamic lighting, and real-time ingestion metrics.

## 🛠 Technical Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) (Motion)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

### Backend & Infrastructure
- **Server**: [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- **Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore) (Real-time NoSQL)
- **Authentication**: [Firebase Auth](https://firebase.google.com/docs/auth)
- **AI Engine**: [Gemini 1.5 Pro](https://deepmind.google/technologies/gemini/) (via `@google/genai`)

## 🏗 Architecture

OmniMind follows a modern full-stack architecture optimized for high-performance AI interactions:

- **Client-Side SPA**: A responsive React application that handles state management, real-time data binding with Firestore, and complex UI animations.
- **Express Middleware**: A Node.js backend that serves the application, manages API proxying, and ensures secure communication between the client and AI services.
- **Real-time Synchronization**: Uses Firestore's `onSnapshot` listeners to provide instant updates across workspaces and collaborative sessions.
- **AI Pipeline**:
  - **Ingestion**: Files are uploaded and processed through the AI Service.
  - **Entity Extraction**: Multimodal files are analyzed by Gemini to identify speakers, topics, and technical entities.
  - **Synthesis**: Data clusters are aggregated to generate context-aware intelligence briefs.

## 🌑 Design Philosophy

The interface uses a custom **Cyber-Noir Design Language**:
- **Atmospheric Lighting**: Reactive background gradients shifting between *Electric Cyan* and *Deep Violet* based on system state and time of day.
- **Lathed Borders**: Precision-engineered borders with subtle inner glows and glass-morphism.
- **Neural Aesthetic**: Monospace typography paired with high-contrast data visualizations to evoke a sense of high-performance intelligence extraction.

## 📦 Installation & Setup

1. **Environment Variables**: Configure your `.env` file with the following:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   # Firebase configuration included in firebase-applet-config.json
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

## 🔒 Security

- **Multi-Signature Authorization**: Access to workspaces is managed via granular User ID authorization nodes.
- **Firebase Security Rules**: Hardened ABAC (Attribute-Based Access Control) rules ensuring data isolation and integrity.
