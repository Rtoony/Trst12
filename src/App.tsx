import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  History, 
  Settings, 
  Plus, 
  LogOut, 
  User as UserIcon,
  Loader2,
  Scan,
  History as HistoryIcon,
  ChevronRight,
  Shield,
  History as HistoryDoc
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { cn } from './lib/utils';
import type { UserProfile } from './types';

// Components
import ScannerView from './components/ScannerView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'scan' | 'settings'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            preferences: {
              lookFor: [],
              ignore: []
            },
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          setProfile(newProfile);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center font-sans tracking-widest">
        <motion.div 
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-brand-primary font-bold text-xs flex flex-col items-center gap-4"
        >
          <div className="w-8 h-8 border-2 border-brand-primary/10 border-t-brand-accent rounded-full animate-spin" />
          ESTABLISHING COMPLIANCE CHANNEL
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-bg flex flex-col items-center justify-center p-6 font-sans institutional-grid">
        <div className="max-w-md w-full space-y-12 text-center relative z-10">
          <div className="space-y-4">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-center"
            >
              <div className="w-20 h-20 bg-brand-primary rounded-3xl flex items-center justify-center shadow-xl shadow-brand-primary/20">
                <ShieldCheck className="text-white w-10 h-10" />
              </div>
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-brand-primary uppercase">Compliance Engine</h1>
              <p className="text-brand-primary/60 text-sm font-mono uppercase tracking-tight">Technical Analysis & Secure Record Retention</p>
            </div>
          </div>
          
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full py-5 bg-brand-primary text-white rounded-xl font-bold text-sm tracking-widest flex items-center justify-center gap-4 hover:bg-brand-primary/95 transition-all shadow-2xl shadow-brand-primary/30 disabled:opacity-50 group uppercase"
          >
            {isLoggingIn ? (
              <span className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
                SYNCHRONIZING...
              </span>
            ) : (
              <>
                <UserIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Initialize Secure Session
              </>
            )}
          </button>
          
          <div className="p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-border-subtle inline-block">
            <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-widest leading-loose">
              AUTHORIZED PERSONNEL ONLY • 256-BIT ENCRYPTION • PERSISTENT LOGGING
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bg text-brand-primary font-sans flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <nav 
        className="w-full lg:w-72 bg-white lg:border-r border-border-subtle p-6 flex flex-col gap-2 z-20 relative"
        id="sidebar-nav"
      >
        <div className="flex items-center gap-4 px-2 py-6 mb-8 border-b border-border-subtle">
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shrink-0">
             <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-bold tracking-tight text-lg block leading-none">REGULATORY</span>
            <span className="text-[10px] font-bold text-brand-accent tracking-widest uppercase">Compliance v2.60</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="px-4 text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest mb-2 font-mono">Systems</p>
          <NavButton 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            icon={<History className="w-5 h-5" />}
            label="Archive Vault"
          />
          <NavButton 
            active={currentView === 'scan'} 
            onClick={() => setCurrentView('scan')}
            icon={<Scan className="w-5 h-5" />}
            label="New Analysis"
            primary
          />
          <NavButton 
            active={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')}
            icon={<Settings className="w-5 h-5" />}
            label="Engine Config"
          />
        </div>

        <div className="mt-auto pt-6 border-t border-border-subtle flex flex-col gap-3">
          <div className="px-4 py-3 bg-surface-bg rounded-xl border border-border-subtle">
            <p className="text-[9px] text-brand-primary/40 uppercase font-bold tracking-widest mb-1 font-mono">Session ID</p>
            <p className="text-[11px] font-mono font-bold truncate opacity-80">{user.uid.slice(0, 12).toUpperCase()}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-brand-primary/60 hover:text-red-600 hover:bg-red-50 transition-all text-[10px] font-bold uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            Terminate Session
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col institutional-grid">
        <header className="px-8 py-10 flex items-center justify-between z-10 bg-surface-bg/80 backdrop-blur-sm sticky top-0 border-b border-border-subtle">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight uppercase">
              {currentView === 'dashboard' ? 'Regulatory Archives' : currentView.replace('-', ' ')}
            </h2>
            <p className="text-[10px] font-mono text-brand-primary/40 uppercase tracking-widest uppercase">
              SYSTEM STATUS: <span className="text-green-600 font-bold">OPERATIONAL</span> • ENCRYPTION: <span className="text-brand-accent font-bold">ACTIVE</span>
            </p>
          </div>
          {currentView === 'dashboard' && (
             <button 
                onClick={() => setCurrentView('scan')}
                className="lg:hidden w-12 h-12 bg-brand-primary text-white rounded-xl shadow-lg flex items-center justify-center transform active:scale-95 transition-all"
             >
                <Plus className="w-6 h-6" />
             </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="max-w-6xl mx-auto w-full h-full"
            >
              {currentView === 'dashboard' && <HistoryView />}
              {currentView === 'scan' && <ScannerView profile={profile} onComplete={() => setCurrentView('dashboard')} />}
              {currentView === 'settings' && <SettingsView profile={profile} setProfile={setProfile} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  primary = false 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group text-[11px] font-bold uppercase tracking-widest",
        active 
          ? "bg-brand-primary text-white shadow-xl shadow-brand-primary/10" 
          : primary 
            ? "text-brand-accent hover:bg-brand-accent/5 font-mono"
            : "hover:bg-brand-primary/5 text-brand-primary/50 hover:text-brand-primary"
      )}
    >
      <span className={cn(
        "transition-transform group-hover:scale-110",
        active ? "text-white" : "text-inherit opacity-60"
      )}>
        {icon}
      </span>
      {label}
    </button>
  );
}
