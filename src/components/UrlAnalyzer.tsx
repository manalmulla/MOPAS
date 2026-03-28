import React, { useState } from 'react';
import { Search, ShieldAlert, CheckCircle2, AlertTriangle, Info, Cpu, Activity, X } from 'lucide-react';
import { analyzeUrl } from '../services/geminiService';
import { analyzeHeuristics } from '../services/heuristicService';
import { canSearch, recordSearch, getMsUntilNextSearch } from '../services/rateLimitService';
import RiskMeter from './RiskMeter';
import { motion, AnimatePresence } from 'motion/react';

export default function UrlAnalyzer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [heuristicResult, setHeuristicResult] = useState(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url) return;
    setError(null);

    if (!canSearch()) {
      const waitMs = getMsUntilNextSearch();
      const minutes = Math.ceil(waitMs / 60000);
      setError(`Rate limit reached. Please try again in ${minutes} minutes.`);
      return;
    }

    setLoading(true);
    try {
      const [aiRes, hRes] = await Promise.all([
        analyzeUrl(url),
        Promise.resolve(analyzeHeuristics(url)),
      ]);
      setResult(aiRes);
      setHeuristicResult(hRes);
      recordSearch();
    } catch (error) {
      console.error(error);
      setError("Analysis failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const averageScore = result && heuristicResult
    ? Math.round((result.riskScore + heuristicResult.score) / 2)
    : 0;

  const getVerdict = (score) => {
    if (score < 30) return { label: 'Safe',       color: '#b8a9f0' };
    if (score < 60) return { label: 'Suspicious', color: '#f0c4e8' };
    return             { label: 'Malicious',  color: '#ff8fab' };
  };

  const verdict = getVerdict(averageScore);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Input ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={18} color="var(--accent)" />
          Hybrid URL Threat Analysis
        </h2>

        {error && (
          <div style={{ background: 'rgba(255,143,171,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="Enter URL to scan (e.g., https://secure-login.com)"
            className="input-field"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            style={{ resize: 'vertical' }}
          />
          <button type="submit" disabled={loading} className="scan-btn">
            {loading ? <div className="spinner" /> : 'ANALYZE'}
          </button>
        </form>
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {result && heuristicResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Verdict banner */}
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderLeft: `4px solid ${verdict.color}`,
              borderRadius: 10,
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${verdict.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {averageScore > 50
                    ? <ShieldAlert size={20} color={verdict.color} />
                    : <CheckCircle2 size={20} color={verdict.color} />}
                </div>
                <div>
                  <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2 }}>FINAL VERDICT</p>
                  <p className="font-display" style={{ fontSize: 22, color: verdict.color, lineHeight: 1.2 }}>{verdict.label}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2 }}>COMBINED RISK</p>
                <p className="font-display" style={{ fontSize: 32, color: verdict.color, lineHeight: 1 }}>{averageScore}%</p>
              </div>
            </div>

            {/* Scores + Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>

              {/* Score meters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <p className="font-display" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={12} /> AI ANALYSIS
                  </p>
                  <RiskMeter score={result.riskScore} level={result.threatLevel} />
                </div>
                <button
                  onClick={() => { setResult(null); setHeuristicResult(null); setError(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, transition: 'color 0.2s', padding: 0 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}
                >
                  <X size={14} /> CLEAR & SCAN AGAIN
                </button>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <p className="font-display" style={{ fontSize: 10, color: 'var(--warn)', letterSpacing: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={12} /> HEURISTIC SCAN
                  </p>
                  <RiskMeter score={heuristicResult.score} level={heuristicResult.score > 50 ? 'High' : 'Low'} />
                </div>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* AI Insights */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
                  <h3 className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Info size={15} color="var(--accent)" /> AI Insights
                  </h3>
                  <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{result.summary}</p>

                  <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2, margin: '18px 0 10px' }}>DETECTION INDICATORS</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {result.details.map((detail, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(196,168,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginTop: 4, flexShrink: 0 }} />
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--text)' }}>{detail}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recommendation */}
                  <div style={{
                    marginTop: 16, padding: '12px 16px', borderRadius: 8,
                    background: averageScore > 50 ? 'rgba(255,143,171,0.07)' : 'rgba(184,169,240,0.07)',
                    border: `1px solid ${averageScore > 50 ? 'rgba(255,143,171,0.25)' : 'rgba(184,169,240,0.25)'}`,
                  }}>
                    <p className="font-display" style={{ fontSize: 12, color: averageScore > 50 ? 'var(--danger)' : 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} /> Security Recommendation
                    </p>
                    <p className="font-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{result.recommendation}</p>
                  </div>
                </div>

                {/* Heuristic breakdown */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
                  <h3 className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={15} color="var(--warn)" /> Heuristic Feature Analysis
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { label: 'URL Length',       value: heuristicResult.features.url_length },
                      { label: 'Dots',             value: heuristicResult.features.num_dots },
                      { label: 'Subdomains',       value: heuristicResult.features.num_subdomains },
                      { label: 'Entropy',          value: heuristicResult.features.url_entropy.toFixed(2) },
                      { label: 'HTTPS',            value: heuristicResult.features.has_https ? 'Yes' : 'No',            color: heuristicResult.features.has_https ? 'var(--success)' : 'var(--danger)' },
                      { label: 'IP Host',          value: heuristicResult.features.has_ip ? 'Yes' : 'No',              color: heuristicResult.features.has_ip ? 'var(--danger)' : 'var(--success)' },
                      { label: 'Shortener',        value: heuristicResult.features.has_shortener ? 'Yes' : 'No',       color: heuristicResult.features.has_shortener ? 'var(--danger)' : 'var(--success)' },
                      { label: 'Suspicious Words', value: heuristicResult.features.has_suspicious_words ? 'Yes' : 'No',color: heuristicResult.features.has_suspicious_words ? 'var(--danger)' : 'var(--success)' },
                    ].map((feat, i) => (
                      <div key={i} style={{ background: 'rgba(196,168,255,0.05)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                        <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{feat.label}</p>
                        <p className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: feat.color || 'var(--text)' }}>{feat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}