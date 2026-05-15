import { useState, useEffect } from 'react';
import { auth, signIn, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Database, 
  Plus, 
  LayoutDashboard, 
  FileText, 
  Search, 
  Users, 
  AlertTriangle, 
  Clock, 
  ChevronRight,
  LogOut,
  Brain,
  Shield,
  Upload,
  Zap,
  Activity,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WorkspaceList from './components/WorkspaceList';
import WorkspaceDetail from './components/WorkspaceDetail';
import AtmosphericBackground from './components/AtmosphericBackground';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signIn();
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setAuthError(`DOMAIN_UNAUTHORIZED: ${domain} is not whitelisted in Firebase. Add it to Authorized Domains in Firebase Console.`);
      } else {
        setAuthError(err.message || "Failed to authorize access.");
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-base">
        <motion.div 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-cyan/20 blur-2xl rounded-full" />
            <Activity className="w-16 h-16 text-cyan relative animate-pulse" />
          </div>
          <span className="monoscale text-cyan/40 text-[10px] font-medium tracking-[0.4em] uppercase">Initializing Neural Core...</span>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-base overflow-hidden relative">
        {/* Background Atmospheric Glows */}
        <div className="absolute top-0 -left-1/4 w-[50%] h-[50%] bg-cyan/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 -right-1/4 w-[50%] h-[50%] bg-violet/5 blur-[120px] rounded-full" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full px-8 py-16 flex flex-col items-center text-white relative z-10"
        >
          <div className="mb-12 relative group">
            <div className="absolute -inset-8 bg-cyan/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="lathed-border p-8 rounded-3xl bg-white/5 backdrop-blur-md relative overflow-hidden">
               <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />
               <Activity className="w-20 h-20 text-cyan" />
            </div>
          </div>
          
          <h1 className="text-7xl font-black tracking-tighter mb-4 uppercase text-center bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">OmniMind</h1>
          <p className="text-white/40 mb-12 max-w-sm text-center font-medium text-sm leading-relaxed tracking-tight">
            Advanced neural orchestration for enterprise dark data. Synthesize multi-dimensional records into actionable intelligence.
          </p>
          
          <div className="w-full space-y-4 max-w-xs">
            <button 
              onClick={handleSignIn}
              className="w-full bg-white text-black py-5 rounded-xl font-bold text-xs tracking-[0.2em] uppercase hover:bg-cyan hover:text-black transition-all flex items-center justify-center gap-4 group lathed-border relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10 font-[JetBrains Mono]">Authorize Access</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
            </button>

            <button 
              onClick={() => {
                console.log("Protocol Insight Requested");
                setShowPreview(true);
              }}
              className="w-full bg-white/5 text-white/40 py-4 rounded-xl font-bold text-[9px] tracking-[0.3em] uppercase hover:bg-white/10 hover:text-white transition-all border border-white/10 monoscale relative z-30"
            >
              Protocol_Insight: Public_Preview
            </button>

            {authError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] monoscale font-medium tracking-widest text-center rounded-xl backdrop-blur-sm">
                <AlertTriangle className="w-4 h-4 mx-auto mb-2 opacity-50" />
                {authError}
              </div>
            )}
          </div>
          
          <div className="mt-20 grid grid-cols-3 gap-12 w-full border-t border-white/5 pt-12">
            <div className="text-center">
              <span className="block text-2xl font-bold tracking-tighter text-white">1.5M</span>
              <span className="monoscale text-[8px] uppercase tracking-[0.3em] text-white/30">Context</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-bold tracking-tighter text-white">Native</span>
              <span className="monoscale text-[8px] uppercase tracking-[0.3em] text-white/30">LMM</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-bold tracking-tighter text-white">E2E</span>
              <span className="monoscale text-[8px] uppercase tracking-[0.3em] text-white/30">Crypto</span>
            </div>
          </div>
        </motion.div>

        {/* Global Preview Overlay */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-[#050506]/90 backdrop-blur-2xl"
            >
              <motion.div
                initial={{ scale: 0.9, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 30, opacity: 0 }}
                className="max-w-4xl w-full glass-panel lathed-border bg-white/[0.01] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              >
                <div className="p-10 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-bold tracking-tighter text-white uppercase italic">SYSTEM_BLUEPRINT_v0.9</h3>
                    <p className="monoscale text-[9px] text-white/30 uppercase tracking-[0.3em] mt-1">Multi-Agent Neural Orchestration</p>
                  </div>
                  <button 
                    onClick={() => setShowPreview(false)}
                    className="p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                  >
                    <LogOut className="w-5 h-5 rotate-180" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-12">
                  <section className="space-y-6">
                    <h4 className="monoscale text-[10px] font-bold text-cyan uppercase tracking-[0.4em]">Core_Logic_Flow</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                        <div className="w-10 h-10 bg-cyan/10 rounded-xl flex items-center justify-center text-cyan">
                          <Upload className="w-5 h-5" />
                        </div>
                        <h5 className="font-bold text-white uppercase text-xs">Neural_Ingestion</h5>
                        <p className="text-[11px] leading-relaxed text-white/40">Multimodal stream extraction via Gemini 1.5 Flash. Processing videos, audio, and documents in Parallel buffers.</p>
                      </div>
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                        <div className="w-10 h-10 bg-violet/10 rounded-xl flex items-center justify-center text-violet-400">
                          <Layers className="w-5 h-5" />
                        </div>
                        <h5 className="font-bold text-white uppercase text-xs">Agent_Matrix</h5>
                        <p className="text-[11px] leading-relaxed text-white/40">Orchestrator Agent dispatches tasks to Specialist Nodes (Compliance, Risk, Entity) using Gemini 1.5 Pro reasoning.</p>
                      </div>
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                        <div className="w-10 h-10 bg-cyan/10 rounded-xl flex items-center justify-center text-cyan">
                          <Brain className="w-5 h-5" />
                        </div>
                        <h5 className="font-bold text-white uppercase text-xs">Knowledge_Synthesis</h5>
                        <p className="text-[11px] leading-relaxed text-white/40">Strategic brief generation and relational knowledge graph reconstruction with real-time Firestore sync.</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h4 className="monoscale text-[10px] font-bold text-cyan uppercase tracking-[0.4em]">Tech_Stack_Audit</h4>
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 space-y-4 font-mono text-[10px]">
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40">FRAMEWORK</span>
                        <span className="text-white">React 19 / Vite</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40">MODEL_ORCHESTRATOR</span>
                        <span className="text-cyan">Gemini 1.5 Pro</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40">INFERENCE_SPEED</span>
                        <span className="text-cyan">Gemini 1.5 Flash</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40">PERSISTENCE</span>
                        <span className="text-white">Cloud Firestore (Real-time)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">VISUALIZATION</span>
                        <span className="text-white">Recharts / Framer Motion</span>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="p-10 border-t border-white/5 bg-white/[0.02] flex items-center justify-center">
                  <button 
                    onClick={() => {
                      setShowPreview(false);
                      handleSignIn();
                    }}
                    className="flex items-center gap-4 px-10 py-4 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-cyan transition-all"
                  >
                    <span>Initiate Full Authorization</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base relative flex flex-col font-sans selection:bg-cyan/30 selection:text-cyan text-white/80 overflow-hidden">
      <AtmosphericBackground />
      
      {/* Header */}
      <header className="h-20 bg-base/80 backdrop-blur-md border-b border-white/5 px-10 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setSelectedWorkspaceId(null)}
            className="flex items-center gap-4 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-cyan/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="lathed-border p-2 bg-white/5 rounded-xl text-cyan group-hover:rotate-90 transition-transform duration-700 relative">
                <Activity className="w-6 h-6" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tighter text-2xl uppercase leading-none text-white">OmniMind</span>
              <span className="monoscale text-[8px] font-medium tracking-[0.4em] text-white/20 uppercase leading-none mt-1">Enterprise Orchestration</span>
            </div>
          </button>
          {selectedWorkspaceId && (
            <div className="flex items-center gap-4">
              <span className="text-white/10 text-2xl font-light">/</span>
              <span className="monoscale font-medium text-[10px] text-white/40 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">Workspace_Matrix</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex flex-col items-end mr-6 pr-8 border-r border-white/5">
            <span className="text-[9px] font-medium tracking-[0.3em] text-white/20 monoscale uppercase">Active_Session</span>
            <span className="text-xs font-bold text-white/60">{user.email}</span>
          </div>
          <button 
            onClick={signOut}
            className="group flex items-center gap-3 p-3 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl"
          >
            <span className="monoscale text-[9px] font-medium uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Term_Session</span>
            <LogOut className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedWorkspaceId ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full p-10 overflow-y-auto"
            >
              <WorkspaceList user={user} onSelect={setSelectedWorkspaceId} />
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <WorkspaceDetail 
                user={user}
                workspaceId={selectedWorkspaceId} 
                onBack={() => setSelectedWorkspaceId(null)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
