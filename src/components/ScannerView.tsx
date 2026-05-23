import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  X, 
  Loader2, 
  AlertCircle, 
  Save,
  FileCode,
  Scan,
  ShieldCheck,
  Edit3,
  CheckCircle2,
  Lock,
  Search,
  Fingerprint
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { extractDocumentData, detectDocumentType } from '../services/geminiService';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import type { UserProfile } from '../types';

interface ScannerViewProps {
  profile: UserProfile | null;
  onComplete: () => void;
}

interface ExtractionResult {
  text: string;
  json: any;
}

interface FileState {
  id: string;
  file: File;
  preview: string | null;
  status: 'pending' | 'identifying' | 'extracting' | 'completed' | 'error';
  detectedType: string | null;
  result: ExtractionResult | null;
  error: string | null;
  editedJson: string;
}

export default function ScannerView({ profile, onComplete }: ScannerViewProps) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const activeFile = files.find(f => f.id === activeFileId);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => {
      const id = Math.random().toString(36).substring(7);
      return {
        id,
        file,
        preview: null,
        status: 'pending' as const,
        detectedType: null,
        result: null,
        error: null,
        editedJson: ''
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0 && !activeFileId) {
      setActiveFileId(newFiles[0].id);
    }

    // Generate previews for images
    newFiles.forEach(fState => {
      if (fState.file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setFiles(prev => prev.map(f => f.id === fState.id ? { ...f, preview: reader.result as string } : f));
        };
        reader.readAsDataURL(fState.file);
      }
    });
  }, [activeFileId]);

  const removeFile = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      if (activeFileId === id) {
        setActiveFileId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleIdentify = async (id: string) => {
    const fState = files.find(f => f.id === id);
    if (!fState) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'identifying', error: null } : f));

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const type = await detectDocumentType(base64, fState.file.type);
          setFiles(prev => prev.map(f => f.id === id ? { ...f, detectedType: type, status: 'pending' } : f));
        } catch (err: any) {
          setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'Identification failed' } : f));
        }
      };
      reader.readAsDataURL(fState.file);
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'System error' } : f));
    }
  };

  const handleExtract = async (id: string) => {
    const fState = files.find(f => f.id === id);
    if (!fState || !profile) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'extracting', error: null } : f));

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const data = await extractDocumentData(base64, fState.file.type, profile.preferences);
          
          setFiles(prev => prev.map(f => f.id === id ? { 
            ...f, 
            status: 'completed', 
            result: data,
            editedJson: JSON.stringify(data.json, null, 2)
          } : f));
        } catch (err: any) {
          setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: err.message || 'Extraction failed' } : f));
        }
      };
      reader.readAsDataURL(fState.file);
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'System error' } : f));
    }
  };

  const handleExtractAll = async () => {
    setShowConfirmModal(false);
    const pendingFiles = files.filter(f => f.status === 'pending');
    await Promise.all(pendingFiles.map(f => handleExtract(f.id)));
  };

  const handleSave = async (id: string, format: 'json' | 'md') => {
    const fState = files.find(f => f.id === id);
    if (!fState || !fState.result || !auth.currentUser) return;
    
    let finalJson = fState.result.json;
    try {
      finalJson = JSON.parse(fState.editedJson);
    } catch (e) {
      setGlobalError('Invalid JSON structure in editor for ' + fState.file.name);
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'documents'), {
        userId: auth.currentUser.uid,
        fileName: fState.file.name,
        mimeType: fState.file.type,
        extractedContent: fState.result.text,
        extractedJson: finalJson,
        format,
        createdAt: serverTimestamp()
      });
      removeFile(id);
      if (files.filter(f => f.id !== id).length === 0) onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'documents');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 institutional-grid min-h-screen">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Document Queue & Input */}
        <div className="w-full lg:w-96 space-y-6">
          <div 
            {...getRootProps()} 
            className={cn(
              "rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all duration-300 cursor-pointer overflow-hidden",
              isDragActive ? "border-brand-accent bg-brand-accent/5" : "border-border-subtle bg-white hover:border-brand-primary/30"
            )}
          >
            <input {...getInputProps()} />
            <div className="text-center space-y-2">
              <Upload className="w-6 h-6 text-brand-primary/40 mx-auto" />
              <p className="font-bold text-[10px] tracking-widest uppercase">Add Compliance Docs</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest px-1">Document Queue ({files.length})</p>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map(fState => (
                <div 
                  key={fState.id}
                  onClick={() => setActiveFileId(fState.id)}
                  className={cn(
                    "p-4 rounded-xl border transition-all cursor-pointer group relative",
                    activeFileId === fState.id 
                      ? "bg-brand-primary border-brand-primary text-white shadow-lg" 
                      : "bg-white border-border-subtle hover:border-brand-primary/20 shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      activeFileId === fState.id ? "bg-white/20" : "bg-brand-primary/5"
                    )}>
                      {fState.status === 'extracting' || fState.status === 'identifying' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
                      ) : fState.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <FileCode className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate pr-6 uppercase tracking-tight">{fState.file.name}</p>
                      <p className={cn(
                        "text-[9px] uppercase font-bold tracking-widest mt-1",
                        activeFileId === fState.id ? "text-white/60" : "text-brand-primary/40"
                      )}>
                        {fState.detectedType || (fState.file.size / 1024).toFixed(1) + ' KB'}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => removeFile(fState.id, e)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {fState.error && (
                    <div className="mt-2 text-[9px] font-bold text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fState.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {files.some(f => f.status === 'pending') && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold text-[10px] tracking-widest uppercase hover:bg-brand-primary/95 transition-all shadow-lg"
            >
              Extract All Pending
            </button>
          )}
        </div>

        {/* Right: Detailed Review & Edit */}
        <div className="flex-1 min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeFile ? (
              <motion.div
                key={activeFileId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white rounded-2xl border border-border-subtle h-full flex flex-col shadow-sm"
              >
                {/* Header & Meta */}
                <div className="p-6 border-b border-border-subtle flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight uppercase">{activeFile.file.name}</h3>
                      <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest flex items-center gap-2 mt-1">
                        <Lock className="w-3 h-3" /> SECURE SESSION PROCESSING
                      </p>
                    </div>
                    {!activeFile.detectedType && activeFile.status === 'pending' && (
                      <button 
                        onClick={() => handleIdentify(activeFile.id)}
                        className="px-4 py-2 bg-white border border-border-subtle rounded-lg text-[10px] font-bold hover:bg-brand-primary/5 transition-all flex items-center gap-2 uppercase tracking-widest"
                      >
                        <Search className="w-3 h-3" /> Detect Type
                      </button>
                    )}
                  </div>
                  
                  {activeFile.detectedType && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-accent/5 border border-brand-accent/20 rounded-lg w-fit">
                      <Fingerprint className="w-3 h-3 text-brand-accent" />
                      <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">
                        [{activeFile.detectedType.toUpperCase()}]
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-surface-bg/[0.3]">
                  {activeFile.status === 'extracting' ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                      <Loader2 className="w-10 h-10 animate-spin text-brand-accent" />
                      <p className="text-[10px] font-bold tracking-widest text-brand-primary/40 uppercase">Regulatory Extraction in Progress...</p>
                    </div>
                  ) : activeFile.result ? (
                    <div className="space-y-8">
                       <div className="markdown-body">
                          <Markdown>{activeFile.result.text}</Markdown>
                       </div>
                       <div className="space-y-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary/40 font-mono">EDITS & VERIFICATION</p>
                          <textarea
                            value={activeFile.editedJson}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, editedJson: val } : f));
                            }}
                            className="w-full h-64 p-4 font-mono text-[11px] bg-white border border-border-subtle rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-accent/30 resize-none leading-relaxed"
                            spellCheck={false}
                          />
                       </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 text-brand-primary/30">
                      <Scan className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">Extraction Pending</p>
                      <p className="text-[10px] font-mono mt-2">No compliance data has been analyzed for this document yet.</p>
                      <button 
                        onClick={() => handleExtract(activeFile.id)}
                        className="mt-6 px-8 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all font-sans"
                      >
                        Extract Now
                      </button>
                    </div>
                  )}
                </div>

                {activeFile.result && (
                  <div className="p-4 bg-white border-t border-border-subtle flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-brand-primary/40">
                      <ShieldCheck className="w-3 h-3" /> VERIFIED COMPLIANCE RECORD
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => handleSave(activeFile.id, 'json')}
                        disabled={isSaving}
                        className="px-6 py-2 bg-brand-primary text-white rounded-lg text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary/90 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-brand-accent" /> : <CheckCircle2 className="w-4 h-4" />}
                        CONFIRM & ARCHIVE
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="h-full rounded-2xl border border-border-subtle bg-white/50 flex flex-col items-center justify-center p-12 text-center space-y-6">
                <FileCode className="w-16 h-16 text-brand-primary/10" />
                <div className="space-y-2">
                  <h4 className="font-bold text-sm tracking-tight text-brand-primary/60 uppercase">Document Selection Required</h4>
                  <p className="text-[10px] text-brand-primary/40 max-w-xs mx-auto leading-relaxed font-mono uppercase">Please select a document from the queue to perform compliance analysis and regulatory verification.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {globalError && (
        <div className="fixed bottom-8 right-8 z-50">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 shadow-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5" />
            <div className="text-[11px] font-bold uppercase tracking-widest">{globalError}</div>
            <button onClick={() => setGlobalError(null)} className="ml-4 p-1 hover:bg-red-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl border border-border-subtle shadow-2xl p-8 max-w-md w-full space-y-6"
            >
              <div className="w-16 h-16 bg-brand-accent/10 rounded-2xl flex items-center justify-center border border-brand-accent/20">
                <ShieldCheck className="w-8 h-8 text-brand-accent" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight uppercase">Batch Review Acknowledgement</h3>
                <p className="text-xs text-brand-primary/60 leading-relaxed font-mono">
                  You are about to process <span className="text-brand-primary font-bold">{files.filter(f => f.status === 'pending').length} document(s)</span>. 
                  <br /><br />
                  Compliance data <span className="text-brand-primary font-bold">CANNOT BE AUTOMATICALLY UPLOADED</span>. Each extraction must be manually verified.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleExtractAll}
                  className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-brand-primary/95 transition-all shadow-lg active:scale-[0.98]"
                >
                  Confirm Batch Extraction
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-4 bg-white border border-border-subtle text-brand-primary/60 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-brand-primary/5 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
