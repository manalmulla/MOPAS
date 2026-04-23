import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Mail, Lock, UserPlus, LogIn, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setSuccess('Account created! Please check your email for confirmation.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Google Auth Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Background elements */}
      <div className="auth-glow" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-box"
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="auth-logo">
            <Shield size={32} color="var(--accent)" />
          </div>
          <h1 className="font-display" style={{ fontSize: 24, letterSpacing: 4, marginBottom: 8, color:'var(--accent)' }}>MOPAS</h1>
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2 }}>SECURE THREAT INTELLIGENCE PORTAL</p>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="auth-input-group">
            <Mail size={16} className="auth-icon" />
            <input 
              type="email" 
              placeholder="System Administrator Email" 
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-input-group">
            <Lock size={16} className="auth-icon" />
            <input 
              type="password" 
              placeholder="Security Access Key" 
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="auth-alert error"
              >
                <p className="font-mono" style={{ fontSize: 11 }}>[CRITICAL_AUTH_FAILURE]: {error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="auth-alert success"
              >
                <p className="font-mono" style={{ fontSize: 11 }}>[SYSTEM_MESSAGE]: {success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? (
              <div className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <>
                {isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
                <span className="font-display" style={{ letterSpacing: 2, fontSize: 11 }}>
                  {isSignUp ? 'INITIALIZE ACCOUNT' : 'SECURE ACCESS'}
                </span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>OR LOGIN VIA</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <button onClick={handleGoogleLogin} disabled={loading} className="github-auth-btn" style={{ margin: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-mono" style={{ fontSize: 10 }}>CONTINUE WITH GOOGLE</span>
          </button>
        </div>

        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16, textAlign: 'center' }}>
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="auth-toggle"
          >
            {isSignUp ? "ALREADY REGISTERED? LOGIN" : "NO ACCOUNT? REGISTER"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
