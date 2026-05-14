import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Video, Music, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { ingestFile, indexData, DocType } from '../services/aiService';
import { handleFirestoreError, OperationType } from '../lib/error-utils';

interface FileUploadProps {
  workspaceId: string;
}

export default function FileUpload({ workspaceId }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: string }>({});

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
      setProgress(prev => ({ ...prev, [file.name]: 'Analyzing Multimodal Stream...' }));
      const ingestion = await ingestFile(base64, file.type);
      
      // Update with metadata
      await setDoc(fileRef, {
        ...ingestion,
        status: 'indexing'
      }, { merge: true });

      // Save segments
      setProgress(prev => ({ ...prev, [file.name]: 'Indexing Entities...' }));
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

    } catch (error) {
      console.error(error);
      setProgress(prev => ({ ...prev, [file.name]: 'FAILED' }));
      try {
        await setDoc(doc(db, 'workspaces', workspaceId, 'files', fileId), { 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
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
        className={`border-2 border-dashed p-16 text-center transition-all cursor-pointer relative overflow-hidden group
          ${isDragActive ? 'border-black bg-black text-white' : 'border-black/20 hover:border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1'}`}
      >
        <input {...getInputProps()} id="file-ingestion-input" />
        <div className="flex flex-col items-center gap-6">
          <div className={`p-6 transition-colors ${isDragActive ? 'bg-white/10' : 'bg-black/5'} rounded-none mb-2`}>
            <Upload className={`w-10 h-10 ${isDragActive ? 'text-white' : 'text-black'}`} />
          </div>
          <div>
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Ingestion Port</h3>
            <p className={`monoscale text-[10px] font-black uppercase tracking-[0.3em] ${isDragActive ? 'text-white/60' : 'text-black/40'}`}>
              Accepting PDF / MP4 / MOV / MP3 / TXT / MD
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-4 left-4 monoscale text-[9px] font-black opacity-20 uppercase tracking-widest">DRAG_DROP_OR_CLICK</div>
        <div className="absolute bottom-4 right-4 monoscale text-[9px] font-black opacity-20 uppercase tracking-widest">PORT_READY</div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border-2 border-black overflow-hidden shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="p-6 border-b-2 border-black bg-[#F0F0EE] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="monoscale text-[11px] font-black uppercase tracking-widest">Extraction Buffer ({files.length})</span>
              </div>
              {!uploading && (
                <button 
                  onClick={uploadAll}
                  className="bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 px-8 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                  <Cpu className="w-4 h-4" />
                  Initiate Mining
                </button>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto divide-y-2 divide-black/5">
              {files.map((file, i) => (
                <div key={i} className="p-6 flex items-center justify-between group hover:bg-[#F8F8F8] transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="p-3 bg-black/5 text-black">
                      {file.type.startsWith('video') ? <Video className="w-5 h-5" /> : 
                       file.type.startsWith('audio') ? <Music className="w-5 h-5" /> :
                       <FileText className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase tracking-tight truncate max-w-[300px]">{file.name}</span>
                      <span className="text-[10px] monoscale font-black text-black/40 uppercase tracking-widest mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split('/')[1]?.toUpperCase() || 'DATA'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {progress[file.name] ? (
                      <div className="flex items-center gap-4">
                        {progress[file.name] === 'COMPLETED' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : progress[file.name] === 'FAILED' ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        )}
                        <span className="monoscale text-[10px] font-black text-black/60 uppercase tracking-widest">{progress[file.name]}</span>
                      </div>
                    ) : (
                      <button 
                        disabled={uploading}
                        onClick={() => removeFile(i)}
                        className="p-2 border border-black/10 hover:bg-black hover:text-white transition-all text-black/30"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
