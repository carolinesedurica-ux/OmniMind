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
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WorkspaceList from './components/WorkspaceList';
import WorkspaceDetail from './components/WorkspaceDetail';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#E4E3E0]">
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <span className="monoscale text-black/40">Initializing Neural Core...</span>
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
          className="max-w-md w-full px-8 py-12 flex flex-col items-center text-white text-center"
        >
          <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/10">
            <Brain className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tighter mb-4">Omni Mind</h1>
          <p className="text-white/60 mb-8 max-w-xs">
            Multimodal knowledge orchestration for the enterprise. Ingest, index, and query dark data.
          </p>
          <button 
            onClick={signIn}
            className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-white/90 transition-colors flex items-center justify-center gap-3"
          >
            Authenticate with Google
          </button>
          <div className="mt-8 flex items-center gap-2 opacity-20">
            <Shield className="w-4 h-4" />
            <span className="monoscale">Secured by Fortress rules</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-black/10 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedWorkspaceId(null)}
            className="flex items-center gap-2 group"
          >
            <div className="bg-black p-1.5 rounded-lg text-white group-hover:scale-105 transition-transform">
              <Brain className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight text-xl">Omni Mind</span>
          </button>
          {selectedWorkspaceId && (
            <>
              <ChevronRight className="w-4 h-4 text-black/20" />
              <span className="monoscale font-medium text-black/40">Workspace Detail</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <span className="text-[11px] font-bold tracking-wider text-black/40 monoscale">Ident: {user.email?.split('@')[0]}</span>
          </div>
          <button 
            onClick={signOut}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40 hover:text-black"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedWorkspaceId ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full p-8 overflow-y-auto"
            >
              <WorkspaceList onSelect={setSelectedWorkspaceId} />
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full h-full"
            >
              <WorkspaceDetail 
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
