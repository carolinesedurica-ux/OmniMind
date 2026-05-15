import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, or } from 'firebase/firestore';
import { Plus, Database, ArrowRight, Activity, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/error-utils';

interface Workspace {
  id: string;
  name: string;
  vertical: string;
  description: string;
  createdAt: any;
  userId: string;
}

export default function WorkspaceList({ user, onSelect }: { user: any, onSelect: (id: string) => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSeedDemo = async () => {
    if (!user || isSeeding) return;
    setIsSeeding(true);
    setError(null);
    try {
      // 1. Create Workspace
      const docRef = await addDoc(collection(db, 'workspaces'), {
        name: "BIOHUB_OMEGA_AUDIT",
        vertical: "scientific",
        description: "Synthetic biology risk assessment and research integration matrix.",
        userId: user.uid,
        collaborators: [],
        createdAt: serverTimestamp()
      });

      // 2. Add Dummy Files with Ingestion Data
      const demoFiles = [
        {
          title: "VACCINE_PROTOCOL_04.PDF",
          doc_type: "pdf",
          summary: "Phase 3 safety report for synthetic lipid nanoparticle delivery.",
          key_topics: ["Lipid Chemistry", "Safety Protocol", "Bio-Distribution"],
          key_quotes: [{ text: "No significant adverse reactions noted in Cluster A.", location: "Page 42" }]
        },
        {
          title: "LAB_SURVEILLANCE_ROOM_12.MP4",
          doc_type: "video",
          summary: "Automated lab footage from May 14 session.",
          key_topics: ["Operational Security", "Thermal Variance", "Protocol Adherence"],
          key_quotes: [{ text: "Temperature shift detected at 14:22:01.", location: "04:12" }]
        }
      ];

      for (const file of demoFiles) {
        await addDoc(collection(db, 'workspaces', docRef.id, 'files'), {
          ...file,
          status: 'PROCESSED',
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      }

      onSelect(docRef.id);
    } catch (err: any) {
      setError("Failed to seed demo node: " + err.message);
    } finally {
      setIsSeeding(false);
    }
  };
  const [newName, setNewName] = useState('');
  const [newVertical, setNewVertical] = useState('m&a');

  useEffect(() => {
    if (!user) return;

    const qOwned = query(
      collection(db, 'workspaces'), 
      where('userId', '==', user.uid)
    );

    const qCollaborated = query(
      collection(db, 'workspaces'),
      where('collaborators', 'array-contains', user.uid)
    );
    
    let ownedWorkspaces: Workspace[] = [];
    let collaboratedWorkspaces: Workspace[] = [];

    const updateList = () => {
      const allMap = new Map<string, Workspace>();
      ownedWorkspaces.forEach(w => allMap.set(w.id, w));
      collaboratedWorkspaces.forEach(w => allMap.set(w.id, w));
      
      let ws = Array.from(allMap.values());
      ws = ws.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setWorkspaces(ws);
    };

    const unsubOwned = onSnapshot(qOwned, (snapshot) => {
      ownedWorkspaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
      updateList();
    }, (err) => {
      console.error("Owned Workspace List Listen Error:", err);
      handleFirestoreError(err, OperationType.LIST, 'workspaces');
    });

    const unsubCollaborated = onSnapshot(qCollaborated, (snapshot) => {
      collaboratedWorkspaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
      updateList();
    }, (err) => {
      console.error("Collaborated Workspace List Listen Error:", err);
      handleFirestoreError(err, OperationType.LIST, 'workspaces');
    });

    return () => {
      unsubOwned();
      unsubCollaborated();
    };
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !user || isActivating) return;
    
    setIsActivating(true);
    setError(null);
    try {
      const docRef = await addDoc(collection(db, 'workspaces'), {
        name: newName,
        vertical: newVertical,
        description: `Targeted ${newVertical} analysis container.`,
        userId: user.uid,
        collaborators: [],
        createdAt: serverTimestamp()
      });
      
      setNewName('');
      setIsCreating(false);
    } catch (err: any) {
      setError(err.message || "Failed to provision node. Check permissions.");
      handleFirestoreError(err, OperationType.CREATE, 'workspaces');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-10">
      <div className="flex items-end justify-between mb-16 border-b border-white/5 pb-10">
        <div>
          <span className="monoscale text-[10px] font-medium text-white/30 uppercase tracking-[0.5em] block mb-3">Available_Clusters</span>
          <h2 className="text-6xl font-bold tracking-tighter uppercase leading-none text-white">Global Nodes</h2>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-cyan text-black px-10 py-5 rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-4 glow-cyan"
        >
          <Plus className="w-5 h-5" />
          Initialize Cluster
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.map((ws, idx) => (
          <motion.button
            key={ws.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelect(ws.id)}
            className="group glass-panel p-10 text-left hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 flex flex-col h-[360px] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-1 bg-white/5 monoscale text-[8px] opacity-20 group-hover:opacity-100 transition-opacity">
              {ws.id.slice(0, 8)}
            </div>
            
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            
            <div className="mb-10 relative">
              <span className="monoscale text-[9px] font-bold text-cyan border border-cyan/30 px-3 py-1 rounded-md uppercase tracking-widest mb-6 inline-block bg-cyan/5">
                {ws.vertical?.replace('-', '_') || 'GENERAL'}
              </span>
              <h3 className="text-4xl font-bold tracking-tighter uppercase leading-none text-white group-hover:text-cyan transition-colors line-clamp-2">
                {ws.name}
              </h3>
            </div>
            
            <p className="text-sm font-medium text-white/40 line-clamp-3 mb-auto leading-relaxed tracking-tight group-hover:text-white/60 transition-colors">
              {ws.description}
            </p>
            
            <div className="flex items-center justify-between mt-10 pt-8 border-t border-white/5 relative z-10">
              <div className="flex flex-col">
                <span className="monoscale text-[8px] text-white/20 uppercase tracking-widest">Status: ACTIVE</span>
                <span className="monoscale text-[10px] font-medium text-white/40 group-hover:text-white transition-colors">
                  {ws.createdAt ? new Date(ws.createdAt.seconds * 1000).toLocaleDateString() : 'ONLINE'}
                </span>
              </div>
              <div className="p-3 rounded-full bg-white/5 group-hover:bg-cyan group-hover:text-black transition-all">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </motion.button>
        ))}
        
        {workspaces.length === 0 && !isCreating && (
          <div className="col-span-full py-40 glass-panel flex flex-col items-center justify-center space-y-10">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan/10 blur-3xl rounded-full" />
              <Activity className="w-20 h-20 text-white/10 relative animate-pulse" />
            </div>
            <div className="text-center space-y-4">
              <p className="monoscale text-[14px] font-medium tracking-[0.4em] uppercase text-white/20">
                No active neural clusters detected.
              </p>
              <div className="flex gap-6">
                <button 
                  onClick={() => setIsCreating(true)}
                  className="bg-white/5 text-white/60 px-12 py-5 rounded-2xl hover:bg-white/10 transition-all border border-white/10 monoscale text-[11px] font-medium tracking-[0.3em]"
                >
                  Launch Protocol_Alpha
                </button>
                <button 
                  onClick={handleSeedDemo}
                  disabled={isSeeding}
                  className="bg-cyan/10 text-cyan px-12 py-5 rounded-2xl hover:bg-cyan hover:text-black transition-all border border-cyan/20 monoscale text-[11px] font-bold tracking-[0.3em] flex items-center gap-3 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-cyan opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative z-10">{isSeeding ? 'Seeding...' : 'Run_Protocol_Omega (Demo)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            key="create-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-base/90 backdrop-blur-xl flex items-center justify-center z-[100] p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel p-16 max-w-2xl w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />
              
              <div className="mb-12">
                <span className="monoscale text-[10px] font-medium text-white/20 uppercase tracking-[0.5em] block mb-4">Neural_Provisioning</span>
                <h3 className="text-5xl font-bold tracking-tighter uppercase text-white">Initialize Node</h3>
              </div>
              
              {error && (
                <div className="mb-10 p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium uppercase tracking-tight leading-relaxed">{error}</p>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-10">
                <div className="space-y-4">
                  <label className="monoscale text-[9px] font-medium uppercase tracking-[0.4em] text-white/20 ml-2">Cluster_Identifier</label>
                  <input 
                    autoFocus
                    required
                    placeholder="ALPHA_INTEL_STREAM"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-white/5 p-6 rounded-2xl border border-white/10 focus:border-cyan/50 focus:outline-none transition-all monoscale font-medium text-white uppercase placeholder:opacity-20"
                  />
                </div>
                <div className="space-y-4">
                  <label className="monoscale text-[9px] font-medium uppercase tracking-[0.4em] text-white/20 ml-2">Logical_Framework</label>
                  <div className="relative">
                    <select 
                      value={newVertical}
                      disabled={isActivating}
                      onChange={e => setNewVertical(e.target.value)}
                      className="w-full bg-white/5 p-6 rounded-2xl border border-white/10 focus:border-cyan/50 focus:outline-none appearance-none monoscale font-medium text-white uppercase"
                    >
                      <option value="m&a" className="bg-[#111]">M&A_TRANSACTION</option>
                      <option value="legal" className="bg-[#111]">FORENSIC_LEGAL</option>
                      <option value="scientific" className="bg-[#111]">DEEP_SCIENCE</option>
                      <option value="supply-chain" className="bg-[#111]">SUPPLY_CHAIN</option>
                      <option value="general" className="bg-[#111]">STANDARD_INTEL</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                      <ArrowRight className="w-5 h-5 rotate-90" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-6 pt-6">
                  <button 
                    type="button"
                    disabled={isActivating}
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-8 py-5 rounded-2xl border border-white/10 monoscale text-[10px] font-medium uppercase tracking-widest text-white/40 hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    Abort_Protocol
                  </button>
                  <button 
                    type="submit"
                    disabled={isActivating || !newName}
                    className="flex-1 bg-cyan text-black px-8 py-5 rounded-2xl font-bold monoscale text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 glow-cyan"
                  >
                    {isActivating ? (
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : 'Initialize_Node'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
