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
  const [error, setError] = useState<string | null>(null);
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
    <div className="max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-16 border-b-2 border-black pb-8">
        <div>
          <span className="monoscale text-[10px] font-black text-black/30 uppercase tracking-[0.4em] block mb-2">Available_Clusters</span>
          <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">Intelligence Nodes</h2>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-black text-white px-8 py-4 rounded-none font-black text-[10px] tracking-[0.2em] uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
        >
          <Plus className="w-4 h-4" />
          Initialize Cluster
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-l border-t border-black">
        {workspaces.map((ws, idx) => (
          <motion.button
            key={ws.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelect(ws.id)}
            className="group flex flex-col h-[320px] bg-white border-r border-b border-black p-8 text-left hover:bg-black hover:text-white transition-colors duration-300 relative overflow-hidden"
          >
            <div className="absolute top-4 right-4 monoscale text-[10px] font-black opacity-20 group-hover:opacity-40 tracking-widest uppercase">
              ID_{ws.id.slice(0, 8)}
            </div>
            
            <div className="mb-8">
              <span className="monoscale text-[9px] font-black border border-current px-2 py-0.5 uppercase tracking-widest mb-4 inline-block">
                {ws.vertical?.replace('-', '_') || 'GENERAL'}
              </span>
              <h3 className="text-3xl font-black tracking-tighter uppercase leading-tight line-clamp-2">
                {ws.name}
              </h3>
            </div>
            
            <p className="text-sm font-medium opacity-60 line-clamp-3 mb-auto italic serif leading-relaxed">
              {ws.description}
            </p>
            
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/10 group-hover:border-white/20">
              <div className="flex flex-col">
                <span className="monoscale text-[9px] opacity-40 uppercase tracking-widest">Commissioned</span>
                <span className="monoscale text-[10px] font-black text-black group-hover:text-white">
                  {ws.createdAt ? new Date(ws.createdAt.seconds * 1000).toLocaleDateString() : 'ONLINE'}
                </span>
              </div>
              <ArrowRight className="w-6 h-6 transform group-hover:translate-x-2 transition-transform duration-300" />
            </div>
            
            <div className="absolute -bottom-4 -right-4 w-24 h-24 border border-black/5 rounded-full group-hover:border-white/10 transition-colors" />
          </motion.button>
        ))}
        
        {workspaces.length === 0 && !isCreating && (
          <div className="col-span-full py-40 text-center border-r border-b border-black bg-black/5 flex flex-col items-center justify-center">
            <Activity className="w-16 h-16 mb-8 opacity-10 animate-pulse" />
            <p className="monoscale text-[14px] font-black tracking-[0.3em] uppercase opacity-30 mb-8 max-w-md mx-auto">
              No active clusters detected. Neural core is idle.
            </p>
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-black text-white px-10 py-5 rounded-none font-black text-[11px] tracking-[0.2em] uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
            >
              <Plus className="w-5 h-5" />
              Initialize First Cluster
            </button>
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
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-[#F0F0EE] rounded-none border-2 border-black p-12 max-w-xl w-full shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="mb-10">
                <span className="monoscale text-[10px] font-black text-black/30 uppercase tracking-[0.4em] block mb-2">Protocol_Initialize</span>
                <h3 className="text-4xl font-black tracking-tighter uppercase">Provision Node</h3>
              </div>
              
              {error && (
                <div className="mb-8 p-5 bg-black text-white flex items-start gap-4">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                  <p className="text-[11px] font-black monoscale uppercase leading-tight">{error}</p>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-8">
                <div className="space-y-2">
                  <label className="monoscale text-[10px] font-black uppercase tracking-widest opacity-40">Cluster_Label</label>
                  <input 
                    autoFocus
                    required
                    placeholder="PROJECT_OMEGA_DILIGENCE"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-white p-5 rounded-none border-2 border-black focus:outline-none focus:bg-white transition-colors monoscale font-black uppercase placeholder:opacity-20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="monoscale text-[10px] font-black uppercase tracking-widest opacity-40">Operational_Strategy</label>
                  <select 
                    value={newVertical}
                    disabled={isActivating}
                    onChange={e => setNewVertical(e.target.value)}
                    className="w-full bg-white p-5 rounded-none border-2 border-black focus:outline-none appearance-none monoscale font-black uppercase"
                  >
                    <option value="m&a">M&A / Corporate_Transaction</option>
                    <option value="legal">Forensic_Legal</option>
                    <option value="scientific">R&D_Deep_Science</option>
                    <option value="supply-chain">Logistics_Log</option>
                    <option value="general">Standard_Intel</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    disabled={isActivating}
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-4 py-5 rounded-none border-2 border-black monoscale text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit"
                    disabled={isActivating || !newName}
                    className="flex-1 bg-black text-white px-4 py-5 rounded-none monoscale text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    {isActivating ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Provisioning...
                      </>
                    ) : 'Initialize'}
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
