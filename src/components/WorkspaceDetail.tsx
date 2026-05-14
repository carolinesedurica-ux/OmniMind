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
import { motion, AnimatePresence } from 'motion/react';
import FileUpload from './FileUpload';
import { askWorkspace, generateExecutiveBrief } from '../services/aiService';
import { handleFirestoreError, OperationType } from '../lib/error-utils';

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

  const [isVercel, setIsVercel] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsVercel(window.location.hostname.includes('vercel.app'));
    }
  }, []);

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

      const brief = await generateExecutiveBrief(workspaceContext);
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
    { id: 'mining', label: 'Multimodal Ingestion', icon: Activity },
    { id: 'feed', label: 'Neural Stream', icon: Clock },
    { id: 'matrix', label: 'Knowledge Matrix', icon: Layers },
    { id: 'neural', label: 'Dark Synthesis', icon: Brain },
    { id: 'briefs', label: 'Executive Intelligence', icon: ShieldCheck },
    { id: 'collaborators', label: 'Access Control', icon: Users },
  ];

  return (
    <div className="h-full flex flex-col bg-[#F0F0EE] overflow-hidden selection:bg-black selection:text-white">
      {/* Detail Header */}
      <div className="px-10 py-8 border-b-2 border-black bg-white shrink-0">
        <div className="flex items-start gap-8 mb-8">
          <button 
            onClick={onBack}
            className="p-3 border-2 border-black hover:bg-black hover:text-white transition-all rounded-none mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="monoscale text-[10px] font-black bg-black text-white px-2 py-0.5 uppercase tracking-[0.2em]">
                Cluster_{workspaceId.slice(0, 8)}
              </span>
              <span className="monoscale text-[10px] font-black text-black/30 uppercase tracking-[0.2em]">
                {workspace?.vertical?.replace('-', '_') || 'GENERAL'}
              </span>
            </div>
            <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">{workspace?.name || 'INITIALIZING...'}</h2>
          </div>
          
          <div className="hidden lg:flex gap-16 pt-2">
            <div className="flex flex-col items-end">
              <span className="monoscale text-[9px] font-black text-black/30 uppercase tracking-widest">Active_Nodes</span>
              <span className="text-xl font-black">{files.length}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="monoscale text-[9px] font-black text-black/30 uppercase tracking-widest">Risk_Index</span>
              <span className={`text-xl font-black ${risks.length > 5 ? 'text-red-500' : 'text-black'}`}>{risks.length}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-12 overflow-x-auto no-scrollbar pt-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 py-3 transition-all monoscale text-[11px] font-black tracking-[0.1em] uppercase relative whitespace-nowrap
                ${activeTab === tab.id ? 'text-black opacity-100' : 'text-black/30 hover:text-black/60'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-underline" className="absolute -bottom-0.5 left-0 right-0 h-1 bg-black" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-[#F0F0EE]">
        <AnimatePresence mode="wait">
          {activeTab === 'mining' && (
            <motion.div 
              key="mining" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-[1600px] mx-auto"
            >
              <div className="lg:col-span-2 space-y-10">
                <div className="bg-white border-2 border-black p-8">
                  <FileUpload workspaceId={workspaceId} />
                </div>
                
                <section>
                  <div 
                    onClick={() => document.getElementById('file-ingestion-input')?.click()}
                    className="flex items-center justify-between mb-6 border-b border-black/10 pb-4 cursor-pointer group/header hover:border-black transition-colors"
                  >
                    <h4 className="monoscale text-[11px] font-black text-black/40 group-hover/header:text-black uppercase tracking-[0.2em] flex items-center gap-3 transition-colors">
                      <Activity className="w-5 h-5" /> Data Ingestion Buffer
                    </h4>
                    <span className="monoscale text-[9px] font-black text-black/20 group-hover/header:text-black/40 uppercase tracking-widest transition-colors">
                      [+] INITIATE_MANUAL_INGESTION
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {files.map(file => (
                      <div 
                        key={file.id} 
                        onClick={() => setSelectedFile(file)}
                        className="bg-white border-2 border-black p-6 group hover:bg-black hover:text-white transition-all cursor-pointer relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-6">
                            <div className="p-3 bg-black/5 group-hover:bg-white/10 text-black group-hover:text-white transition-colors">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-black text-lg uppercase tracking-tight mb-1">{file.title || file.originalFilename}</p>
                              <div className="flex items-center gap-3 monoscale text-[9px] font-black uppercase tracking-widest opacity-40">
                                <span>TYPE: {file.doc_type}</span>
                                <span>•</span>
                                <span className={file.status === 'processed' || file.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}>STATUS: {file.status}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                        </div>
                        {file.summary && (
                           <div className="mt-6 pt-6 border-t border-black/10 group-hover:border-white/10 relative z-10">
                             <p className="text-xs italic serif leading-relaxed opacity-60">
                               {file.summary}
                             </p>
                           </div>
                        )}
                        {/* Interactive hover background */}
                        <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      </div>
                    ))}
                    {files.length === 0 && (
                      <button 
                        onClick={() => document.getElementById('file-ingestion-input')?.click()}
                        className="py-24 text-center bg-black/5 border-2 border-black border-dashed hover:bg-black/10 transition-all cursor-pointer group w-full"
                      >
                        <p className="monoscale text-[11px] font-black text-black/30 group-hover:text-black uppercase tracking-[0.3em]">Standby. Awaiting Multimodal Input.</p>
                        <p className="monoscale text-[9px] font-black text-black/20 group-hover:text-black/40 uppercase tracking-[0.2em] mt-2">Click to manually initiate ingestion</p>
                      </button>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-10">
                <section className="bg-white border-2 border-black p-8">
                  <h4 className="monoscale text-[11px] font-black text-black uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" /> Operational Risks
                  </h4>
                  <div className="space-y-4">
                    {risks.map(risk => (
                      <div key={risk.id} className="p-6 bg-[#F8F8F8] border border-black/10 group hover:border-black transition-all">
                        <div className="flex items-center justify-between mb-4">
                           <span className="monoscale text-[9px] font-black text-white bg-black px-2 py-0.5 uppercase tracking-widest">
                             LVL_{risk.severity.toUpperCase()}
                           </span>
                           <span className="text-[9px] monoscale font-black text-black/20 uppercase tracking-widest">{risk.evidence}</span>
                        </div>
                        <p className="font-black text-sm uppercase mb-2 leading-tight">{risk.title}</p>
                        <p className="text-[11px] text-black/50 leading-relaxed italic serif">{risk.rationale}</p>
                      </div>
                    ))}
                    {risks.length === 0 && (
                       <div className="p-8 text-center monoscale text-black/20 text-[10px] font-black uppercase tracking-widest border border-dashed border-black/10 italic">
                         Zero Threats Detected.
                       </div>
                    )}
                  </div>
                </section>

                <div className="p-8 bg-black text-white border-2 border-black">
                  <h5 className="monoscale text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Core_Operational_Metrics</h5>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between monoscale text-[10px] font-black uppercase mb-1">
                        <span>CPU_Load</span>
                        <span>42%</span>
                      </div>
                      <div className="h-1 bg-white/10 overflow-hidden">
                        <div className="h-full bg-white w-[42%]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between monoscale text-[10px] font-black uppercase mb-1">
                        <span>Neural_Sync</span>
                        <span>98.2%</span>
                      </div>
                      <div className="h-1 bg-white/10 overflow-hidden">
                        <div className="h-full bg-white w-[98.2%]" />
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
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="h-full flex flex-col max-w-5xl mx-auto w-full relative"
            >
              <div className="flex-1 overflow-y-auto pt-10 px-10 pb-4 no-scrollbar">
                {isVercel && !(typeof process !== 'undefined' && (process.env.API_KEY || process.env.GEMINI_API_KEY)) && !window.sessionStorage.getItem('OMNIMIND_AI_KEY') && (
                  <div className="mb-10 p-8 border-2 border-red-500 bg-red-500/5 text-red-500 text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 mx-auto" />
                    <h5 className="text-xl font-black uppercase tracking-tight">Neural Core Offline</h5>
                    <p className="text-sm monoscale font-black uppercase tracking-widest opacity-80">
                      GEMINI_API_KEY is not configured in Vercel environment.
                    </p>
                    <div className="pt-4 flex flex-col gap-4 max-w-sm mx-auto">
                      <p className="text-[10px] monoscale font-black uppercase tracking-tighter opacity-60">
                        Temporary Bypass: Run the following in your browser console:
                      </p>
                      <code className="text-[9px] bg-black text-white p-3 break-all focus:select-all cursor-pointer">
                        window.sessionStorage.setItem('OMNIMIND_AI_KEY', 'YOUR_KEY_HERE')
                      </code>
                      <button 
                        onClick={() => window.location.reload()}
                        className="bg-black text-white py-3 font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all"
                      >
                        Reload Core
                      </button>
                    </div>
                  </div>
                )}
                {chatHistory.map((chat, i) => (
                  <div key={i} className="space-y-6">
                    <div className="flex justify-end">
                      <div className="bg-white border-2 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-xl">
                        <p className="text-sm font-black uppercase tracking-tight">{chat.question}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-black text-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] max-w-3xl">
                        <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
                           <Brain className="w-6 h-6 text-white" />
                           <div className="flex flex-col">
                             <span className="monoscale font-black text-[10px] uppercase tracking-widest text-white/40">Knowledge Synthesis Output</span>
                             <span className="monoscale text-[9px] font-black text-white/60">Confidence Score: {chat.confidence}</span>
                           </div>
                        </div>
                        <p className="text-base leading-relaxed mb-8 italic serif">{chat.answer}</p>
                        
                        {chat.citations && chat.citations.length > 0 && (
                          <div className="space-y-4 pt-6 border-t border-white/10">
                             <p className="monoscale text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Evidence Log</p>
                             <div className="grid grid-cols-1 gap-3">
                               {chat.citations.map((c: any, ci: number) => (
                                 <div key={ci} className="bg-white/5 p-5 border border-white/5 hover:border-white/20 transition-all">
                                   <div className="flex items-center justify-between mb-3">
                                      <span className="monoscale text-[10px] font-black text-white/40 uppercase">Source: {c.location}</span>
                                      <Quote className="w-4 h-4 text-white/10" />
                                   </div>
                                   <p className="text-sm italic serif text-white/80 mb-4 leading-relaxed">"{c.quote}"</p>
                                   <div className="pl-4 border-l-2 border-white/10">
                                      <p className="text-[10px] font-black uppercase text-white/40 tracking-wider">Analysis: {c.why}</p>
                                   </div>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
                {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 py-32">
                    <Brain className="w-32 h-32 mb-8" />
                    <p className="monoscale text-xl font-black uppercase tracking-[0.5em]">Standby. Awaiting Pulse.</p>
                  </div>
                )}
              </div>

              <div className="p-10 pt-0 shrink-0">
                <form onSubmit={handleAsk} className="relative group">
                  <div className="absolute -inset-2 bg-black opacity-0 group-focus-within:opacity-10 blur-xl transition-all" />
                  <input 
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask the Neural Core..."
                    className="w-full bg-white border-2 border-black p-6 pr-20 rounded-none shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-black/30 monoscale font-black uppercase text-sm relative z-10"
                    disabled={isAsking}
                  />
                  <button 
                    type="submit"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black text-white p-3 rounded-none hover:scale-110 active:scale-95 transition-all disabled:opacity-30 z-20"
                    disabled={isAsking || !question.trim()}
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </form>
                {isAsking && (
                   <p className="text-center monoscale text-[10px] mt-8 font-black tracking-[0.3em] uppercase animate-pulse">Aggregating Cross-Domain Insights...</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'feed' && (
            <motion.div 
              key="feed" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-10 space-y-8 max-w-5xl mx-auto"
            >
              <div className="mb-12 border-b-2 border-black pb-8">
                <h3 className="text-4xl font-black tracking-tighter uppercase mb-2">Neural Stream</h3>
                <p className="monoscale text-[10px] font-black text-black/40 uppercase tracking-[0.3em]">Real-time Segment Reconstruction</p>
              </div>

              {segments.map((seg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-10 group"
                >
                  <div className="w-32 shrink-0 flex flex-col items-end pt-2">
                    <span className="monoscale text-[13px] font-black text-black tracking-tighter group-hover:scale-110 transition-transform">{seg.start}</span>
                    <span className="monoscale text-[9px] text-black/30 uppercase font-black tracking-widest mt-1">{seg.speaker || 'SYSTEM'}</span>
                  </div>
                  <div className="flex-1 pb-12 border-l-2 border-black/10 pl-10 relative">
                    <div className="absolute top-2.5 -left-[6px] w-[10px] h-[10px] bg-black/10 group-hover:bg-black transition-colors" />
                    <div className="bg-white p-8 border-2 border-transparent group-hover:border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0)] group-hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                       {seg.topic && (
                         <div className="flex items-center gap-2 mb-6">
                           <span className="monoscale text-[10px] font-black text-white bg-black px-2 py-0.5 uppercase tracking-widest font-black">TOPIC_{seg.topic.replace(/\s+/g, '_').toUpperCase()}</span>
                         </div>
                       )}
                       <p className="text-lg leading-relaxed text-black italic serif">{seg.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {segments.length === 0 && (
                <div className="text-center py-48 opacity-20">
                  <Clock className="w-24 h-24 mx-auto mb-8" />
                  <p className="monoscale text-xl font-black uppercase tracking-[0.5em]">Stream Buffering...</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'matrix' && (
             <motion.div 
              key="matrix" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-10 max-w-[1600px] mx-auto"
            >
              <div className="mb-12 border-b-2 border-black pb-8">
                <h3 className="text-4xl font-black tracking-tighter uppercase mb-2">Entity Matrix</h3>
                <p className="monoscale text-[10px] font-black text-black/40 uppercase tracking-[0.3em]">Cross-Reference Object Index</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 border-l border-t border-black">
                {entities.map((ent, i) => (
                  <div key={i} className="bg-white border-r border-b border-black p-8 group hover:bg-black hover:text-white transition-all duration-300">
                     <div className="flex items-center justify-between mb-8">
                        <span className="monoscale text-[10px] font-black bg-black text-white group-hover:bg-white group-hover:text-black px-2 py-0.5 uppercase tracking-widest">{ent.type}</span>
                        <Layers className="w-5 h-5 opacity-20 group-hover:opacity-100" />
                     </div>
                     <h5 className="text-2xl font-black tracking-tighter uppercase mb-4 leading-tight group-hover:translate-x-2 transition-transform">{ent.name}</h5>
                     <p className="text-xs text-black/40 group-hover:text-white/50 italic serif mb-8 line-clamp-4 leading-relaxed">{ent.context}</p>
                     
                     <div className="flex flex-wrap gap-2">
                       {ent.mentions?.map((m: string, mi: number) => (
                         <span key={mi} className="text-[9px] monoscale font-black border border-current opacity-30 px-2 py-0.5 uppercase tracking-widest hover:opacity-100 transition-opacity">
                            {m}
                         </span>
                       ))}
                     </div>
                  </div>
                ))}
              </div>
              {entities.length === 0 && (
                <div className="text-center py-48 opacity-20">
                  <Layers className="w-24 h-24 mx-auto mb-8" />
                  <p className="monoscale text-xl font-black uppercase tracking-[0.5em]">Matrix Offline</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'briefs' && (
            <motion.div 
              key="briefs" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-10 max-w-6xl mx-auto space-y-16"
            >
              <div className="flex items-end justify-between border-b-2 border-black pb-8">
                <div>
                  <h3 className="text-5xl font-black tracking-tighter uppercase mb-2">Intelligence Briefs</h3>
                  <p className="monoscale text-[10px] font-black text-black/40 uppercase tracking-[0.4em]">Strategic Synthesis Repository</p>
                </div>
                <button 
                  onClick={handleGenerateBrief}
                  disabled={isGeneratingBrief}
                  className="bg-black text-white px-10 py-5 rounded-none font-black text-[11px] tracking-[0.2em] uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-4 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]"
                >
                  {isGeneratingBrief ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />}
                  Generate Briefing
                </button>
              </div>

              <div className="space-y-20">
                {briefs.map((brief, i) => (
                  <motion.div 
                    key={brief.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white border-2 border-black shadow-[24px_24px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                  >
                    <div className="bg-black text-white p-10 relative overflow-hidden">
                       <div className="absolute -right-8 -top-8 border-2 border-white/5 w-64 h-64 rounded-full" />
                       <div className="flex items-center justify-between mb-6 relative">
                         <span className="monoscale text-[11px] font-black text-white/40 uppercase tracking-[0.4em]">Secret // Node_Ref_{brief.id.slice(0, 6)}</span>
                         <span className="monoscale text-[11px] font-black text-white/40">{new Date(brief.createdAt?.seconds * 1000).toLocaleString()}</span>
                       </div>
                       <h4 className="text-6xl font-black tracking-tighter uppercase mb-6 relative">{brief.title}</h4>
                       <div className="flex items-center gap-4 text-white/60 relative">
                         <Quote className="w-8 h-8 opacity-20" />
                         <p className="text-xl font-medium italic serif leading-relaxed lg:max-w-3xl pr-12">"{brief.tldr}"</p>
                       </div>
                    </div>
                    
                    <div className="p-12 grid grid-cols-1 md:grid-cols-2 gap-20">
                      <div className="space-y-12">
                        <section>
                          <h5 className="monoscale text-[11px] font-black text-black/30 mb-6 uppercase tracking-[0.3em] border-b border-black/10 pb-2">Core_Findings</h5>
                          <ul className="space-y-6">
                            {brief.key_findings?.map((f: string, j: number) => (
                              <li key={j} className="flex gap-5 text-base leading-relaxed italic serif">
                                <span className="monoscale text-[10px] font-black text-black/20 pt-1.5">[{String(j+1).padStart(2, '0')}]</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </section>

                        <section>
                          <h5 className="monoscale text-[11px] font-black text-black/30 mb-6 uppercase tracking-[0.3em] border-b border-black/10 pb-2">Strategic_Actions</h5>
                          <div className="space-y-4">
                            {brief.recommended_actions?.map((ra: any, j: number) => (
                              <div key={j} className="p-6 border-2 border-black bg-black/5 hover:bg-black hover:text-white transition-colors group">
                                <div className="flex items-center justify-between mb-4">
                                  <span className="monoscale text-[9px] font-black uppercase tracking-widest border border-current px-2 py-0.5">{ra.priority}_PRIORITY</span>
                                  <span className="monoscale text-[10px] font-black tracking-widest opacity-40 group-hover:opacity-100">{ra.owner}</span>
                                </div>
                                <p className="text-lg font-black uppercase tracking-tight leading-tight">{ra.action}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>

                      <div className="space-y-12">
                        <section>
                          <h5 className="monoscale text-[11px] font-black text-black/30 mb-6 uppercase tracking-[0.3em] border-b border-black/10 pb-2">Risk_Landscape_Audit</h5>
                          <div className="grid grid-cols-1 gap-2">
                            {brief.risk_summary?.map((rs: any, j: number) => (
                              <div key={j} className="flex justify-between items-center p-4 border border-black/10 hover:border-black transition-all">
                                <span className="text-sm font-black uppercase tracking-tight">{rs.risk}</span>
                                <span className={`monoscale text-[9px] font-black px-2 py-1 uppercase tracking-widest ${
                                  rs.severity === 'high' ? 'bg-red-500 text-white' : 
                                  rs.severity === 'medium' ? 'bg-yellow-400 text-black' : 'bg-green-500 text-white'
                                }`}>
                                  {rs.severity.toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section>
                          <h5 className="monoscale text-[11px] font-black text-black/30 mb-6 uppercase tracking-[0.3em] border-b border-black/10 pb-2">Intelligence_Draft</h5>
                          <div className="p-8 bg-[#F8F8F8] border border-black/5 relative">
                            <Quote className="absolute top-4 right-4 w-12 h-12 text-black/5" />
                            <p className="text-xs font-mono text-black/60 leading-relaxed whitespace-pre-wrap italic relative">
                              {brief.next_steps_email}
                            </p>
                          </div>
                        </section>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'collaborators' && (
            <motion.div 
              key="collaborators" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-10 max-w-5xl mx-auto"
            >
              <div className="bg-white border-2 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
                <div className="p-12 border-b border-black/10">
                  <h3 className="text-4xl font-black tracking-tighter uppercase mb-4">Neural Gate Access</h3>
                  <p className="monoscale text-[11px] font-black text-black/40 uppercase tracking-[0.3em]">Multi-Signature Node authorization control</p>
                </div>
                
                <div className="p-12 space-y-12">
                  {workspace?.userId === user?.uid && (
                    <form onSubmit={handleAddCollaborator} className="flex gap-4">
                      <div className="flex-1 relative group">
                        <div className="absolute inset-0 bg-black opacity-0 group-focus-within:opacity-5 transition-opacity" />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/30" />
                        <input 
                          value={newCollaboratorId}
                          onChange={e => setNewCollaboratorId(e.target.value)}
                          placeholder="ENTER OPERATOR UID..."
                          className="w-full bg-[#F5F5F5] pl-14 pr-6 py-5 rounded-none border-2 border-transparent focus:border-black transition-all monoscale font-black uppercase text-sm"
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isAddingCollaborator || !newCollaboratorId}
                        className="bg-black text-white px-10 py-5 rounded-none monoscale text-[11px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all"
                      >
                        {isAddingCollaborator ? 'AUTHORIZING...' : 'AUTHORIZE OPERATOR'}
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-6 p-6 bg-black text-white">
                       <ShieldCheck className="w-8 h-8 text-green-500" />
                       <div className="flex-1">
                         <p className="text-lg font-black tracking-tighter uppercase leading-none mb-1">Root Administrator (You)</p>
                         <p className="monoscale text-[10px] font-black text-white/40 uppercase tracking-widest">{workspace?.userId}</p>
                       </div>
                       <span className="monoscale text-[10px] font-black border-2 border-white/20 px-3 py-1 uppercase tracking-widest">LEVEL_0_ROOT</span>
                    </div>

                    {workspace?.collaborators?.map((uid: string) => (
                      <div key={uid} className="flex items-center gap-6 p-6 bg-white border-2 border-black group hover:bg-black hover:text-white transition-all">
                        <div className="w-14 h-14 bg-black/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
                          <Users className="w-8 h-8 text-black/20 group-hover:text-white/40" />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-black tracking-tighter uppercase leading-none mb-1">Authenticated Operator</p>
                          <p className="monoscale text-[10px] font-black text-black/40 group-hover:text-white/40 uppercase tracking-widest">{uid}</p>
                        </div>
                        {workspace?.userId === user?.uid && (
                          <button 
                            onClick={() => removeCollaborator(uid)}
                            className="text-[10px] font-black uppercase tracking-widest border-2 border-red-500 text-red-500 px-4 py-2 hover:bg-red-500 hover:text-white transition-all"
                          >
                            REVOKE_ACCESS
                          </button>
                        )}
                      </div>
                    ))}

                    {(!workspace?.collaborators || workspace.collaborators.length === 0) && (
                      <div className="py-24 text-center border-2 border-black border-dashed opacity-10">
                        <Users className="w-24 h-24 mx-auto mb-6" />
                        <p className="monoscale text-[11px] font-black uppercase tracking-[0.5em]">No secondary operators detected</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedFile && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-20">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFile(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="relative w-full max-w-6xl h-full max-h-[90vh] bg-[#F0F0EE] border-4 border-black overflow-hidden flex flex-col shadow-[40px_40px_0px_0px_rgba(0,0,0,0.5)]"
            >
              <div className="p-8 border-b-4 border-black bg-white flex items-start justify-between">
                 <div className="flex-1">
                   <div className="flex items-center gap-3 mb-4">
                     <span className="monoscale text-[10px] font-black bg-black text-white px-2 py-0.5 uppercase tracking-widest">{selectedFile.doc_type}</span>
                     <span className="monoscale text-[10px] font-black text-black/40 uppercase tracking-widest">{selectedFile.id}</span>
                   </div>
                   <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{selectedFile.title || selectedFile.originalFilename}</h2>
                 </div>
                 <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-4 border-2 border-black hover:bg-black hover:text-white transition-all"
                 >
                   <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 space-y-16 no-scrollbar">
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                  <div className="lg:col-span-2 space-y-8">
                     <h3 className="monoscale text-[11px] font-black uppercase tracking-[0.4em] text-black/30 border-b border-black/10 pb-4">Executive_Summary</h3>
                     <p className="text-2xl leading-relaxed italic serif opacity-80">{selectedFile.summary}</p>
                  </div>
                  <div className="space-y-8">
                    <h3 className="monoscale text-[11px] font-black uppercase tracking-[0.4em] text-black/30 border-b border-black/10 pb-4">Extraction_Meta</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-black/5">
                        <span className="monoscale text-[10px] font-black uppercase opacity-40">Language</span>
                        <span className="text-sm font-black uppercase">{selectedFile.language || 'EN_US'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-black/5">
                        <span className="monoscale text-[10px] font-black uppercase opacity-40">Status</span>
                        <span className="text-sm font-black uppercase text-green-600">{selectedFile.status}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                  <div className="space-y-10">
                    <h3 className="monoscale text-[11px] font-black uppercase tracking-[0.4em] text-black/30 border-b border-black/10 pb-4">Key_Topics</h3>
                    <div className="flex flex-wrap gap-3">
                      {selectedFile.key_topics?.map((topic: string, i: number) => (
                        <div key={i} className="px-6 py-4 bg-white border-2 border-black font-black uppercase text-sm tracking-tight hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                          {topic}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-10">
                    <h3 className="monoscale text-[11px] font-black uppercase tracking-[0.4em] text-black/30 border-b border-black/10 pb-4">Verified_Quotes</h3>
                    <div className="space-y-6">
                      {selectedFile.key_quotes?.map((quote: any, i: number) => (
                        <div key={i} className="p-6 bg-black text-white relative">
                          <Quote className="absolute top-4 right-4 w-10 h-10 text-white/5" />
                          <p className="text-lg italic serif leading-relaxed mb-4">"{quote.text}"</p>
                          <span className="monoscale text-[9px] font-black text-white/40 uppercase tracking-widest">{quote.location}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="space-y-10">
                  <h3 className="monoscale text-[11px] font-black uppercase tracking-[0.4em] text-black/30 border-b border-black/10 pb-4">Related_Operators</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {selectedFile.speakers?.map((speaker: any, i: number) => (
                      <div key={i} className="p-6 bg-white border-2 border-black flex items-center gap-4">
                        <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-black text-xl">
                          {speaker.name ? speaker.name[0] : '?'}
                        </div>
                        <div>
                          <p className="font-black uppercase tracking-tight leading-none mb-1">{speaker.name}</p>
                          <p className="monoscale text-[9px] font-black text-black/40 uppercase tracking-widest">{speaker.role || 'OPERATOR'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              
              <div className="p-8 bg-black text-white flex items-center justify-between monoscale text-[10px] font-black uppercase tracking-[0.5em]">
                <span>Neural_Buffer_Readout_Active</span>
                <span>End_Transmission</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
