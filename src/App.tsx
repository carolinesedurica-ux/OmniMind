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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
      <div className="h-screen w-full flex items-center justify-center bg-[#E4E3E0]">
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <span className="monoscale text-black/40 text-[10px] font-bold tracking-[0.2em] uppercase">Initializing Neural Core...</span>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#141414]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl w-full px-8 py-12 flex flex-col items-center text-white"
        >
          <div className="mb-12 relative">
            <div className="absolute -inset-4 bg-white/5 blur-xl rounded-full" />
            <Activity className="w-20 h-20 text-white relative" />
          </div>
          <h1 className="text-6xl font-black tracking-tighter mb-6 uppercase text-center">OmniMind</h1>
          <p className="text-white/50 mb-12 max-w-sm text-center italic serif text-lg leading-relaxed">
            Expose the intelligence hidden in your corporate dark data. Video recordings, technical manuals, and audio logs, synthesized in one neural matrix.
          </p>
          
          <div className="w-full space-y-4">
            <button 
              onClick={handleSignIn}
              className="w-full bg-white text-black py-5 rounded-none font-black text-xs tracking-[0.2em] uppercase hover:bg-white/90 transition-all flex items-center justify-center gap-4 border-2 border-white group"
            >
              Authorize Access
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {authError && (
              <div className="p-4 bg-red-500/10 border border-red-500 text-red-500 text-[10px] monoscale font-black uppercase tracking-widest text-center">
                {authError}
              </div>
            )}
          </div>
          
          <div className="mt-16 grid grid-cols-3 gap-8 w-full border-t border-white/10 pt-8 opacity-40">
            <div className="text-center">
              <span className="block text-[20px] font-bold tracking-tight">1.5M</span>
              <span className="monoscale text-[9px] uppercase tracking-widest">Context Window</span>
            </div>
            <div className="text-center">
              <span className="block text-[20px] font-bold tracking-tight">Native</span>
              <span className="monoscale text-[9px] uppercase tracking-widest">Multimodal</span>
            </div>
            <div className="text-center">
              <span className="block text-[20px] font-bold tracking-tight">E2E</span>
              <span className="monoscale text-[9px] uppercase tracking-widest">Encrypted</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F0EE] flex flex-col font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="h-20 bg-white border-b border-black px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setSelectedWorkspaceId(null)}
            className="flex items-center gap-3 group"
          >
            <div className="bg-black p-2 rounded-none text-white group-hover:rotate-90 transition-transform duration-500">
              <Activity className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-tighter text-2xl uppercase leading-none">OmniMind</span>
              <span className="monoscale text-[9px] font-bold tracking-[0.3em] text-black/30 uppercase leading-none mt-1">Enterprise Orchestration</span>
            </div>
          </button>
          {selectedWorkspaceId && (
            <div className="flex items-center gap-3">
              <span className="text-black/10 text-2xl font-light">/</span>
              <span className="monoscale font-black text-[11px] text-black/40 uppercase tracking-widest">Workspace_Matrix</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end mr-4 pr-6 border-r border-black/10">
            <span className="text-[10px] font-black tracking-widest text-black/30 monoscale uppercase">Active_Session</span>
            <span className="text-xs font-bold">{user.email}</span>
          </div>
          <button 
            onClick={signOut}
            className="group flex items-center gap-2 p-3 border-2 border-black hover:bg-black hover:text-white transition-all rounded-none"
          >
            <span className="monoscale text-[10px] font-black uppercase tracking-widest group-hover:block hidden">Deauthorize</span>
            <LogOut className="w-5 h-5" />
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
