import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { Plus, Database, ArrowRight, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';

interface Workspace {
  id: string;
  name: string;
  vertical: string;
  description: string;
  createdAt: any;
  ownerId: string;
}

export default function WorkspaceList({ onSelect }: { onSelect: (id: string) => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newVertical, setNewVertical] = useState('m&a');

  useEffect(() => {
    if (!auth.currentUser) {
      console.log("WorkspaceList: No user logged in yet");
      return;
    }
    
    console.log("WorkspaceList: Setting up listener for user:", auth.currentUser.uid);
    // Pillar 8: Secure list queries must explicitly filter by ownerId
    // TEMPORARILY removing orderBy to rule out missing index issues
    const q = query(
      collection(db, 'workspaces'), 
      where('ownerId', '==', auth.currentUser.uid)
      // orderBy('createdAt', 'desc') 
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ws = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
      setWorkspaces(ws);
    }, (err) => {
      console.error("Workspace List Listen Error:", err);
      setError("Permission denied when listing nodes.");
      handleFirestoreError(err, OperationType.LIST, 'workspaces');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !auth.currentUser || isActivating) return;
    
    setIsActivating(true);
    setError(null);
    try {
      console.log("Attempting to provision workspace:", newName);
      const docRef = await addDoc(collection(db, 'workspaces'), {
        name: newName,
        vertical: newVertical,
        description: `Targeted ${newVertical} analysis container.`,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      console.log("Workspace provisioned with ID:", docRef.id);
      
      setNewName('');
      setIsCreating(false);
    } catch (err: any) {
      console.error("Workspace activation failed:", err);
      setError(err.message || "Failed to provision node. Check permissions.");
      handleFirestoreError(err, OperationType.CREATE, 'workspaces');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Workspace Nodes</h2>
          <p className="text-black/40 monoscale">Central Intelligence Hub</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Initialize New Node
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.map((ws, idx) => (
          <motion.button
            key={ws.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => onSelect(ws.id)}
            className="card-premium p-6 text-left group flex flex-col h-full bg-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <Database className="w-16 h-16" />
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-black/5 text-black/60 px-2 py-0.5 rounded text-[10px] monoscale font-bold border border-black/5">
                {ws.vertical}
              </span>
              <Activity className="w-3 h-3 text-black/20" />
            </div>
            
            <h3 className="text-xl font-bold mb-2 group-hover:text-black transition-colors">{ws.name}</h3>
            <p className="text-sm text-black/40 line-clamp-2 mb-6 flex-1 italic serif">
              {ws.description}
            </p>
            
            <div className="flex items-center justify-between pt-4 border-t border-black/5">
              <span className="monoscale text-[10px] text-black/30">
                {ws.createdAt ? new Date(ws.createdAt.seconds * 1000).toLocaleDateString() : 'SYNCING...'}
              </span>
              <ArrowRight className="w-4 h-4 text-black/20 group-hover:text-black group-hover:translate-x-1 transition-all" />
            </div>
          </motion.button>
        ))}
      </div>

      {isCreating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-black/10"
          >
            <h3 className="text-2xl font-bold mb-6">Provision New Node</h3>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
                <div className="p-1.5 bg-red-100 rounded-lg">
                  <Activity className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-xs font-bold text-red-900 leading-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="monoscale text-[10px] mb-1 block">Context Label</label>
                <input 
                  autoFocus
                  required
                  placeholder="e.g. Project Helios Diligence"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[#f5f5f5] p-3 rounded-lg border border-black/5 focus:outline-none focus:border-black/20"
                />
              </div>
              <div>
                <label className="monoscale text-[10px] mb-1 block">Strategy Vertical</label>
                <select 
                  value={newVertical}
                  disabled={isActivating}
                  onChange={e => setNewVertical(e.target.value)}
                  className="w-full bg-[#f5f5f5] p-3 rounded-lg border border-black/5 focus:outline-none focus:border-black/20"
                >
                  <option value="m&a">M&A / Corporate Dev</option>
                  <option value="legal">Legal / Compliance</option>
                  <option value="scientific">R&D / Scientific</option>
                  <option value="supply-chain">Supply Chain</option>
                  <option value="general">General Narrative</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  disabled={isActivating}
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/10 monoscale text-[11px] hover:bg-black/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isActivating || !newName}
                  className="flex-1 btn-primary monoscale text-[11px] flex items-center justify-center gap-2"
                >
                  {isActivating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Provisioning...
                    </>
                  ) : 'Activate'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
