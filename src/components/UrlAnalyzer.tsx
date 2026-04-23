import React, { useState } from 'react';
import { Search, ShieldAlert, CheckCircle2, AlertTriangle, Info, Cpu, Activity, X } from 'lucide-react';
import { analyzeUrl, AnalysisResult } from '../services/geminiService';
import { analyzeHeuristics, getFeatureArray } from '../services/heuristicService';
import { mlModelService } from '../services/mlModelService';
import { canSearch, recordSearch, getMsUntilNextSearch } from '../services/rateLimitService';
import { trackDetection } from '../services/analyticsService';
import { exportToPdf } from '../utils/exportPdf';
import RiskMeter from './RiskMeter';
import { motion, AnimatePresence } from 'motion/react';

export default function UrlAnalyzer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [heuristicResult, setHeuristicResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mlMetadata, setMlMetadata] = useState<any>(null);
  const [advancedResult, setAdvancedResult] = useState<any | null>(null);

  React.useEffect(() => {
    mlModelService.init().then(() => {
      setMlMetadata(mlModelService.getMetadata());
    });
  }, []);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url) return;
    setError(null);

    if (!(await canSearch())) {
      const waitMs = await getMsUntilNextSearch();
      const minutes = Math.ceil(waitMs / 60000);
      setError(`Rate limit reached. Please try again in ${minutes} minutes.`);
      return;
    }

    setLoading(true);
    try {
      // 1. Parallel Analysis (AI Heuristics + Backend)

      const [aiRes, hRes] = await Promise.all([
        analyzeUrl(url),
        Promise.resolve(analyzeHeuristics(url)),
      ]);
      setHeuristicResult(hRes);

      // Fetch advanced backend results (including RF score)
      const backendRes = await fetch('http://localhost:8000/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(res => res.json());

      setAdvancedResult(backendRes);
      
      // 2. ML Scores (Backend Random Forest)
      const mlScore = Math.round((backendRes.ml_rf_score || 0.5) * 100);

      // 3. Combined Result (Weighted: 60% Random Forest, 30% Heuristics, 10% Domain)
      const combinedScore = Math.round(
        (mlScore * 0.60) + 
        (hRes.score * 0.30) +
        ((backendRes.domain_intel?.is_new_domain ? 100 : 0) * 0.10)
      );
      
      const threatLevel = combinedScore > 80 ? "Critical" : combinedScore > 60 ? "High" : combinedScore > 30 ? "Medium" : "Low";

      // 4. Generate AI Analysis Details (Detailed reasoning)
      const details: string[] = [];
      if (hRes.features.has_ip) details.push("Uses raw IP address instead of domain");
      if (hRes.features.num_dots > 3) details.push(`High dot count (${hRes.features.num_dots}) suggests deep subdomaining`);
      if (hRes.features.has_suspicious_words) details.push("Contains sensitive keywords (login/verify/bank)");
      if (hRes.features.url_entropy > 4.5) details.push("High character entropy suggests obfuscated URL");
      if (hRes.features.has_shortener) details.push("Uses URL shortener to hide destination");
      if (backendRes.domain_intel?.is_new_domain) details.push("Domain is extremely young (<90 days)");
      if (backendRes.redirect_chain?.length > 2) details.push("Suspicious redirect chain detected");

      const aiSummary = details.length > 0 
        ? `Found ${details.length} critical indicators: ${details.join(", ")}.`
        : "No immediate behavioral red flags detected, but the ML model remains cautious.";

      const finalRes: any = {
        ...aiRes,
        riskScore: combinedScore,
        threatLevel: threatLevel,
        mlScore: mlScore,
        heuristicScore: hRes.score,
        aiSummary: aiSummary,
        mlSummary: `Random Forest Model confidence: ${mlScore}%`
      };

      setResult(finalRes);
      await recordSearch();



      trackDetection({
        type: "URL",
        target: url,
        risk_score: finalRes.riskScore,
        threat_level: finalRes.threatLevel as any,
        is_malicious: finalRes.riskScore >= 60,
        summary: finalRes.summary
      }).catch(console.error);
    } catch (error: any) {
      console.error("ANALYSIS ERROR:", error);
      setError(error.message || "Analysis failed. Please check your connection.");
    } finally {
      setLoading(false);
    }

  };

  const averageScore = result ? result.riskScore : 0;

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

        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Enter URL to scan (e.g., https://secure-login.com)"
            className="input-field"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            style={{ flex: 1, minWidth: 'min(100%, 300px)' }}
          />
          <button type="submit" disabled={loading} className="scan-btn" style={{ width: 'auto', flexGrow: 1 }}>
            {loading ? <div className="spinner" /> : 'ANALYZE'}
          </button>
        </form>
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {result && heuristicResult && (
          <motion.div
            id="url-analyzer-result"
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
              flexWrap: 'wrap',
              gap: 16
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
            <div className="auto-grid">

              {/* Score meters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <p className="font-display" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={12} /> HYBRID SECURITY ENGINE
                  </p>
                  <div style={{ display: 'flex', gap: 20, width: '100%', justifyContent: 'center' }}>
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <p className="font-mono" style={{ fontSize: 8, color: 'var(--muted)' }}>RANDOM FOREST</p>
                        <RiskMeter score={result.mlScore} level={result.mlScore > 50 ? 'High' : 'Low'} size={120} />
                     </div>
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <p className="font-mono" style={{ fontSize: 8, color: 'var(--muted)' }}>HYBRID THREAT SCORE</p>
                        <RiskMeter score={result.riskScore} level={result.threatLevel} size={120} />
                     </div>

                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setResult(null); setHeuristicResult(null); setError(null); }}
                    style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, transition: 'all 0.2s', padding: '10px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  >
                    <X size={14} /> CLEAR
                  </button>
                  <button
                    className="export-btn"
                    onClick={() => exportToPdf('url-analyzer-result', `MOPAS-URL-Report-${Date.now()}.pdf`)}
                    style={{ flex: 1, background: 'rgba(184,169,240,0.1)', border: '1px solid var(--accent)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, transition: 'all 0.2s', padding: '10px' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = '#000'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(184,169,240,0.1)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                  >
                    PDF EXPORT
                  </button>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <p className="font-display" style={{ fontSize: 10, color: 'var(--warn)', letterSpacing: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={12} /> HEURISTIC SCAN
                  </p>
                  <RiskMeter score={heuristicResult.score} level={heuristicResult.score > 50 ? 'High' : 'Low'} />
                </div>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Model Analysis */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }}>
                  
                  {/* Model Metrics */}
                  {mlMetadata && (
                    <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(196,168,255,0.05)', border: '1px solid var(--border)', marginBottom: 20 }}>
                      <p className="font-display" style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 2, marginBottom: 8 }}>LOCAL RANDOM FOREST MODEL METRICS</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          <div>
                            <p className="font-mono" style={{ fontSize: 8, color: 'var(--muted)' }}>ACCURACY</p>
                            <p className="font-display" style={{ fontSize: 14, color: 'var(--text)' }}>{(mlMetadata.accuracy * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="font-mono" style={{ fontSize: 8, color: 'var(--muted)' }}>PRECISION</p>
                            <p className="font-display" style={{ fontSize: 14, color: 'var(--text)' }}>{(mlMetadata.precision * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="font-mono" style={{ fontSize: 8, color: 'var(--muted)' }}>RECALL</p>
                            <p className="font-display" style={{ fontSize: 14, color: 'var(--text)' }}>{(mlMetadata.recall * 100).toFixed(1)}%</p>
                          </div>
                      </div>
                    </div>
                  )}

                  <h3 className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Info size={15} color="var(--accent)" /> Hybrid Intelligence Insights
                  </h3>
                  
                  <div style={{ marginBottom: 20 }}>
                    <p className="font-mono" style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 8 }}>// AI THREAT REASONING</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {result.aiSummary.includes("critical indicators:") ? (
                        <>
                          <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                            {result.aiSummary.split(":")[0]}:
                          </p>
                          {result.aiSummary.split(":")[1].split(",").map((indicator: string, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                               <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                               <p className="font-mono" style={{ fontSize: 12, color: 'var(--text)' }}>{indicator.trim()}</p>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{result.aiSummary}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="font-mono" style={{ fontSize: 10, color: 'var(--success)', marginBottom: 6 }}>// RANDOM FOREST CLASSIFICATION</p>
                    <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                      {result.mlSummary}. The model processed 24 behavioral vectors in the Python sandbox to confirm threat patterns.
                    </p>
                  </div>




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
                    <Activity size={15} color="var(--warn)" /> Heuristic Analysis
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
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