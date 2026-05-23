import { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  FileJson, 
  FileText as FileMd, 
  Calendar,
  History,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function HistoryView() {
  const [docs, setDocs] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'documents'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const d = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDocs(d);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error('List Error:', error);
      setError('Regulatory records could not be retrieved from secure archives.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this record from the archive?')) return;
    
    setError(null);
    try {
      await deleteDoc(doc(db, 'documents', id));
      if (selectedDoc?.id === id) setSelectedDoc(null);
    } catch (err: any) {
      console.error('Delete Error:', err);
      let userMessage = 'Secure deletion failed.';
      if (err.message?.includes('permission')) {
        userMessage = 'Security Protocol: You do not have authorization to delete this record.';
      }
      setError(userMessage);
    }
  };

  const downloadData = (doc: any, format: 'json' | 'md') => {
    const content = format === 'json' 
      ? JSON.stringify(doc.extractedJson, null, 2)
      : doc.extractedContent;
    
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^/.]+$/, "")}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredDocs = docs.filter(doc => 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="flex flex-col items-center gap-4">
           <div className="w-10 h-10 border-2 border-brand-primary/10 border-t-brand-accent rounded-full animate-spin" />
           <p className="text-[10px] font-bold tracking-widest text-brand-primary/40 uppercase">Accessing Secure Archives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)]">
      {/* Sidebar List */}
      <div className="lg:col-span-5 space-y-4 flex flex-col h-full">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-primary/30 group-focus-within:text-brand-accent transition-colors" />
          <input 
            type="text" 
            placeholder="Search Record Archives..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-border-subtle rounded-xl py-3.5 pl-12 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-brand-accent/30 focus:border-brand-accent/50 transition-all font-mono uppercase tracking-tight"
          />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 bg-red-50 text-red-700 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border border-red-100 font-mono"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-border-subtle flex flex-col items-center justify-center gap-4">
              <History className="w-8 h-8 text-brand-primary/10" />
              <p className="text-brand-primary/40 font-bold text-[10px] uppercase tracking-widest leading-loose font-mono">No documents found in session memory</p>
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <motion.div
                key={doc.id}
                layoutId={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={cn(
                  "p-4 rounded-xl cursor-pointer border transition-all group relative",
                  selectedDoc?.id === doc.id 
                    ? "bg-brand-primary border-brand-primary text-white shadow-lg" 
                    : "bg-white border-border-subtle hover:border-brand-primary/20 shadow-sm"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    selectedDoc?.id === doc.id ? "bg-white/20" : "bg-brand-primary/5"
                  )}>
                    {doc.format === 'json' ? <FileJson className="w-5 h-5" /> : <FileMd className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[13px] truncate pr-6 tracking-tight uppercase">{doc.fileName}</h4>
                    <p className={cn(
                      "text-[9px] uppercase font-bold tracking-widest mt-1 flex items-center gap-1.5",
                      selectedDoc?.id === doc.id ? "text-white/60" : "text-brand-primary/40"
                    )}>
                      <Calendar className="w-3 h-3" />
                      {doc.createdAt?.toDate().toLocaleDateString() || 'Just now'}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(doc.id, e)}
                    className={cn(
                      "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all absolute top-4 right-4",
                      selectedDoc?.id === doc.id ? "hover:bg-red-500 text-white" : "hover:bg-red-50 text-red-500"
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Main View Area */}
      <div className="lg:col-span-7 h-full min-h-[500px]">
        <AnimatePresence mode="wait">
          {selectedDoc ? (
            <motion.div
              key={selectedDoc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl border border-border-subtle h-full flex flex-col shadow-xl shadow-brand-primary/5"
            >
              <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-white sticky top-0 rounded-t-2xl">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center">
                     {selectedDoc.format === 'json' ? <FileJson className="w-4 h-4" /> : <FileMd className="w-4 h-4" />}
                   </div>
                   <h3 className="font-bold text-sm truncate max-w-[200px] tracking-tight">{selectedDoc.fileName}</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => downloadData(selectedDoc, 'json')}
                    className="p-2 hover:bg-brand-primary/5 rounded-lg transition-colors group"
                    title="Download JSON"
                  >
                    <FileJson className="w-5 h-5 text-brand-primary/40 group-hover:text-brand-primary" />
                  </button>
                  <button 
                    onClick={() => downloadData(selectedDoc, 'md')}
                    className="p-2 hover:bg-brand-primary/5 rounded-lg transition-colors group"
                    title="Download MD"
                  >
                    <FileMd className="w-5 h-5 text-brand-primary/40 group-hover:text-brand-primary" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-bg/[0.3]">
                <div className="prose prose-slate max-w-none">
                  <div className="markdown-body">
                    <Markdown>{selectedDoc.extractedContent}</Markdown>
                  </div>
                  
                  {selectedDoc.format === 'json' && (
                    <div className="mt-8 pt-8 border-t border-border-subtle">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary/40 mb-4 font-mono">EXTRACTED COMPLIANCE DATA (JSON)</p>
                      <pre className="bg-brand-primary/[0.02] p-4 rounded-xl text-[12px] font-mono overflow-x-auto border border-border-subtle">
                        {JSON.stringify(selectedDoc.extractedJson, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-white border-t border-border-subtle rounded-b-2xl">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-brand-primary/40 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                    AUTHORIZED ARCHIVE ACCESS ONLY
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-brand-primary/60 bg-surface-bg px-3 py-1.5 rounded-lg border border-border-subtle">
                    RECORDS RETENTION COMPLIANT
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full rounded-2xl border border-border-subtle bg-white/50 flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-white border border-border-subtle flex items-center justify-center shadow-sm">
                <History className="w-8 h-8 text-brand-primary/10" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm tracking-tight text-brand-primary/60 uppercase">No Document Selected</h4>
                <p className="text-[10px] text-brand-primary/40 max-w-xs mx-auto leading-relaxed font-mono uppercase">Select a record from the secure log to inspect extracted compliance metrics and regulatory summaries.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
