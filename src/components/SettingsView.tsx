import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Search, 
  X, 
  Info, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  ShieldCheck,
  FileCheck,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import type { UserProfile } from '../types';

interface SettingsViewProps {
  profile: UserProfile | null;
  setProfile: (p: UserProfile) => void;
}

export default function SettingsView({ profile, setProfile }: SettingsViewProps) {
  const [lookForInput, setLookForInput] = useState('');
  const [ignoreInput, setIgnoreInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const handleUpdate = async (newPrefs: UserProfile['preferences']) => {
    setIsSaving(true);
    setError(null);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { preferences: newPrefs });
      setProfile({ ...profile, preferences: newPrefs });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    } catch (err: any) {
      console.error('Settings Update Error:', err);
      let userMessage = 'Failed to update preferences.';
      try {
        const errInfo = JSON.parse(err.message);
        userMessage = errInfo.error || userMessage;
      } catch (e) {
        userMessage = err.message || userMessage;
      }
      setError(userMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = (type: 'lookFor' | 'ignore', value: string) => {
    if (!value.trim()) return;
    const newItems = [...profile.preferences[type], value.trim()];
    handleUpdate({ ...profile.preferences, [type]: newItems });
    if (type === 'lookFor') setLookForInput('');
    else setIgnoreInput('');
  };

  const removeItem = (type: 'lookFor' | 'ignore', index: number) => {
    const newItems = profile.preferences[type].filter((_, i) => i !== index);
    handleUpdate({ ...profile.preferences, [type]: newItems });
  };

  const loadFirearmsTemplate = () => {
    const firearmsPrefs = {
      lookFor: [
        'Transferor Name (Section A)',
        'Transferee Name (Section B)',
        'Transferee Date of Birth',
        'Transferee Residence Address',
        'Firearm Make/Model',
        'Firearm Serial Number',
        'ATF Form 4473 Section B Answers',
        'Firearm Safety Certificate (FSC) # and Expiration',
        'Proof of Residency (Utility, Lease, or DL)',
        'DROS Submission Timestamp',
        'AB 574 Inventory Acknowledgment Status',
        'Certificate of Eligibility (COE) Number',
        'San Jose Liability Insurance Proof',
        'PMF (Ghost Gun) Serialization Data',
        'Handgun Roster Compliance Status',
        'Safe Handling Demonstration (SHD) Record'
      ],
      ignore: [
        'Marketing/Advertising boilerplate',
        'Generic Terms and Conditions',
        'Manufacturer social media links',
        'Non-mandatory signature placeholders'
      ]
    };
    handleUpdate(firearmsPrefs);
  };

  return (
    <div className="max-w-4xl space-y-12 pb-20 institutional-grid p-8">
      {/* Header section */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-widest text-brand-primary/40 uppercase font-mono">REGULATORY CONFIGURATION</p>
            <h3 className="text-xl font-bold tracking-tight">Define extraction rules to customize AI behavior.</h3>
          </div>
          
          <AnimatePresence>
            {showSaved && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-indigo-600 text-[10px] font-bold font-mono"
              >
                <CheckCircle2 className="w-4 h-4" />
                DASHBOARD UPDATED
              </motion.div>
            )}
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-red-600 text-[10px] font-bold font-mono max-w-xs"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={loadFirearmsTemplate}
          disabled={isSaving}
          className="flex items-center gap-3 px-6 py-4 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/95 transition-all font-bold text-xs shadow-lg shadow-brand-primary/20 group uppercase tracking-widest"
        >
          <FileCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Load CA Compliance Template
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Look For Card */}
        <div className="bg-white rounded-2xl border border-border-subtle p-6 flex flex-col gap-6 shadow-sm">
          <div className="flex items-start gap-4">
             <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
               <Search className="w-5 h-5" />
             </div>
             <div>
               <h4 className="font-bold text-sm tracking-tight uppercase">Prioritize Information</h4>
               <p className="text-[10px] text-brand-primary/40 mt-1 font-mono uppercase">MANDATORY EXTRACTION TARGETS</p>
             </div>
          </div>

          <div className="relative group">
            <input 
              type="text" 
              placeholder="e.g. Serial #, FSC Expiration"
              value={lookForInput}
              onChange={(e) => setLookForInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem('lookFor', lookForInput)}
              className="w-full bg-surface-bg border border-border-subtle rounded-xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-brand-accent transition-all font-mono"
            />
            <button 
              onClick={() => addItem('lookFor', lookForInput)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-primary text-white rounded-lg hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {profile.preferences.lookFor.map((item, i) => (
                <motion.div
                  key={`lookfor-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="group flex items-center gap-2 bg-brand-primary/5 text-brand-primary px-3 py-1.5 rounded-lg text-[10px] font-bold border border-brand-primary/10 uppercase tracking-tight"
                >
                  {item}
                  <button onClick={() => removeItem('lookFor', i)} className="opacity-40 hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Ignore Card */}
        <div className="bg-white rounded-2xl border border-border-subtle p-6 flex flex-col gap-6 shadow-sm">
          <div className="flex items-start gap-4">
             <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
               <ShieldAlert className="w-5 h-5" />
             </div>
             <div>
               <h4 className="font-bold text-sm tracking-tight uppercase">Exclude Information</h4>
               <p className="text-[10px] text-brand-primary/40 mt-1 font-mono uppercase">NON-COMPLIANCE DATA</p>
             </div>
          </div>

          <div className="relative group">
            <input 
              type="text" 
              placeholder="e.g. Advertising, Page Numbers"
              value={ignoreInput}
              onChange={(e) => setIgnoreInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem('ignore', ignoreInput)}
              className="w-full bg-surface-bg border border-border-subtle rounded-xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-brand-accent transition-all font-mono"
            />
            <button 
              onClick={() => addItem('ignore', ignoreInput)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-primary/40 text-white rounded-lg hover:bg-brand-primary hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {profile.preferences.ignore.map((item, i) => (
                <motion.div
                  key={`ignore-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="group flex items-center gap-2 bg-brand-primary/5 text-brand-primary/60 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-brand-primary/5 uppercase tracking-tight"
                >
                  {item}
                  <button onClick={() => removeItem('ignore', i)} className="opacity-40 hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-brand-primary rounded-3xl p-10 flex flex-col md:flex-row items-center gap-8 text-white relative overflow-hidden group border border-brand-primary shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-lg">
          <h4 className="text-2xl font-bold tracking-tight uppercase">SECURE REGULATORY VAULT</h4>
          <p className="text-white/60 text-sm leading-relaxed font-mono">
            Compliance processing occurs within an isolated session. Extracted data is stored across encrypted Firestore instances, adhering to CA data retention principles.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold tracking-widest uppercase text-white/40 pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              AES-256 STORAGE
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              PRIVATE ACCESS
            </div>
          </div>
        </div>
        <div className="ml-auto relative z-10">
           <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center backdrop-blur-xl border border-white/10 group-hover:rotate-6 transition-transform">
             <Settings className="w-10 h-10 text-white animate-spin-slow" />
           </div>
        </div>
        
        {/* Abstract background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 blur-[100px] -ml-32 -mb-32" />
      </div>
    </div>
  );
}
