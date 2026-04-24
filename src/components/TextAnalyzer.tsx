import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ShieldAlert, CheckCircle2, Search, Info, AlertTriangle, Cpu, Activity, Clipboard } from 'lucide-react';
import { RiskMeter } from './RiskMeter';

export const TextAnalyzer: React.FC = () => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Failed to analyze text');
      
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Connection to analysis engine failed");
    } finally {
      setLoading(false);
    }
  };

  const highlightText = (content: string, phrases: string[]) => {
    if (!phrases || phrases.length === 0) return content;
    let highlighted = content;
    phrases.forEach(phrase => {
      const reg = new RegExp(`(${phrase})`, 'gi');
      highlighted = highlighted.replace(reg, '<mark style="background: rgba(255,143,171,0.3); color: #ff8fab; padding: 0 2px; border-radius: 2px;">$1</mark>');
    });
    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const getVerdict = (score: number) => {
    if (score > 0.8) return { label: 'CRITICAL THREAT', color: 'var(--danger)', icon: <ShieldAlert size={24} /> };
    if (score > 0.5) return { label: 'SUSPICIOUS', color: 'var(--warn)', icon: <AlertTriangle size={24} /> };
    return { label: 'LIKELY SAFE', color: 'var(--success)', icon: <CheckCircle2 size={24} /> };
  };

  const verdict = result ? getVerdict(result.risk_score) : null;

  return (
    <div className="analyzer-container" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="analyzer-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 10, borderRadius: 12, background: 'rgba(184,169,240,0.1)', color: 'var(--accent)' }}>
            <MessageSquare size={24} />
          </div>
          <div>
            <h2 className="font-display" style={{ fontSize: 24, letterSpacing: -0.5 }}>NLP Text Analyzer</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'monospace' }}>Detect phishing intent, urgency, and scams in SMS or emails</p>
          </div>
        </div>

        <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <textarea
              placeholder="Paste your message here (SMS, Email, or WhatsApp text)..."
              className="input-field"
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ 
                width: '100%', 
                minHeight: 180, 
                padding: '20px', 
                fontSize: 15, 
                lineHeight: 1.6,
                resize: 'vertical',
                background: 'rgba(0,0,0,0.2)'
              }}
            />
            <button 
              type="button" 
              onClick={async () => {
                const copiedText = await navigator.clipboard.readText();
                setText(copiedText);
              }}
              style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--muted)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Clipboard size={12} /> PASTE
            </button>
          </div>
          
          <button type="submit" disabled={loading || !text} className="scan-btn" style={{ width: '100%', height: 54 }}>
            {loading ? <div className="spinner" /> : <>RUN NLP ANALYSIS</>}
          </button>
        </form>

        {error && <div className="error-box" style={{ marginTop: 20 }}>{error}</div>}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}
          >
            {/* Verdict Banner */}
            <div style={{ 
              background: 'var(--card)', 
              border: '1px solid var(--border)', 
              borderLeft: `4px solid ${verdict?.color}`,
              borderRadius: 12, 
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${verdict?.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: verdict?.color }}>
                  {verdict?.icon}
                </div>
                <div>
                  <p className="font-mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2 }}>MESSAGE INTENT</p>
                  <p className="font-display" style={{ fontSize: 24, color: verdict?.color }}>{result.intent}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="font-mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2 }}>RISK PROBABILITY</p>
                <p className="font-display" style={{ fontSize: 32, color: verdict?.color }}>{Math.round(result.risk_score * 100)}%</p>
              </div>
            </div>

            <div className="auto-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {/* Highlighted Text */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                <p className="font-display" style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: 2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cpu size={14} /> HEURISTIC HIGHLIGHTS
                </p>
                <div style={{ 
                  padding: 20, 
                  background: 'rgba(0,0,0,0.3)', 
                  borderRadius: 8, 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 14, 
                  lineHeight: 1.8, 
                  color: 'var(--text)',
                  border: '1px solid var(--border)'
                }}>
                  {highlightText(text, result.highlights)}
                </div>
                <p style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
                  Highlighted phrases indicate common phishing tactics like urgency, fake authority, or payment scams.
                </p>
              </div>

              {/* Pattern Analysis */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                  <p className="font-display" style={{ fontSize: 12, color: 'var(--warn)', letterSpacing: 2, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={14} /> DETECTED RISK PATTERNS
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {result.indicators.length > 0 ? (
                      result.indicators.map((ind: string, i: number) => (
                        <div key={i} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,143,171,0.1)', border: '1px solid rgba(255,143,171,0.2)', color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
                          {ind}
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--muted)' }}>No explicit risk patterns detected via heuristic scan.</p>
                    )}
                  </div>
                </div>

                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                  <p className="font-display" style={{ fontSize: 12, color: 'var(--success)', letterSpacing: 2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Info size={14} /> NLP ENGINE CONFIDENCE
                  </p>
                  <div style={{ height: 8, width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', width: `${result.confidence * 100}%`, background: 'var(--success)', borderRadius: 4 }} />
                  </div>
                  <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {Math.round(result.confidence * 100)}% Confidence level from BERT-Tiny Classifier.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
