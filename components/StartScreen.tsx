/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { signInWithGoogle, auth } from '../firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

interface StartScreenProps {
  onStart: (aiEnabled: boolean, user: User | null) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const loggedInUser = await signInWithGoogle();
      setUser(loggedInUser);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-white font-sans p-6 bg-black/30 backdrop-blur-sm transition-all duration-1000">
      <div className="max-w-md w-full bg-slate-900/90 p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-xl relative overflow-hidden animate-fade-in">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
            <h1 className="text-5xl font-black mb-2 bg-gradient-to-br from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent tracking-tight">
            SkyMetropolis
            </h1>
            <p className="text-slate-400 mb-8 text-sm font-medium uppercase tracking-widest">
            Isometric City Builder
            </p>

            {isAuthChecking ? (
              <div className="w-full py-8 flex flex-col items-center justify-center gap-4 animate-pulse">
                <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Verifying Identity...</p>
              </div>
            ) : !user ? (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full py-4 mb-6 bg-white text-slate-900 font-bold rounded-xl shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98] text-lg tracking-wide flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
              </button>
            ) : (
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center gap-4">
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-10 h-10 rounded-full border border-slate-600" />
                <div>
                  <p className="font-bold text-slate-200">{user.displayName}</p>
                  <p className="text-xs text-slate-500">Cloud Sync Enabled</p>
                </div>
              </div>
            )}

            <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 mb-8 hover:border-slate-600 transition-colors shadow-inner">
            <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col gap-1">
                <span className="font-bold text-base text-slate-200 group-hover:text-white transition-colors flex items-center gap-2">
                    City Advisor
                    {aiEnabled && <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>}
                </span>
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    Enable dynamic quests & news events
                </span>
                </div>
                
                <div className="relative flex-shrink-0 ml-4">
                <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600 peer-checked:after:bg-white"></div>
                </div>
            </label>
            </div>

            <button 
            onClick={() => onStart(aiEnabled, user)}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 transform transition-all hover:scale-[1.02] active:scale-[0.98] text-lg tracking-wide"
            >
            Start Building
            </button>

            <div className="mt-8 text-center">
                <a 
                    href="https://x.com/ammaar" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-400 transition-colors font-mono group"
                >
                    <span>Created by</span>
                    <span className="font-bold group-hover:underline decoration-cyan-500/50 underline-offset-2">@ammaar</span>
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
