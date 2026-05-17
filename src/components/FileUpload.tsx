import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Video, Music, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { ingestFile, indexData, DocType } from '../services/aiService';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface FileUploadProps {
  workspaceId: string;
}

export default function FileUpload({ workspaceId }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: string }>({});
  const [fileErrors, setFileErrors] = useState<{ [key: string]: string }>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.mov', '.webm'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
      'text/*': ['.txt', '.md', '.csv']
    }
  } as any);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFile = async (file: File) => {
    const fileId = crypto.randomUUID();
    setProgress(prev => ({ ...prev, [file.name]: 'Reading...' }));

    try {
      // 1. Read file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const str = reader.result as string;
          resolve(str.split(',')[1]);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      // 2. Create minimal record in Firestore
      const fileRef = doc(db, 'workspaces', workspaceId, 'files', fileId);
      await setDoc(fileRef, {
        id: fileId,
        workspaceId,
        originalFilename: file.name,
        contentType: file.type,
        status: 'processing',
        createdAt: serverTimestamp()
      });

      // 3. Ingest via AI Service
      setProgress(prev => ({ ...prev, [file.name]: 'Ingestion Agent Mapping...' }));
      const ingestion = await ingestFile(base64, file.type);
      
      // Update with metadata
      await setDoc(fileRef, {
        ...ingestion,
        status: 'mapping'
      }, { merge: true });

      // Save segments
      setProgress(prev => ({ ...prev, [file.name]: 'Extracting Strategic Moments...' }));
      if (ingestion && Array.isArray(ingestion.transcript_segments)) {
        for (const seg of ingestion.transcript_segments) {
          await addDoc(collection(db, 'workspaces', workspaceId, 'segments'), {
            ...seg,
            fileId,
            workspaceId,
            createdAt: serverTimestamp()
          });
        }
      }

      // 4. Index via AI Service
      const indexing = await indexData(JSON.stringify(ingestion));
      
      // Save entities
      if (indexing && Array.isArray(indexing.entities)) {
        for (const ent of indexing.entities) {
          await addDoc(collection(db, 'workspaces', workspaceId, 'entities'), {
            ...ent,
            fileId,
            workspaceId
          });
        }
      }

      // Save risks
      if (indexing && Array.isArray(indexing.risks)) {
        for (const risk of indexing.risks) {
          await addDoc(collection(db, 'workspaces', workspaceId, 'risks'), {
            ...risk,
            fileId,
            workspaceId
          });
        }
      }

      // Update final status
      await setDoc(fileRef, { status: 'completed', processedAt: serverTimestamp() }, { merge: true });
      setProgress(prev => ({ ...prev, [file.name]: 'COMPLETED' }));

    } catch (error: any) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setProgress(prev => ({ ...prev, [file.name]: 'FAILED' }));
      setFileErrors(prev => ({ ...prev, [file.name]: errorMessage }));
      try {
        await setDoc(doc(db, 'workspaces', workspaceId, 'files', fileId), { 
          status: 'failed', 
          error: errorMessage 
        }, { merge: true });
      } catch (innerError) {
        handleFirestoreError(innerError, OperationType.WRITE, `workspaces/${workspaceId}/files/${fileId}`);
      }
      handleFirestoreError(error, OperationType.WRITE, `workspaces/${workspaceId}/files/${fileId}`);
    }
  };

  const uploadAll = async () => {
    setUploading(true);
    await Promise.all(files.map(processFile));
    setFiles([]);
    setUploading(false);
  };

  return (
    <div className="space-y-8">
      <div 
        {...getRootProps()} 
        className={`lathed-border p-16 text-center transition-all cursor-pointer relative overflow-hidden group
          ${isDragActive ? 'bg-cyan/10 border-cyan shadow-[0_0_80px_rgba(34,211,238,0.2)]' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'}`}
      >
        <input {...getInputProps()} id="file-ingestion-input" />
        <div className="flex flex-col items-center gap-6">
          <div className={`p-6 transition-colors ${isDragActive ? 'bg-cyan/20' : 'bg-white/5'} rounded-2xl mb-2 relative group`}>
            <div className="absolute inset-0 bg-cyan/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Upload className={`w-10 h-10 relative z-10 ${isDragActive ? 'text-cyan' : 'text-white/40 group-hover:text-cyan'}`} />
          </div>
          <div>
            <h3 className="text-3xl font-bold uppercase tracking-tighter mb-2 text-white group-hover:text-cyan transition-colors">Ingestion Port</h3>
            <p className={`monoscale text-[10px] font-bold uppercase tracking-[0.3em] ${isDragActive ? 'text-cyan/60' : 'text-white/20'}`}>
              Accepting PDF / MP4 / MOV / MP3 / TXT / MD
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-4 left-4 monoscale text-[8px] font-bold opacity-10 uppercase tracking-widest">DRAG_DROP_OR_CLICK</div>
        <div className="absolute bottom-4 right-4 monoscale text-[8px] font-bold opacity-10 uppercase tracking-widest">PORT_READY</div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-panel lathed-border overflow-hidden shadow-2xl relative"
          >
            <div className="p-6 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-cyan rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,1)]" />
                <span className="monoscale text-[10px] font-bold uppercase tracking-[0.3em] text-cyan">Inbound_Queue ({files.length})</span>
              </div>
              {!uploading && (
                <button 
                  onClick={uploadAll}
                  className="bg-cyan text-black text-[9px] font-bold uppercase tracking-[0.2em] py-3 px-8 rounded-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                >
                  <Cpu className="w-4 h-4" />
                  Initiate_Dark_Mining
                </button>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5 custom-scrollbar">
              {files.map((file, i) => (
                <div key={i} className="group hover:bg-white/[0.02] transition-colors relative">
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-6 relative z-10">
                    <div className="p-3 bg-white/5 text-white/40 group-hover:text-cyan group-hover:bg-cyan/10 transition-all rounded-xl">
                      {file.type.startsWith('video') ? <Video className="w-5 h-5" /> : 
                       file.type.startsWith('audio') ? <Music className="w-5 h-5" /> :
                       <FileText className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold uppercase tracking-tight truncate max-w-[300px] text-white/80">{file.name}</span>
                      <span className="text-[10px] monoscale font-medium text-white/20 uppercase tracking-widest mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split('/')[1]?.toUpperCase() || 'DATA'}
                      </span>
                    </div>
                  </div>
                    <div className="flex flex-col items-end gap-1 relative z-10">
                      {progress[file.name] ? (
                        <div className="flex items-center gap-4">
                          {progress[file.name] === 'COMPLETED' ? (
                            <CheckCircle2 className="w-5 h-5 text-cyan" />
                          ) : progress[file.name] === 'FAILED' ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <div className="w-4 h-4 border border-cyan/20 border-t-cyan rounded-full animate-spin" />
                          )}
                          <span className={`monoscale text-[9px] font-bold uppercase tracking-widest ${
                            progress[file.name] === 'COMPLETED' ? 'text-cyan' : 
                            progress[file.name] === 'FAILED' ? 'text-red-400' : 'text-white/40'
                          }`}>{progress[file.name]}</span>
                        </div>
                      ) : (
                        <button 
                          disabled={uploading}
                          onClick={() => removeFile(i)}
                          className="p-2 border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all rounded-lg text-white/10"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {progress[file.name] === 'FAILED' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="px-6 pb-6 pt-2"
                    >
                      <div className="p-4 bg-red-500/10 border border-red-500/10 rounded-lg">
                        <p className="text-[10px] text-red-400 font-medium leading-relaxed italic">
                          PROTOCOL_ERROR: {fileErrors[file.name] || 'Critical failure in Neural Core. Please verify API configuration in Settings.'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
