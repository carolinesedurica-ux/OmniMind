import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { 
  ArrowLeft, 
  FileText, 
  Search, 
  Users, 
  AlertTriangle, 
  Clock, 
  Activity,
  ChevronRight,
  Filter,
  Layers,
  Send,
  Quote,
  ExternalLink,
  Brain,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Zap,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import FileUpload from './FileUpload';
import { askWorkspace, generateExecutiveBrief, runMultiAgentAudit } from '../services/aiService';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface WorkspaceDetailProps {
  user: any;
  workspaceId: string;
  onBack: () => void;
}

export default function WorkspaceDetail({ user, workspaceId, onBack }: WorkspaceDetailProps) {
  const [activeTab, setActiveTab] = useState<'mining' | 'feed' | 'matrix' | 'neural' | 'briefs' | 'collaborators'>('mining');
  const [workspace, setWorkspace] = useState<any>(null);
  const [newCollaboratorId, setNewCollaboratorId] = useState('');
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [briefs, setBriefs] = useState<any[]>([]);
  
  // Neural Query State
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  // Brief Generation State
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Neural Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditTrace, setAuditTrace] = useState<any[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);

  const handleEnterpriseAudit = async () => {
    if (files.length === 0) return;
    setIsAuditing(true);
    setAuditTrace([]);
    setAuditError(null);
    try {
      const result = await runMultiAgentAudit(files, (event) => {
        setAuditTrace(prev => [...prev, event]);
      });
      console.log('Neural Audit Complete:', result);
      
      // Persist findings to Firestore so they appearing in the UI
      const savePromises = [];

      // 1. Save Risks
      if (result.risks && result.risks.length > 0) {
        for (const risk of result.risks) {
          savePromises.push(addDoc(collection(db, 'workspaces', workspaceId, 'risks'), {
            ...risk,
            createdAt: serverTimestamp()
          }));
        }
      }

      // 2. Save Entities
      if (result.entities && result.entities.length > 0) {
        for (const entity of result.entities) {
          savePromises.push(addDoc(collection(db, 'workspaces', workspaceId, 'entities'), {
            ...entity,
            createdAt: serverTimestamp()
          }));
        }
      }

      await Promise.all(savePromises);
      
      // Automatically switch to diagnostics/analysis tab if needed
      setActiveTab('matrix');
    } catch (err: any) {
      console.error('Neural Audit Error:', err);
      setAuditError(err.message || 'Audit Protocol Failed');
    } finally {
      setIsAuditing(false);
    }
  };

  // Process files into chart data
  const chartData = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    const today = new Date();
    
    // Seed last 10 days
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      counts[label] = 0;
    }

    files.forEach(file => {
      if (file.createdAt?.seconds) {
        const date = new Date(file.createdAt.seconds * 1000);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (counts[label] !== undefined) {
          counts[label]++;
        }
      }
    });

    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [files]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'neural') {
      scrollToBottom();
    }
  }, [chatHistory, activeTab]);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollaboratorId || isAddingCollaborator || !workspace) return;
    
    setIsAddingCollaborator(true);
    try {
      const collaborators = workspace.collaborators || [];
      if (!collaborators.includes(newCollaboratorId)) {
        await setDoc(doc(db, 'workspaces', workspaceId), {
          collaborators: [...collaborators, newCollaboratorId]
        }, { merge: true });
        setNewCollaboratorId('');
      }
    } catch (err: any) {
      console.error("Failed to add collaborator:", err);
      handleFirestoreError(err, OperationType.UPDATE, `workspaces/${workspaceId}`);
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const removeCollaborator = async (uid: string) => {
    if (!workspace) return;
    try {
      const collaborators = (workspace.collaborators || []).filter((id: string) => id !== uid);
      await setDoc(doc(db, 'workspaces', workspaceId), {
        collaborators
      }, { merge: true });
    } catch (err: any) {
      console.error("Failed to remove collaborator:", err);
      handleFirestoreError(err, OperationType.UPDATE, `workspaces/${workspaceId}`);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    // Workspace Data - Use direct doc listener instead of collection scan
    const unsubWs = onSnapshot(doc(db, 'workspaces', workspaceId), (snap) => {
      if (snap.exists()) {
        setWorkspace({ id: snap.id, ...snap.data() });
      }
    }, (err) => {
      console.error("Workspace Listen Error:", err);
      handleFirestoreError(err, OperationType.GET, `workspaces/${workspaceId}`);
    });

    // Files
    const unsubFiles = onSnapshot(query(
      collection(db, 'workspaces', workspaceId, 'files')
    ), (snap) => {
      let f = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      f = f.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setFiles(f);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/files`));

    // Risks
    const unsubRisks = onSnapshot(collection(db, 'workspaces', workspaceId, 'risks'), (snap) => {
      setRisks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/risks`));

    // Entities
    const unsubEnts = onSnapshot(collection(db, 'workspaces', workspaceId, 'entities'), (snap) => {
      setEntities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/entities`));

    // Segments
    const unsubSegs = onSnapshot(query(
      collection(db, 'workspaces', workspaceId, 'segments')
    ), (snap) => {
      let s = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      s = s.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSegments(s);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/segments`));

    // Queries
    const unsubQueries = onSnapshot(query(
      collection(db, 'workspaces', workspaceId, 'queries')
    ), (snap) => {
      let q = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      q = q.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setChatHistory(q);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/queries`));

    // Briefs
    const unsubBriefs = onSnapshot(query(
      collection(db, 'workspaces', workspaceId, 'briefs')
    ), (snap) => {
      let b = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      b = b.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBriefs(b);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/briefs`));

    return () => {
      unsubWs(); unsubFiles(); unsubRisks(); unsubEnts(); unsubSegs(); unsubQueries(); unsubBriefs();
    };
  }, [workspaceId, user]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;

    setIsAsking(true);
    const userQ = question;
    setQuestion('');

    try {
      // Build context from segments
      const context = segments.length > 0 
        ? segments.map(s => `[${s.start}] ${s.text}`).join('\n').slice(0, 50000)
        : "No data segments available in the workspace.";

      const answer = await askWorkspace(userQ, context);
      
      if (!answer || !answer.answer) {
        throw new Error("Received an empty or invalid response from the synthesis engine.");
      }

      await addDoc(collection(db, 'workspaces', workspaceId, 'queries'), {
        question: userQ,
        answer: answer.answer,
        confidence: answer.confidence || 'unknown',
        citations: answer.citations || [],
        createdAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error("Ask Error:", error);
      // Re-fill the question so the user doesn't lose it on error
      setQuestion(userQ);
      // We can't easily show an alert in this environment, but we can log it
      // handleFirestoreError will log it as JSON string
      handleFirestoreError(error, OperationType.CREATE, `workspaces/${workspaceId}/queries`);
    } finally {
      setIsAsking(false);
    }
  };

  const handleGenerateBrief = async () => {
    if (isGeneratingBrief) return;
    setIsGeneratingBrief(true);
    try {
      const workspaceContext = `
        WORKSPACE: ${workspace?.name}
        VERTICAL: ${workspace?.vertical}
        DESCRIPTION: ${workspace?.description}
        
        RISKS:
        ${risks.map(r => `- [${r.severity}] ${r.title}: ${r.rationale}`).join('\n')}
        
        TOP ENTITIES:
        ${entities.slice(0, 20).map(e => `- ${e.name} (${e.type})`).join('\n')}
        
        RECENT CHUNKS:
        ${segments.slice(0, 30).map(s => `[${s.start}] ${s.text}`).join('\n')}
      `;

      const brief = await generateExecutiveBrief(workspaceContext, "Strategic synthesis for Dark Data Miner");
      await addDoc(collection(db, 'workspaces', workspaceId, 'briefs'), {
        ...brief,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const tabs = [
    { id: 'mining', label: 'Ingestion Agent', icon: Activity },
    { id: 'feed', label: 'Dark Stream', icon: Clock },
    { id: 'matrix', label: 'Entity Matrix', icon: Layers },
    { id: 'neural', label: 'Synthesis Agent', icon: Brain },
    { id: 'briefs', label: 'Strategic Intel', icon: ShieldCheck },
    { id: 'collaborators', label: 'Access Control', icon: Users },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden selection:bg-cyan/30 selection:text-cyan text-white/80">
      {/* Detail Header */}
      <div className="px-10 py-10 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl shrink-0 relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent" />
        
        <div className="flex items-start gap-10 mb-10 relative z-10">
          <button 
            onClick={onBack}
            className="p-4 bg-white/5 lathed-border hover:bg-white/10 hover:text-cyan transition-all rounded-xl mt-1 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <span className="monoscale text-[9px] font-bold bg-cyan/10 text-cyan border border-cyan/20 px-3 py-1 rounded-md uppercase tracking-[0.3em]">
                Cluster_{workspaceId.slice(0, 8)}
              </span>
              <span className="monoscale text-[9px] font-medium text-white/30 uppercase tracking-[0.3em]">
                {workspace?.vertical?.replace('-', '_') || 'GENERAL'}
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase leading-none text-white">{workspace?.name || 'INITIALIZING...'}</h2>
          </div>
          
          <div className="flex gap-4 lg:gap-16 pt-2 h-full items-center">
            <button 
              onClick={handleEnterpriseAudit}
              disabled={isAuditing || files.length === 0}
              className="flex items-center gap-3 px-4 md:px-6 py-3 bg-cyan/10 border border-cyan/20 rounded-xl monoscale text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-cyan hover:bg-cyan hover:text-black transition-all disabled:opacity-30 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-cyan/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Zap className={`w-3 h-3 md:w-3.5 md:h-3.5 relative z-10 ${isAuditing ? 'animate-spin' : ''}`} />
              <span className="relative z-10">{isAuditing ? 'Auditing...' : 'Run_Audit'}</span>
            </button>
            <div className="hidden sm:flex flex-col items-end border-r border-white/5 pr-8 lg:pr-16">
              <span className="monoscale text-[7px] md:text-[8px] font-medium text-white/20 uppercase tracking-[0.4em]">Nodes</span>
              <span className="text-xl md:text-3xl font-bold text-white tracking-tighter">{files.length}</span>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="monoscale text-[7px] md:text-[8px] font-medium text-white/20 uppercase tracking-[0.4em]">Risk</span>
              <span className={`text-xl md:text-3xl font-bold tracking-tighter ${risks.length > 5 ? 'text-red-400 glow-red' : 'text-white'}`}>{risks.length}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-12 overflow-x-auto no-scrollbar pt-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 py-4 transition-all monoscale text-[10px] font-bold tracking-[0.2em] uppercase relative whitespace-nowrap
                ${activeTab === tab.id ? 'text-cyan opacity-100' : 'text-white/30 hover:text-white/60'}`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-cyan animate-pulse' : 'text-white/20'}`} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-underline" className="absolute -bottom-px left-0 right-0 h-0.5 bg-cyan glow-cyan" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Progress Overlay / Sidebar (Trace) */}
      <AnimatePresence>
        {isAuditing && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-[#050506]/95 backdrop-blur-3xl border-l border-white/5 z-[100] p-8 flex flex-col shadow-[-40px_0_100px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center justify-between mb-10">
               <h4 className="monoscale text-[10px] font-bold text-cyan uppercase tracking-[0.4em]">Neural_Trace</h4>
               <button onClick={() => setIsAuditing(false)} className="text-white/20 hover:text-white p-1">
                 <X className="w-4 h-4" />
               </button>
            </div>
            
            {auditError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] monoscale uppercase tracking-widest leading-relaxed">
                ERROR: {auditError}
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
               {auditTrace.map((event, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-2 group"
                 >
                   <div className="flex items-center justify-between">
                     <span className={`monoscale text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${
                       event.status === 'completed' ? 'bg-cyan/10 text-cyan' : 'bg-white/5 text-white/40'
                     }`}>
                       {event.agent}
                     </span>
                     <span className="monoscale text-[7px] text-white/10 uppercase tracking-tighter">
                       {new Date(event.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                     </span>
                   </div>
                   <p className={`text-[11px] leading-snug tracking-tight font-medium ${
                     event.status === 'completed' ? 'text-white/60 line-through decoration-cyan/30' : 'text-white/80'
                   }`}>
                     {event.action}...
                   </p>
                   {event.status === 'working' && (
                     <div className="w-full h-px bg-white/5 overflow-hidden">
                       <motion.div 
                         initial={{ x: '-100%' }}
                         animate={{ x: '100%' }}
                         transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                         className="w-1/2 h-full bg-cyan/40"
                       />
                     </div>
                   )}
                 </motion.div>
               ))}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5">
               <div className="flex items-center gap-3 monoscale text-[8px] text-white/20 uppercase tracking-[0.3em]">
                 <Layers className="w-3 h-3" />
                 <span>Sub-Agent Handover: Active</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {/* Background Atmospheric Lighting */}
        <div className="absolute top-1/4 -left-64 w-96 h-96 bg-cyan/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-violet/5 blur-[120px] rounded-full pointer-events-none" />

        <AnimatePresence mode="wait">
          {activeTab === 'mining' && (
            <motion.div 
              key="mining" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-[1600px] mx-auto relative z-10"
            >
              <div className="lg:col-span-2 space-y-10">
                <div className="glass-panel p-10 lathed-border relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 monoscale text-[8px]">BUFFER_READY</div>
                  <FileUpload workspaceId={workspaceId} />
                </div>
                
                <section>
                  <div 
                    onClick={() => document.getElementById('file-ingestion-input')?.click()}
                    className="flex items-center justify-between mb-8 border-b border-white/5 pb-6 cursor-pointer group/header transition-colors"
                  >
                    <h4 className="monoscale text-[10px] font-bold text-white/30 group-hover/header:text-cyan uppercase tracking-[0.4em] flex items-center gap-4 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-cyan/50 animate-pulse" />
                      Data Ingestion Buffer
                    </h4>
                    <span className="monoscale text-[8px] font-medium text-white/20 group-hover/header:text-cyan/40 uppercase tracking-[0.3em] transition-colors bg-white/5 px-2 py-1 rounded">
                      [+] INITIATE_MANUAL_INGESTION
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {files.map(file => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={file.id} 
                        onClick={() => setSelectedFile(file)}
                        className="glass-panel p-8 group hover:bg-white/5 transition-all cursor-pointer relative overflow-hidden lathed-border"
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-8">
                            <div className="p-4 bg-white/5 rounded-xl text-white group-hover:text-cyan transition-colors lathed-border">
                              <FileText className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="font-bold text-xl uppercase tracking-tighter mb-2 text-white/90 group-hover:text-white transition-colors">{file.title || file.originalFilename}</p>
                                <div className="flex items-center gap-4 monoscale text-[9px] font-medium uppercase tracking-widest text-white/20">
                                  <span className="bg-white/5 px-2 py-0.5 rounded">TYPE: {file.doc_type}</span>
                                  <span className="w-1 h-1 rounded-full bg-white/10" />
                                  <span className={file.status === 'processed' || file.status === 'completed' ? 'text-cyan/70' : 'text-violet/70'}>
                                    STATUS: {file.status.toUpperCase()}
                                  </span>
                                </div>
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5 opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all">
                            <ChevronRight className="w-5 h-5 text-cyan" />
                          </div>
                        </div>
                        {file.summary && (
                           <div className="mt-8 pt-8 border-t border-white/5 relative z-10">
                             <p className="text-xs font-medium text-white/30 leading-relaxed tracking-tight line-clamp-2 italic">
                               {file.summary}
                             </p>
                           </div>
                        )}
                        {/* Interactive scanline effect on hover */}
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-y-0 left-0 w-1 bg-cyan scale-y-0 group-hover:scale-y-100 transition-transform origin-top opacity-50" />
                      </motion.div>
                    ))}
                    {files.length === 0 && (
                      <button 
                        onClick={() => document.getElementById('file-ingestion-input')?.click()}
                        className="py-24 text-center glass-panel border-dashed hover:bg-white/5 transition-all cursor-pointer group w-full lathed-border"
                      >
                        <p className="monoscale text-[12px] font-medium text-white/10 group-hover:text-white/40 uppercase tracking-[0.5em] transition-colors">Standby. Awaiting Multimodal Input.</p>
                        <p className="monoscale text-[9px] font-medium text-white/5 group-hover:text-white/20 uppercase tracking-[0.3em] mt-4 transition-colors">Click to manually initiate ingestion</p>
                      </button>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-10">
                <section className="glass-panel p-8 lathed-border">
                  <h4 className="monoscale text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
                    <AlertTriangle className="w-5 h-5 text-violet/50" /> Operational Risks
                  </h4>
                  <div className="space-y-4">
                    {risks.map(risk => (
                      <div key={risk.id} className="p-6 bg-white/5 border border-white/5 rounded-xl group hover:border-violet/30 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-violet/20 to-transparent" />
                        <div className="flex items-center justify-between mb-4">
                           <span className={`monoscale text-[8px] font-bold px-3 py-1 rounded uppercase tracking-[0.2em] ${
                             risk.severity === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                             risk.severity === 'medium' ? 'bg-violet/10 text-violet-400 border border-violet/50' : 'bg-green-500/10 text-green-400'
                           }`}>
                             LVL_{risk.severity.toUpperCase()}
                           </span>
                           <span className="text-[8px] monoscale font-medium text-white/10 uppercase tracking-widest">{risk.evidence}</span>
                        </div>
                        <p className="font-bold text-sm uppercase text-white/80 mb-3 leading-tight tracking-tighter">{risk.title}</p>
                        <p className="text-[11px] text-white/30 leading-relaxed font-medium tracking-tight italic">{risk.rationale}</p>
                      </div>
                    ))}
                    {risks.length === 0 && (
                       <div className="p-12 text-center monoscale text-white/10 text-[9px] font-medium uppercase tracking-[0.4em] border border-dashed border-white/5 rounded-2xl italic">
                         Zero Threats Detected.
                       </div>
                    )}
                  </div>
                </section>

                <section className="glass-panel p-10 lathed-border relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5 monoscale text-[8px]">INGESTION_VOLUME_METRICS</div>
                   <h5 className="monoscale text-[9px] font-bold text-cyan/30 uppercase tracking-[0.4em] mb-10">Ingestion_Timeline</h5>
                   <div className="h-[350px] w-full min-h-[350px] relative">
                     <ResponsiveContainer width="99%" height={350}>
                        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.8} />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 700 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 700 }}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            contentStyle={{ 
                              backgroundColor: '#050506', 
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: '8px',
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              fontFamily: 'JetBrains Mono, monospace'
                            }}
                            itemStyle={{ color: '#22d3ee' }}
                          />
                          <Bar 
                            dataKey="count" 
                            radius={[4, 4, 0, 0]}
                            fill="url(#barGradient)"
                            animationDuration={1500}
                          >
                            {chartData.map((_, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                className="hover:opacity-100 transition-opacity" 
                                style={{ transition: 'opacity 0.3s' }}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                   </div>
                </section>

                <div className="glass-panel p-10 lathed-border relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5 monoscale text-[8px]">CORE_STATUS_ACTIVE</div>
                   <h5 className="monoscale text-[9px] font-bold text-cyan/30 uppercase tracking-[0.4em] mb-8">System_Diagnostics</h5>
                   <div className="space-y-8">
                    <div>
                      <div className="flex justify-between monoscale text-[9px] font-medium uppercase mb-3 tracking-widest">
                        <span className="text-white/40">Neural_Load</span>
                        <span className="text-cyan">42%</span>
                      </div>
                      <div className="h-[2px] bg-white/5 overflow-hidden rounded-full">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '42%' }}
                          className="h-full bg-cyan shadow-[0_0_10px_rgba(0,242,255,0.5)]" 
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between monoscale text-[9px] font-medium uppercase mb-3 tracking-widest">
                        <span className="text-white/40">Synthesis_Rate</span>
                        <span className="text-violet">98.2%</span>
                      </div>
                      <div className="h-[2px] bg-white/5 overflow-hidden rounded-full">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '98.2%' }}
                          className="h-full bg-violet shadow-[0_0_10px_rgba(139,92,246,0.5)]" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'neural' && (
            <motion.div 
              key="neural" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0 }}
              className="h-full flex flex-col max-w-6xl mx-auto w-full relative z-10"
            >
              <div className="flex-1 overflow-y-auto px-10 py-12 custom-scrollbar space-y-12">
                {chatHistory.map((chat, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={i} 
                    className="space-y-10"
                  >
                    <div className="flex justify-end">
                      <div className="glass-panel p-6 lathed-border max-w-xl group hover:border-cyan/30 transition-all bg-cyan/[0.02]">
                        <p className="text-sm font-bold uppercase tracking-tight text-white/90">{chat.question}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="glass-panel p-10 lathed-border max-w-4xl relative overflow-hidden group">
                        {/* Interactive scanline */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet/50 to-transparent" />
                        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent opacity-20" />
                        
                        <div className="flex items-center gap-6 mb-10 border-b border-white/5 pb-8">
                           <div className="p-3 bg-violet/10 rounded-xl lathed-border">
                             <Brain className="w-6 h-6 text-violet animate-pulse" />
                           </div>
                           <div className="flex flex-col gap-1">
                             <span className="monoscale font-bold text-[10px] uppercase tracking-[0.4em] text-white/30">Synthesis_Agent_Output</span>
                             <div className="flex items-center gap-4">
                               <span className="monoscale text-[9px] font-bold text-violet/60 uppercase tracking-widest border border-violet/20 px-2 py-0.5 rounded">Confidence: {chat.confidence}</span>
                               <span className="monoscale text-[8px] font-medium text-white/10 uppercase tracking-widest">DARK_DATA_MINER_SECURE_V1</span>
                             </div>
                           </div>
                        </div>
                        
                        <p className="text-lg leading-relaxed mb-12 text-white/80 tracking-tight font-medium italic select-text selection:bg-violet/30 selection:text-white">
                          {chat.answer}
                        </p>
                        
                        {chat.citations && chat.citations.length > 0 && (
                          <div className="space-y-6 pt-10 border-t border-white/5">
                             <div className="flex items-center justify-between">
                               <p className="monoscale text-[9px] font-bold text-white/20 uppercase tracking-[0.5em]">Extraction_Evidence_Nodes</p>
                               <span className="text-[8px] monoscale font-medium text-white/10 uppercase tracking-widest">{chat.citations.length} REFERENCES_SYNCED</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               {chat.citations.map((c: any, ci: number) => (
                                 <motion.div 
                                   whileHover={{ scale: 1.02 }}
                                   key={ci} 
                                   className="glass-panel p-6 border-white/5 hover:bg-white/5 transition-all lathed-border"
                                 >
                                   <div className="flex items-center justify-between mb-4">
                                      <span className="monoscale text-[9px] font-bold text-cyan/40 uppercase tracking-widest bg-cyan/5 px-2 py-1 rounded">Source: {c.location}</span>
                                      <Quote className="w-3 h-3 text-white/10" />
                                   </div>
                                   <p className="text-[13px] italic text-white/60 mb-6 leading-relaxed border-l border-white/5 pl-4">"{c.quote}"</p>
                                   <div className="pt-4 border-t border-white/5">
                                      <p className="text-[9px] font-bold uppercase text-white/20 tracking-[0.2em] leading-relaxed">
                                        <span className="text-violet/60 mr-2">LOG:</span> {c.why}
                                      </p>
                                   </div>
                                 </motion.div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center py-40 group">
                    <div className="relative mb-10">
                      <div className="absolute inset-0 bg-violet/20 blur-[80px] rounded-full group-hover:bg-violet/30 transition-all duration-1000" />
                      <Brain className="w-24 h-24 text-white/10 group-hover:text-white/20 transition-all relative z-10 animate-pulse duration-[4000ms]" />
                    </div>
                    <p className="monoscale text-xl font-bold text-white/10 uppercase tracking-[0.6em] group-hover:text-white/20 transition-all">Standby. Synthesis Agent Listening.</p>
                    <p className="monoscale text-[9px] font-medium text-white/5 uppercase tracking-[0.3em] mt-6">Dark Data Miner Core v1.0.0</p>
                  </div>
                )}
              </div>

              <div className="px-10 pb-10 pt-4 shrink-0 relative">
                <form onSubmit={handleAsk} className="relative group max-w-4xl mx-auto">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan/20 via-violet/20 to-cyan/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
                  <input 
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="INITIATE_KNOWLEDGE_EXTRACTION..."
                    className="w-full glass-panel lathed-border p-8 pr-24 rounded-2xl focus:shadow-[0_0_30px_rgba(34,211,238,0.1)] transition-all placeholder:text-white/10 monoscale font-bold uppercase text-xs relative z-10 outline-none hover:bg-white/[0.04]"
                    disabled={isAsking}
                  />
                  <button 
                    type="submit"
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/5 text-white/40 hover:text-cyan hover:bg-white/10 rounded-xl transition-all disabled:opacity-10 z-20 lathed-border group"
                    disabled={isAsking || !question.trim()}
                  >
                    <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </form>
                {isAsking && (
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                     <div className="w-1 h-1 bg-violet rounded-full animate-ping" />
                     <p className="monoscale text-[8px] font-bold text-violet/60 tracking-[0.4em] uppercase">Aggregating Cross-Domain Insights...</p>
                   </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'feed' && (
            <motion.div 
              key="feed" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="p-10 max-w-[1400px] mx-auto relative z-10"
            >
              <div className="flex items-center justify-between mb-12 border-b border-white/5 pb-8">
                 <h4 className="monoscale text-[11px] font-bold text-white/40 uppercase tracking-[0.5em] flex items-center gap-4">
                   <Clock className="w-5 h-5 text-cyan/40" /> Neural_Segment_Extraction
                 </h4>
                 <div className="flex items-center gap-4">
                    <div className="bg-white/5 px-4 py-2 rounded-xl lathed-border">
                      <span className="monoscale text-[9px] font-bold text-cyan/60 uppercase tracking-widest">NodesSynced_{segments.length}</span>
                    </div>
                 </div>
              </div>
              <div className="space-y-6">
                {segments.map((seg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i}
                    className="glass-panel p-10 group hover:bg-white/5 transition-all lathed-border relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan/20 scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                    <div className="flex gap-12">
                      <div className="w-40 shrink-0 flex flex-col items-end pt-1 border-r border-white/5 pr-10">
                        <span className="monoscale text-[14px] font-bold text-cyan tracking-widest tabular-nums">{seg.start}</span>
                        <span className="monoscale text-[9px] text-white/20 uppercase font-medium tracking-widest mt-2">{seg.speaker || 'SYSTEM_CORE'}</span>
                        {seg.topic && (
                           <span className="monoscale text-[8px] font-bold text-violet/40 uppercase tracking-widest mt-4 group-hover:text-violet/60 transition-colors">[{seg.topic.replace(/\s+/g, '_')}]</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-lg leading-relaxed text-white/70 italic tracking-tight group-hover:text-white transition-colors">{seg.text}</p>
                        {seg.entities && seg.entities.length > 0 && (
                          <div className="mt-8 flex flex-wrap gap-3">
                            {seg.entities.map((ent: string, ei: number) => (
                              <span key={ei} className="px-3 py-1 bg-white/5 text-white/40 border border-white/5 text-[9px] monoscale font-medium uppercase tracking-widest rounded hover:bg-cyan/10 hover:text-cyan hover:border-cyan/20 transition-all">
                                {ent}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {segments.length === 0 && (
                  <div className="py-40 text-center glass-panel border-dashed lathed-border">
                    <Clock className="w-16 h-16 text-white/5 mx-auto mb-8 animate-pulse" />
                    <p className="monoscale text-[11px] font-medium text-white/10 uppercase tracking-[0.5em]">Neural Stream Buffering...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'matrix' && (
             <motion.div 
              key="matrix" 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="p-10 max-w-[1600px] mx-auto relative z-10"
            >
              <div className="flex items-center justify-between mb-12 border-b border-white/5 pb-8">
                 <h4 className="monoscale text-[11px] font-bold text-white/40 uppercase tracking-[0.5em] flex items-center gap-4">
                   <Layers className="w-5 h-5 text-violet/40" /> Relational_Knowledge_Graph
                 </h4>
                 <div className="flex items-center gap-4">
                    <span className="monoscale text-[9px] font-bold text-violet/60 uppercase tracking-widest bg-violet/5 px-4 py-2 rounded-xl lathed-border">ObjectsSynced_{entities.length}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {entities.map((ent, i) => (
                  <motion.div 
                    whileHover={{ y: -5, scale: 1.02 }}
                    key={i} 
                    className="glass-panel p-10 group hover:bg-white/[0.04] transition-all duration-300 lathed-border relative overflow-hidden"
                  >
                     <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                        <Layers className="w-12 h-12 text-white" />
                     </div>
                     <div className="flex items-center justify-between mb-10">
                        <span className="monoscale text-[9px] font-bold bg-white/5 text-white/30 group-hover:text-violet group-hover:bg-violet/10 border border-white/5 px-3 py-1 rounded-md uppercase tracking-widest transition-all">{ent.type}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_10px_rgba(34,211,238,0.5)] animate-pulse" />
                     </div>
                     <h5 className="text-2xl font-bold tracking-tighter text-white/80 uppercase mb-4 leading-tight group-hover:text-white transition-colors">{ent.name}</h5>
                     <p className="text-[13px] text-white/40 group-hover:text-white/60 italic leading-relaxed mb-10 tracking-tight line-clamp-4">{ent.context || 'Autonomous entity node synchronized from dataset.'}</p>
                     
                     <div className="flex flex-wrap gap-2 pt-8 border-t border-white/5">
                       {(ent.mentions || []).map((m: string, mi: number) => (
                         <span key={mi} className="text-[8px] monoscale font-bold border border-white/10 text-white/20 px-2 py-0.5 uppercase tracking-widest hover:text-cyan hover:border-cyan/30 transition-all rounded">
                            {m}
                         </span>
                       ))}
                       {(ent.mentions || []).length === 0 && (
                          <span className="text-[8px] monoscale font-bold text-white/10 uppercase tracking-widest italic">No connections cached</span>
                       )}
                     </div>
                  </motion.div>
                ))}
                {entities.length === 0 && (
                   <div className="lg:col-span-4 py-40 text-center glass-panel border-dashed bg-white/[0.01] lathed-border w-full">
                      <Layers className="w-16 h-16 text-white/5 mx-auto mb-8 animate-pulse" />
                      <p className="monoscale text-[11px] font-medium text-white/10 uppercase tracking-[0.6em]">Awaiting Entity Extraction.</p>
                   </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'briefs' && (
            <motion.div 
              key="briefs" 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="p-10 max-w-6xl mx-auto space-y-24 relative z-10"
            >
              <div className="flex items-end justify-between border-b border-white/5 pb-12">
                <div>
                  <h3 className="text-6xl font-bold tracking-tighter uppercase mb-2 text-white">Intelligence Briefs</h3>
                  <p className="monoscale text-[10px] font-bold text-white/20 uppercase tracking-[0.5em]">Strategic Synthesis Repository</p>
                </div>
                <button 
                  onClick={handleGenerateBrief}
                  disabled={isGeneratingBrief}
                  className="bg-cyan text-black px-10 py-5 rounded-xl font-bold text-[11px] tracking-[0.2em] uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-4 border border-cyan/50 shadow-[0_0_20px_rgba(34,211,238,0.2)] disabled:opacity-20"
                >
                  {isGeneratingBrief ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : <Zap className="w-5 h-5 fill-current" />}
                  Generate Briefing
                </button>
              </div>

              <div className="space-y-32">
                {briefs.map((brief, i) => (
                  <motion.div 
                    key={brief.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-panel lathed-border relative group overflow-visible"
                  >
                    <div className="bg-white/[0.03] p-12 relative overflow-hidden rounded-t-[inherit]">
                       <div className="absolute -right-20 -top-20 w-80 h-80 bg-violet/5 blur-[100px] rounded-full pointer-events-none" />
                       <div className="flex items-center justify-between mb-10 relative">
                         <span className="monoscale text-[10px] font-bold text-white/20 uppercase tracking-[0.5em] bg-white/5 px-3 py-1 rounded">Secret // Auth_Node_{brief.id.slice(0, 6)}</span>
                         <span className="monoscale text-[10px] font-bold text-white/20 uppercase tabular-nums tracking-widest">{new Date(brief.createdAt?.seconds * 1000).toLocaleString()}</span>
                       </div>
                       <h4 className="text-7xl font-bold tracking-tighter uppercase mb-10 relative text-white group-hover:text-cyan transition-colors">{brief.title}</h4>
                       <div className="flex items-start gap-10 text-white/60 relative">
                         <Quote className="w-10 h-10 text-cyan/20 shrink-0" />
                         <p className="text-2xl font-medium italic tracking-tight leading-relaxed lg:max-w-4xl pr-12 text-white/80">"{brief.tldr}"</p>
                       </div>
                    </div>
                    
                    <div className="p-12 space-y-20">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                        <section>
                           <h5 className="monoscale text-[11px] font-bold text-cyan/40 uppercase tracking-[0.6em] mb-10 border-b border-white/5 pb-4">Key Findings</h5>
                           <ul className="space-y-8">
                             {brief.key_findings?.map((f: string, j: number) => (
                               <li key={j} className="flex gap-6 group/item">
                                 <span className="monoscale text-[10px] font-bold text-violet/40 pt-1">0{j+1}</span>
                                 <p className="text-[15px] text-white/60 leading-relaxed font-medium tracking-tight group-hover/item:text-white/90 transition-colors uppercase italic">{f}</p>
                               </li>
                             ))}
                           </ul>
                        </section>
                        <section>
                           <h5 className="monoscale text-[11px] font-bold text-red-100/40 uppercase tracking-[0.6em] mb-10 border-b border-white/5 pb-4">Risk Audit</h5>
                           <div className="space-y-4">
                             {brief.risk_summary?.map((rs: any, rsi: number) => (
                               <div key={rsi} className="flex items-center justify-between p-5 border border-white/5 bg-white/[0.01] rounded-xl group/risk hover:border-red-400/30 transition-all">
                                 <span className="text-sm font-bold text-white/60 group-hover/risk:text-white transition-colors uppercase italic">{rs.risk}</span>
                                 <span className={`monoscale text-[8px] font-bold px-2 py-1 rounded uppercase tracking-widest ${
                                     rs.severity === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(248,113,113,0.1)]' : 
                                     rs.severity === 'medium' ? 'bg-violet/10 text-violet-400' : 'bg-green-500/10 text-green-400'
                                   }`}>
                                   {rs.severity.toUpperCase()}
                                 </span>
                               </div>
                             ))}
                           </div>
                        </section>
                      </div>

                      <section>
                         <h5 className="monoscale text-[11px] font-bold text-cyan/40 uppercase tracking-[0.6em] mb-10 border-b border-white/5 pb-4">Recommended Actions</h5>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           {brief.recommended_actions?.map((ra: any, rai: number) => (
                             <div key={rai} className="glass-panel p-8 lathed-border relative group/action overflow-hidden">
                               <div className="absolute top-0 right-0 p-4 opacity-5 monoscale text-[8px]">{ra.owner}</div>
                               <div className="flex items-center justify-between mb-8">
                                  <span className={`monoscale text-[8px] font-bold px-3 py-1 rounded uppercase tracking-widest ${
                                    ra.priority === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-violet/10 text-violet-400'
                                  }`}>
                                    {ra.priority.toUpperCase()}_PRIORITY
                                  </span>
                               </div>
                               <p className="text-lg font-bold text-white/80 group-hover/action:text-cyan transition-colors uppercase tracking-tight leading-snug">{ra.action}</p>
                             </div>
                           ))}
                         </div>
                      </section>

                      <section>
                         <h5 className="monoscale text-[11px] font-bold text-white/10 uppercase tracking-[0.6em] mb-10 border-b border-white/5 pb-4">Intelligence Draft</h5>
                         <div className="glass-panel p-10 bg-white/[0.01] relative overflow-hidden group/draft">
                            <Quote className="absolute top-6 right-6 w-16 h-16 text-white/[0.02] group-hover:text-white/[0.05] transition-all" />
                            <p className="text-[13px] leading-relaxed text-white/30 font-mono italic whitespace-pre-wrap selection:bg-cyan/30 selection:text-white">{brief.next_steps_email}</p>
                         </div>
                      </section>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'collaborators' && (
            <motion.div 
              key="collaborators" 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="p-10 max-w-4xl mx-auto space-y-16 relative z-10"
            >
               <div className="glass-panel p-12 lathed-border relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-5 transition-opacity monoscale text-[8px]">SECURITY_PROTOCOL_LEVEL_4</div>
                 <h3 className="text-5xl font-bold tracking-tighter uppercase mb-2 text-white">Cluster Access</h3>
                 <p className="monoscale text-[10px] font-bold text-white/20 uppercase tracking-[0.5em] mb-12">User Permissions & Authentication Nodes</p>
                 
                 {workspace?.userId === user?.uid && (
                   <form onSubmit={handleAddCollaborator} className="flex gap-6 mb-16 relative z-10">
                     <div className="relative flex-1 group">
                       <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-cyan transition-colors" />
                       <input 
                         value={newCollaboratorId}
                         onChange={e => setNewCollaboratorId(e.target.value)}
                         placeholder="node_identifier (email or uid)"
                         className="w-full bg-white/5 border border-white/5 pl-16 pr-8 py-5 rounded-xl text-sm font-bold uppercase tracking-widest focus:border-cyan/50 focus:bg-white/[0.08] transition-all outline-none"
                       />
                     </div>
                     <button 
                       type="submit"
                       disabled={isAddingCollaborator || !newCollaboratorId}
                       className="bg-cyan text-black px-10 py-5 rounded-xl font-bold text-[11px] tracking-[0.2em] uppercase hover:scale-105 active:scale-95 transition-all disabled:opacity-20 flex items-center gap-3 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                     >
                       {isAddingCollaborator ? 'SYNCHRONIZING...' : 'PROVISION_ACCESS'}
                     </button>
                   </form>
                 )}

                 <div className="space-y-8">
                   <h6 className="monoscale text-[9px] font-bold text-white/10 uppercase tracking-[0.5em] mb-6 px-2">Active_Nodes</h6>
                   
                   <div className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-xl group hover:bg-black/40 transition-all border-l-2 border-l-cyan/50">
                     <div className="flex items-center gap-6">
                       <div className="w-12 h-12 rounded-xl bg-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)] flex items-center justify-center text-black">
                          <ShieldCheck className="w-6 h-6" />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-base font-bold text-white/90 tabular-nums">Root Administrator (You)</span>
                          <span className="monoscale text-[8px] font-medium text-white/20 uppercase tracking-widest mt-1">{workspace?.userId}</span>
                       </div>
                     </div>
                     <span className="monoscale text-[8px] font-bold text-cyan/60 uppercase tracking-widest px-3 py-1 bg-cyan/5 border border-cyan/20 rounded">LEVEL_0_ROOT</span>
                   </div>

                   {(workspace?.collaborators || []).map((uid: string) => (
                     <div key={uid} className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-xl group hover:bg-white/5 transition-all">
                       <div className="flex items-center gap-6">
                         <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-white/40 group-hover:text-cyan transition-colors">
                            <Users className="w-6 h-6" />
                         </div>
                         <div className="flex flex-col">
                            <span className="text-base font-bold text-white/80 tabular-nums">{uid}</span>
                            <span className="monoscale text-[8px] font-medium text-white/20 uppercase tracking-widest mt-1">Authenticated Operator</span>
                         </div>
                       </div>
                       {workspace?.userId === user?.uid && (
                         <button 
                           onClick={() => removeCollaborator(uid)}
                           className="p-3 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                         >
                           <X className="w-5 h-5" />
                         </button>
                       )}
                     </div>
                   ))}

                   {(!workspace?.collaborators || workspace.collaborators.length === 0) && (
                     <div className="py-24 text-center glass-panel border-dashed lathed-border opacity-20">
                       <Users className="w-16 h-16 mx-auto mb-6 opacity-20" />
                       <p className="monoscale text-[10px] font-bold uppercase tracking-[0.5em]">No secondary nodes detected</p>
                     </div>
                   )}
                 </div>
               </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedFile && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-20 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFile(null)}
              className="absolute inset-0 bg-[#050506]/90 backdrop-blur-3xl"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan/10 via-transparent to-transparent pointer-events-none" />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative w-full max-w-7xl h-full glass-panel lathed-border overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.9)] bg-white/[0.01]"
            >
              <div className="p-10 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                 <div className="flex-1">
                   <div className="flex items-center gap-4 mb-4">
                     <span className="monoscale text-[9px] font-bold bg-cyan/10 text-cyan px-2 py-0.5 uppercase tracking-widest border border-cyan/20 rounded">{selectedFile.doc_type}</span>
                     <span className="monoscale text-[9px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">NODE_{selectedFile.id.slice(0, 8)}</span>
                   </div>
                   <h2 className="text-4xl font-bold uppercase tracking-tighter text-white/90">{selectedFile.title || selectedFile.originalFilename}</h2>
                 </div>
                 <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-4 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all lathed-border"
                 >
                   <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 space-y-20 no-scrollbar relative">
                {/* Background glow for summary */}
                <div className="absolute top-0 left-0 w-80 h-80 bg-violet/5 blur-[120px] pointer-events-none" />

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-16 relative z-10">
                  <div className="lg:col-span-2 space-y-8">
                     <h3 className="monoscale text-[10px] font-bold uppercase tracking-[0.5em] text-cyan/40 border-b border-white/5 pb-4">Extraction_Synthesis</h3>
                     <p className="text-2xl leading-relaxed italic text-white/70 font-medium tracking-tight whitespace-pre-wrap">{selectedFile.summary}</p>
                  </div>
                  <div className="glass-panel p-8 lathed-border space-y-10 bg-white/[0.01]">
                    <h3 className="monoscale text-[10px] font-bold uppercase tracking-[0.5em] text-white/20 border-b border-white/5 pb-4">Operational_Meta</h3>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="monoscale text-[9px] font-bold uppercase text-white/20 tracking-widest">Language</span>
                        <span className="monoscale text-xs font-bold uppercase text-white/60 tracking-widest">{selectedFile.language || 'EN_DOMINANT'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="monoscale text-[9px] font-bold uppercase text-white/20 tracking-widest">Integrity</span>
                        <span className="monoscale text-xs font-bold uppercase text-cyan tracking-widest">SECURE_PASS</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="monoscale text-[9px] font-bold uppercase text-white/20 tracking-widest">Index_Nodes</span>
                        <span className="monoscale text-xs font-bold uppercase text-white/60 tracking-widest">{(selectedFile as any).transcript_segments?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <div className="space-y-10">
                    <h3 className="monoscale text-[10px] font-bold uppercase tracking-[0.5em] text-violet/40 border-b border-white/5 pb-4">Key_Knowledge_Clusters</h3>
                    <div className="flex flex-wrap gap-3">
                      {selectedFile.key_topics?.map((topic: string, i: number) => (
                        <div key={i} className="px-5 py-3 glass-panel lathed-border bg-white/[0.02] text-white/60 font-bold uppercase text-[11px] tracking-widest hover:text-cyan hover:border-cyan/30 transition-all cursor-default">
                          {topic}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-10">
                    <h3 className="monoscale text-[10px] font-bold uppercase tracking-[0.5em] text-cyan/40 border-b border-white/5 pb-4">Verified_Truth_Particles</h3>
                    <div className="space-y-6">
                      {selectedFile.key_quotes?.map((quote: any, i: number) => (
                        <div key={i} className="p-8 glass-panel lathed-border bg-white/[0.01] relative group">
                          <Quote className="absolute top-6 right-6 w-10 h-10 text-white/[0.02] group-hover:text-cyan/10 transition-colors" />
                          <p className="text-lg italic text-white/60 leading-relaxed mb-6 font-medium tracking-tight">"{quote.text}"</p>
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                            <span className="monoscale text-[9px] font-bold text-white/20 uppercase tracking-widest">{quote.location}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="space-y-10">
                  <h3 className="monoscale text-[10px] font-bold uppercase tracking-[0.5em] text-white/20 border-b border-white/5 pb-4">Relational_Nodes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {selectedFile.speakers?.map((speaker: any, i: number) => (
                      <div key={i} className="p-6 glass-panel lathed-border bg-white/[0.01] flex items-center gap-6 group hover:bg-white/[0.04] transition-all">
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 text-white/20 flex items-center justify-center font-bold text-lg group-hover:text-cyan group-hover:border-cyan/20 transition-all">
                          {speaker.name ? speaker.name[0] : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white/80 uppercase tracking-tight mb-1">{speaker.name}</p>
                          <p className="monoscale text-[8px] font-bold text-white/20 uppercase tracking-widest">{speaker.role || 'GHOST_OPERATOR'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              
              <div className="p-10 border-t border-white/5 bg-black/40 flex items-center justify-between monoscale text-[10px] font-bold uppercase tracking-[0.5em] text-white/20">
                <div className="flex items-center gap-4">
                   <div className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                   <span>Neural_Buffer_Active</span>
                </div>
                <span>End_Transmission_V4.2.0</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
