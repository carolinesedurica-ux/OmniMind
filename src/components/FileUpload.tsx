import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Video, Music, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { ingestFile, indexData, DocType } from '../services/aiService';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';

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
  });

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
      for (const seg of ingestion.transcript_segments) {
        await addDoc(collection(db, 'workspaces', workspaceId, 'segments'), {
          ...seg,
          fileId,
          workspaceId,
          createdAt: serverTimestamp()
        });
      }

      // 4. Index via AI Service
      const indexing = await indexData(JSON.stringify(ingestion));
      
      // Save entities
      for (const ent of indexing.entities) {
        await addDoc(collection(db, 'workspaces', workspaceId, 'entities'), {
          ...ent,
          fileId,
          workspaceId
        });
      }

      // Save risks
      for (const risk of indexing.risks) {
        await addDoc(collection(db, 'workspaces', workspaceId, 'risks'), {
          ...risk,
          fileId,
          workspaceId
        });
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
    <div className="space-y-6">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer bg-white/5
          ${isDragActive ? 'border-black bg-black/5' : 'border-black/10 hover:border-black/20'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white rounded-xl shadow-sm">
            <Upload className="w-8 h-8 text-black" />
          </div>
          <div>
            <p className="text-xl font-bold">Inject Dark Data</p>
            <p className="text-black/40 text-sm">Drop PDF, Video, Audio, or Text files</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="p-4 border-b border-black/5 bg-black/[0.02] flex items-center justify-between">
              <span className="monoscale text-[11px] font-bold">Extraction Buffer ({files.length})</span>
              {!uploading && (
                <button 
                  onClick={uploadAll}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-2"
                >
                  <Cpu className="w-3 h-3" />
                  Initiate Mining
                </button>
              )}
            </div>
            
            <div className="max-h-[300px] overflow-y-auto divide-y divide-black/5">
              {files.map((file, i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {file.type.startsWith('video') ? <Video className="w-4 h-4 text-black/40" /> : 
                     file.type.startsWith('audio') ? <Music className="w-4 h-4 text-black/40" /> :
                     <FileText className="w-4 h-4 text-black/40" />}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-[10px] monoscale text-black/40">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {progress[file.name] ? (
                      <div className="flex items-center gap-2">
                        {progress[file.name] === 'COMPLETED' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : progress[file.name] === 'FAILED' ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <div className="w-3 h-3 border border-black/20 border-t-black rounded-full animate-spin" />
                        )}
                        <span className="monoscale text-[10px] font-bold text-black/60">{progress[file.name]}</span>
                      </div>
                    ) : (
                      <button 
                        disabled={uploading}
                        onClick={() => removeFile(i)}
                        className="p-1 hover:bg-black/5 rounded-full"
                      >
                        <X className="w-4 h-4 text-black/40" />
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
