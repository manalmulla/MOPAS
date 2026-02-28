import React, { useState } from 'react';
import { Mail, ShieldAlert, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { analyzeEmail, AnalysisResult } from '../services/geminiService';
import RiskMeter from './RiskMeter';
import { motion, AnimatePresence } from 'motion/react';

export default function EmailAnalyzer() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content) return;
    setLoading(true);
    try {
      const res = await analyzeEmail(content);
      setResult(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Input ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mail size={18} color="var(--warn)" />
          Email Content Analysis
        </h2>
        <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            className="input-field"
            rows={6}
            placeholder="Paste the email content here (including headers if possible)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" disabled={loading} className="scan-btn">
              {loading ? <div className="spinner" /> : 'ANALYZE EMAIL'}
            </button>
            {loading && (
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                Running AI threat analysis...
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}
          >
            {/* Risk meter */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RiskMeter score={result.riskScore} level={result.threatLevel} />
            </div>

            {/* Details */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Threat assessment */}
              <div>
                <h3 className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.riskScore > 50
                    ? <ShieldAlert size={16} color="var(--danger)" />
                    : <CheckCircle2 size={16} color="var(--success)" />}
                  Threat Assessment
                </h3>
                <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{result.summary}</p>
              </div>

              {/* Detection details */}
              <div>
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2, marginBottom: 10 }}>DETECTION DETAILS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.details.map((detail, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(196,168,255,0.05)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                      <Info size={14} color="var(--accent)" style={{ marginTop: 1, flexShrink: 0 }} />
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--text)' }}>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: result.riskScore > 50 ? 'rgba(255,143,171,0.07)' : 'rgba(184,169,240,0.07)',
                border: `1px solid ${result.riskScore > 50 ? 'rgba(255,143,171,0.25)' : 'rgba(184,169,240,0.25)'}`,
              }}>
                <p className="font-display" style={{ fontSize: 12, color: result.riskScore > 50 ? 'var(--danger)' : 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} />
                  Security Action
                </p>
                <p className="font-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{result.recommendation}</p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}