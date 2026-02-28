import React, { useState, useRef } from 'react';
import { QrCode, ShieldAlert, CheckCircle2, AlertTriangle, Info, Camera, Upload, X } from 'lucide-react';
import jsQR from 'jsqr';
import { analyzeUrl, AnalysisResult } from '../services/geminiService';
import RiskMeter from './RiskMeter';
import { motion, AnimatePresence } from 'motion/react';

export default function QrAnalyzer() {
  const [decodedUrl, setDecodedUrl] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) { setDecodedUrl(code.data); setResult(null); }
          else alert('No QR code found in image');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setShowCamera(false);
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !showCamera) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width  = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) { setDecodedUrl(code.data); stopCamera(); return; }
    }
    requestAnimationFrame(scanFrame);
  };

  const handleAnalyze = async () => {
    if (!decodedUrl) return;
    setLoading(true);
    try {
      const res = await analyzeUrl(decodedUrl);
      setResult(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // shared hover helpers
  const hoverOn  = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(196,168,255,0.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(196,168,255,0.05)'; };
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Input card ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <QrCode size={18} color="var(--danger)" />
          QR Code Analysis
        </h2>

        {/* ── Option tiles ── */}
        {!decodedUrl && !showCamera && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Camera */}
            <button
              onClick={startCamera}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', border: '2px dashed var(--border)', borderRadius: 10, background: 'transparent', cursor: 'pointer', transition: 'all 0.2s', gap: 14 }}
              onMouseEnter={hoverOn} onMouseLeave={hoverOff}
            >
              <Camera size={40} color="var(--muted)" />
              <span className="font-display" style={{ fontSize: 13, color: 'var(--text)', letterSpacing: 1 }}>Scan with Camera</span>
            </button>

            {/* File upload */}
            <label
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', border: '2px dashed var(--border)', borderRadius: 10, background: 'transparent', cursor: 'pointer', transition: 'all 0.2s', gap: 14 }}
              onMouseEnter={hoverOn} onMouseLeave={hoverOff}
            >
              <Upload size={40} color="var(--muted)" />
              <span className="font-display" style={{ fontSize: 13, color: 'var(--text)', letterSpacing: 1 }}>Upload QR Image</span>
              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {/* ── Camera view ── */}
        {showCamera && (
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Close */}
            <button
              onClick={stopCamera}
              style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--danger)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
            >
              <X size={15} />
            </button>

            {/* Scan frame overlay */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: 200, height: 200, border: '2px solid var(--accent)', borderRadius: 12, boxShadow: '0 0 24px rgba(196,168,255,0.3)', animation: 'pulse-out 2s ease-out infinite' }} />
            </div>
          </div>
        )}

        {/* ── Decoded URL ── */}
        {decodedUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '14px 18px', background: 'rgba(196,168,255,0.05)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2, marginBottom: 6 }}>DECODED DESTINATION</p>
              <p className="font-mono" style={{ fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{decodedUrl}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setDecodedUrl(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, transition: 'color 0.2s', padding: 0 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--muted)'}
              >
                <X size={14} /> CLEAR & SCAN AGAIN
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {loading && <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent)' }}>Analyzing destination...</span>}
                <button disabled={loading} onClick={handleAnalyze} className="scan-btn">
                  {loading ? <div className="spinner" /> : 'ANALYZE DESTINATION'}
                </button>
              </div>
            </div>
          </div>
        )}
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

              <div>
                <h3 className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.riskScore > 50
                    ? <ShieldAlert size={16} color="var(--danger)" />
                    : <CheckCircle2 size={16} color="var(--success)" />}
                  QR Link Assessment
                </h3>
                <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{result.summary}</p>
              </div>

              <div>
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2, marginBottom: 10 }}>SECURITY DETAILS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.details.map((detail, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(196,168,255,0.05)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px' }}>
                      <Info size={14} color="var(--accent)" style={{ marginTop: 1, flexShrink: 0 }} />
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--text)' }}>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                padding: '12px 16px', borderRadius: 8,
                background: result.riskScore > 50 ? 'rgba(255,143,171,0.07)' : 'rgba(184,169,240,0.07)',
                border: `1px solid ${result.riskScore > 50 ? 'rgba(255,143,171,0.25)' : 'rgba(184,169,240,0.25)'}`,
              }}>
                <p className="font-display" style={{ fontSize: 12, color: result.riskScore > 50 ? 'var(--danger)' : 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Recommendation
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