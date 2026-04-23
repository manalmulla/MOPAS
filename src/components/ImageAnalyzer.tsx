import React, { useState, useCallback } from 'react';
import { Image as ImageIcon, ShieldAlert, CheckCircle2, AlertTriangle, Info, Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { analyzeImage, AnalysisResult } from '../services/geminiService';
import { canSearch, recordSearch, getMsUntilNextSearch } from '../services/rateLimitService';
import { trackDetection } from '../services/analyticsService';
import { exportToPdf } from '../utils/exportPdf';
import RiskMeter from './RiskMeter';
import { motion, AnimatePresence } from 'motion/react';

export default function ImageAnalyzer() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const handleAnalyze = async () => {
    if (!image) return;
    setError(null);

    if (!(await canSearch())) {
      const waitMs = await getMsUntilNextSearch();
      const minutes = Math.ceil(waitMs / 60000);
      setError(`Rate limit reached. Please try again in ${minutes} minutes.`);
      return;
    }

    setLoading(true);
    try {
      const res = await analyzeImage(image);
      setResult(res);
      await recordSearch();

      // Log threat to dashboard/database
      trackDetection({
        type: "IMAGE",
        target: "Image Analysis Result",
        risk_score: res.riskScore,
        threat_level: res.threatLevel as any,
        is_malicious: res.riskScore >= 60,
        summary: res.summary
      }).catch(console.error);
    } catch (error) {
      console.error(error);
      setError("Analysis failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Input card ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ImageIcon size={18} color="var(--purple)" />
          Visual Threat Analysis
        </h2>

        {error && (
          <div style={{ background: 'rgba(255,143,171,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
          </div>
        )}

        {!image ? (
          /* ── Dropzone ── */
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: isDragActive ? 'rgba(196,168,255,0.06)' : 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(196,168,255,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = isDragActive ? 'var(--accent)' : 'var(--border)')}
          >
            <input {...getInputProps()} />
            <Upload size={40} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
            <p className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
              Drop a screenshot or image here
            </p>
            <p className="font-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              Analyze login forms, fake websites, or suspicious graphics
            </p>
          </div>
        ) : (
          /* ── Preview ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img
                src={image}
                alt="To analyze"
                style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: 'rgba(0,0,0,0.4)', display: 'block' }}
              />
              <button
                onClick={() => setImage(null)}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border)',
                  color: 'var(--muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--danger)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                disabled={loading}
                onClick={handleAnalyze}
                className="scan-btn"
              >
                {loading ? <div className="spinner" /> : 'ANALYZE IMAGE'}
              </button>
              {loading && (
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                  Running visual threat analysis...
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            id="image-analyzer-result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="auto-grid"
          >
            {/* Risk meter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiskMeter score={result.riskScore} level={result.threatLevel} />
              </div>
              <button
                className="export-btn"
                onClick={() => exportToPdf('image-analyzer-result', `MOPAS-Image-Report-${Date.now()}.pdf`)}
                style={{ width: '100%', background: 'rgba(184,169,240,0.1)', border: '1px solid var(--accent)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, transition: 'all 0.2s', padding: '10px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = '#000'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(184,169,240,0.1)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              >
                PDF EXPORT
              </button>
            </div>

            {/* Details */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Visual findings */}
              <div>
                <h3 className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.riskScore > 50
                    ? <ShieldAlert size={16} color="var(--danger)" />
                    : <CheckCircle2 size={16} color="var(--success)" />}
                  Visual Findings
                </h3>
                <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{result.summary}</p>
              </div>

              {/* Detected elements */}
              <div>
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2, marginBottom: 10 }}>DETECTED ELEMENTS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.details.map((detail, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(196,168,255,0.05)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                      <Info size={14} color="var(--accent)" style={{ marginTop: 1, flexShrink: 0 }} />
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--text)' }}>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security verdict */}
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: result.riskScore > 50 ? 'rgba(255,143,171,0.07)' : 'rgba(184,169,240,0.07)',
                border: `1px solid ${result.riskScore > 50 ? 'rgba(255,143,171,0.25)' : 'rgba(184,169,240,0.25)'}`,
              }}>
                <p className="font-display" style={{ fontSize: 12, color: result.riskScore > 50 ? 'var(--danger)' : 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} />
                  Security Verdict
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