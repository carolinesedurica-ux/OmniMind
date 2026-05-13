import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, doc } from 'firebase/firestore';
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
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FileUpload from './FileUpload';
import { askWorkspace, generateExecutiveBrief } from '../services/aiService';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';

interface WorkspaceDetailProps {
  workspaceId: string;
  onBack: () => void;
}

export default function WorkspaceDetail({ workspaceId, onBack }: WorkspaceDetailProps) {
  const [activeTab, setActiveTab] = useState<'mining' | 'feed' | 'matrix' | 'neural' | 'briefs'>('mining');
  const [workspace, setWorkspace] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [briefs, setBriefs] = useState<any[]>([]);
  
  // Neural Query State
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  // Brief Generation State
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

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
      collection(db, 'workspaces', workspaceId, 'files'), 
      orderBy('createdAt', 'desc')
    ), (snap) => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      collection(db, 'workspaces', workspaceId, 'segments'), 
      orderBy('createdAt', 'desc')
    ), (snap) => {
      setSegments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/segments`));

    // Queries
    const unsubQueries = onSnapshot(query(
      collection(db, 'workspaces', workspaceId, 'queries'), 
      orderBy('createdAt', 'asc')
    ), (snap) => {
      setChatHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/queries`));

    // Briefs
    const unsubBriefs = onSnapshot(query(
      collection(db, 'workspaces', workspaceId, 'briefs'), 
      orderBy('createdAt', 'desc')
    ), (snap) => {
      setBriefs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/briefs`));

    return () => {
      unsubWs(); unsubFiles(); unsubRisks(); unsubEnts(); unsubSegs(); unsubQueries(); unsubBriefs();
    };
  }, [workspaceId, auth.currentUser]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || isAsking) return;

    setIsAsking(true);
    const userQ = question;
    setQuestion('');

    try {
      // Build context from segments
      const context = segments.map(s => `[${s.start}] ${s.text}`).join('\n').slice(0, 50000);
      const answer = await askWorkspace(userQ, context);
      
      await addDoc(collection(db, 'workspaces', workspaceId, 'queries'), {
        question: userQ,
        ...answer,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
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
    { id: 'mining', label: 'Mining Core', icon: Activity },
    { id: 'feed', label: 'Multimodal Feed', icon: Clock },
    { id: 'matrix', label: 'Knowledge Matrix', icon: Layers },
    { id: 'neural', label: 'Neural Query', icon: Brain },
    { id: 'briefs', label: 'Executive AI', icon: ShieldCheck },
  ];

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Detail Header */}
      <div className="px-8 py-6 border-b border-black/5 bg-[#fcfcfc] shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-black/60" />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">{workspace?.name || 'SYNCING...'}</h2>
            <div className="flex items-center gap-2">
              <span className="monoscale text-[10px] bg-black text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-[0.2em]">
                {workspace?.vertical || 'ACTIVE'}
              </span>
              <span className="text-black/30 monoscale text-[10px]">Neural Processing Enabled</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 border-b-2 transition-all monoscale text-[11px] font-bold tracking-wider relative whitespace-nowrap
                ${activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-black/30 hover:text-black/60'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-active" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-black" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-[#F8F8F8]">
        <AnimatePresence mode="wait">
          {activeTab === 'mining' && (
            <motion.div 
              key="mining" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-8">
                <FileUpload workspaceId={workspaceId} />
                
                <section>
                  <h4 className="monoscale text-[11px] font-bold text-black/40 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> RECENTLY PROCESSED NODES
                  </h4>
                  <div className="space-y-3">
                    {files.map(file => (
                      <div key={file.id} className="card-premium p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-black/60" />
                          <div>
                            <p className="font-bold text-sm">{file.title || file.originalFilename}</p>
                            <p className="text-[10px] monoscale text-black/40">{file.status.toUpperCase()} • {file.doc_type}</p>
                          </div>
                        </div>
                        {file.summary && (
                           <div className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-black/40">
                             {file.summary}
                           </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-black/10" />
                      </div>
                    ))}
                    {files.length === 0 && (
                      <div className="text-center py-12 bg-black/5 rounded-2xl border border-dashed border-black/10">
                        <p className="monoscale text-black/30">Buffer Empty. Ingest files to start mining.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="monoscale text-[11px] font-bold text-black/40 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> RISK COHERENCE
                  </h4>
                  <div className="space-y-3">
                    {risks.map(risk => (
                      <div key={risk.id} className="p-4 bg-red-50 border border-red-100 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                           <span className="monoscale text-[9px] font-black text-red-600 bg-red-100 px-1.5 rounded uppercase">
                             {risk.severity}
                           </span>
                           <span className="text-[9px] monoscale text-black/30 italic">{risk.evidence}</span>
                        </div>
                        <p className="font-bold text-xs mb-1">{risk.title}</p>
                        <p className="text-[10px] text-red-900/60 leading-relaxed italic">{risk.rationale}</p>
                      </div>
                    ))}
                    {risks.length === 0 && (
                       <div className="p-6 text-center monoscale text-black/20 text-xs italic">No risks identified.</div>
                    )}
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'briefs' && (
            <motion.div 
              key="briefs" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-8 max-w-5xl mx-auto space-y-12"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-bold tracking-tighter">Executive Intelligence</h3>
                  <p className="monoscale text-black/40 text-xs">Automated Synthesis Layer</p>
                </div>
                <button 
                  onClick={handleGenerateBrief}
                  disabled={isGeneratingBrief}
                  className="btn-primary flex items-center gap-2"
                >
                  {isGeneratingBrief ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                  Synthesize Global Brief
                </button>
              </div>

              <div className="space-y-12">
                {briefs.map((brief, i) => (
                  <motion.div 
                    key={brief.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white border border-black/10 rounded-3xl overflow-hidden shadow-2xl"
                  >
                    <div className="bg-black text-white p-8">
                       <div className="flex items-center justify-between mb-2">
                         <span className="monoscale text-[10px] font-bold text-white/40">OFFICIAL REPORT</span>
                         <span className="monoscale text-[10px] text-white/40">{new Date(brief.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                       </div>
                       <h4 className="text-4xl font-bold tracking-tight mb-4">{brief.title}</h4>
                       <div className="flex items-center gap-2 text-white/60">
                         <Mail className="w-4 h-4" />
                         <p className="text-sm font-medium italic">"{brief.tldr}"</p>
                       </div>
                    </div>
                    
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-8">
                        <section>
                          <h5 className="monoscale text-[11px] font-bold text-black/40 mb-4 border-b border-black/5 pb-2">KEY FINDINGS</h5>
                          <ul className="space-y-3">
                            {brief.key_findings?.map((f: string, j: number) => (
                              <li key={j} className="flex gap-3 text-sm leading-relaxed">
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </section>

                        <section>
                          <h5 className="monoscale text-[11px] font-bold text-black/40 mb-4 border-b border-black/5 pb-2">RECOMMENDED ACTIONS</h5>
                          <div className="space-y-3">
                            {brief.recommended_actions?.map((ra: any, j: number) => (
                              <div key={j} className="p-4 bg-black/5 rounded-xl border border-black/5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-bold uppercase">{ra.priority} priority</span>
                                  <span className="text-[10px] monoscale text-black/40">{ra.owner}</span>
                                </div>
                                <p className="text-sm font-bold">{ra.action}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>

                      <div className="space-y-8">
                        <section>
                          <h5 className="monoscale text-[11px] font-bold text-black/40 mb-4 border-b border-black/5 pb-2">RISK LANDSCAPE</h5>
                          <div className="space-y-3">
                            {brief.risk_summary?.map((rs: any, j: number) => (
                              <div key={j} className="flex justify-between items-center p-3 rounded-lg border border-black/5 bg-[#FFF] shadow-sm">
                                <span className="text-sm font-medium">{rs.risk}</span>
                                <span className={`monoscale text-[9px] font-black px-1.5 rounded ${
                                  rs.severity === 'high' ? 'bg-red-100 text-red-600' : 
                                  rs.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
                                }`}>
                                  {rs.severity.toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section>
                          <h5 className="monoscale text-[11px] font-bold text-black/40 mb-4 border-b border-black/5 pb-2">COMMUNICATION DRAFT</h5>
                          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                            <p className="text-xs font-mono text-blue-900 leading-relaxed whitespace-pre-wrap italic">
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

          {activeTab === 'neural' && (
            <motion.div 
              key="neural" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="h-full flex flex-col p-8"
            >
              <div className="flex-1 overflow-y-auto space-y-6 mb-6 px-4">
                {chatHistory.map((chat, i) => (
                  <div key={i} className="space-y-4">
                    <div className="flex justify-end">
                      <div className="bg-black text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-lg shadow-lg">
                        <p className="text-sm font-medium">{chat.question}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="bg-white border border-black/10 p-6 rounded-2xl rounded-tl-none max-w-2xl shadow-xl">
                        <div className="flex items-center gap-2 mb-4">
                           <Brain className="w-5 h-5" />
                           <span className="monoscale font-bold text-[11px]">Omni Neural Synthesis — Confidence: {chat.confidence}</span>
                        </div>
                        <p className="text-sm leading-relaxed mb-6">{chat.answer}</p>
                        
                        {chat.citations && chat.citations.length > 0 && (
                          <div className="space-y-2">
                             <p className="monoscale text-[10px] font-bold text-black/40 uppercase">Grounded Citations</p>
                             <div className="grid grid-cols-1 gap-2">
                               {chat.citations.map((c: any, ci: number) => (
                                 <div key={ci} className="bg-black/5 p-3 rounded-lg border border-black/5">
                                   <div className="flex items-center justify-between mb-1">
                                      <span className="monoscale text-[9px] font-bold text-black/60">{c.location}</span>
                                      <Quote className="w-3 h-3 text-black/20" />
                                   </div>
                                   <p className="text-[10px] italic text-black/60 mb-2">"{c.quote}"</p>
                                   <p className="text-[9px] font-bold uppercase text-black/40 tracking-wider">Reason: {c.why}</p>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto">
                <form onSubmit={handleAsk} className="relative">
                  <input 
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask the Neural Core about your workspace..."
                    className="w-full bg-white border-2 border-black p-4 pr-16 rounded-2xl shadow-xl focus:outline-none placeholder:text-black/20 font-medium"
                    disabled={isAsking}
                  />
                  <button 
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black text-white p-2 rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
                    disabled={isAsking || !question}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
                {isAsking && (
                   <p className="text-center monoscale text-[10px] mt-4 font-bold animate-pulse">Consulting Multimodal Indices...</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'feed' && (
            <motion.div 
              key="feed" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-8 space-y-6 max-w-4xl mx-auto"
            >
              {segments.map((seg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-6 group"
                >
                  <div className="w-24 shrink-0 flex flex-col items-end pt-1">
                    <span className="monoscale text-[11px] font-bold text-black group-hover:text-black transition-colors">{seg.start}</span>
                    <span className="monoscale text-[9px] text-black/20 uppercase font-black">{seg.speaker || 'SYS'}</span>
                  </div>
                  <div className="flex-1 pb-8 border-l border-black/10 pl-6 relative">
                    <div className="absolute top-1.5 -left-1 w-2 h-2 rounded-full bg-black/20 group-hover:bg-black transition-colors" />
                    <div className="bg-white p-4 rounded-xl border border-black/5 shadow-sm group-hover:shadow-md transition-all">
                       {seg.topic && <span className="monoscale text-[9px] text-black/40 mb-2 block font-bold">TOPIC: {seg.topic}</span>}
                       <p className="text-sm leading-relaxed text-black/80 italic serif">{seg.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {segments.length === 0 && (
                <div className="text-center py-24">
                  <Clock className="w-12 h-12 text-black/10 mx-auto mb-4" />
                  <p className="monoscale text-black/30 font-bold uppercase tracking-widest text-[11px]">Neural Feed Empty</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'matrix' && (
             <motion.div 
              key="matrix" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {entities.map((ent, i) => (
                  <div key={i} className="card-premium p-6">
                     <div className="flex items-center justify-between mb-4">
                        <span className="monoscale text-[9px] font-black bg-black text-white px-2 py-0.5 rounded tracking-widest uppercase">{ent.type}</span>
                        <Layers className="w-4 h-4 text-black/20" />
                     </div>
                     <h5 className="text-lg font-bold mb-2">{ent.name}</h5>
                     <p className="text-xs text-black/40 italic serif mb-4 line-clamp-3">{ent.context}</p>
                     <div className="flex flex-wrap gap-1">
                       {ent.mentions?.map((m: string, mi: number) => (
                         <span key={mi} className="text-[9px] monoscale bg-black/5 text-black/40 px-1.5 py-0.5 rounded border border-black/5">
                            {m}
                         </span>
                       ))}
                     </div>
                  </div>
                ))}
              </div>
              {entities.length === 0 && (
                <div className="text-center py-24">
                  <Users className="w-12 h-12 text-black/10 mx-auto mb-4" />
                  <p className="monoscale text-black/30 font-bold uppercase tracking-widest text-[11px]">Entity Matrix Offline</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
