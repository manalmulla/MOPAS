import React, { useState, useCallback } from 'react';
import { FileText, ShieldAlert, CheckCircle2, AlertTriangle, Info, Upload, X, File } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { analyzeDocument, AnalysisResult } from '../services/geminiService';
import { canSearch, recordSearch, getMsUntilNextSearch } from '../services/rateLimitService';
import { trackDetection } from '../services/analyticsService';
import RiskMeter from './RiskMeter';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import { exportToPdf } from '../utils/exportPdf';

// Set up pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function DocumentAnalyzer() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');

  const extractTextFromPDF = async (data: ArrayBuffer) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    } catch (err) {
      console.error('Error extracting PDF text:', err);
      throw new Error('Could not read PDF content.');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setFileName(file.name);
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      if (!(await canSearch())) {
        const waitMs = await getMsUntilNextSearch();
        const minutes = Math.ceil(waitMs / 60000);
        throw new Error(`Rate limit reached. Please try again in ${minutes} minutes.`);
      }

      let text = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        text = await extractTextFromPDF(arrayBuffer);
      } else {
        // Fallback for text files or simple docs
        text = await file.text();
      }

      if (!text.trim()) {
        throw new Error('The document appears to be empty or unreadable.');
      }

      setExtractedText(text);
      const res = await analyzeDocument(text);
      setResult(res);
      await recordSearch();

      trackDetection({
        type: "DOC",
        target: file.name,
        risk_score: res.riskScore,
        threat_level: res.threatLevel as any,
        is_malicious: res.riskScore >= 60,
        summary: res.summary
      }).catch(console.error);

    } catch (err: any) {
      setError(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: false,
    disabled: loading
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* ── Input Card ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={18} color="var(--accent)" />
          Document Threat Scanner
        </h2>

        {error && (
          <div style={{ background: 'rgba(255,143,171,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
          </div>
        )}

        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 10,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            background: isDragActive ? 'rgba(196,168,255,0.06)' : 'transparent',
            opacity: loading ? 0.6 : 1
          }}
        >
          <input {...getInputProps()} />
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="spinner" />
              <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>EXTRACTING & ANALYZING DOCUMENT...</p>
            </div>
          ) : (
            <>
              <Upload size={40} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
              <p className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
                {fileName ? `Selected: ${fileName}` : 'Drop PDF or Document here'}
              </p>
              <p className="font-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                Scan invoices, contracts, or attachments for hidden threats
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            id="doc-analyzer-result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="auto-grid"
          >
            {/* Risk Meter & Export */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiskMeter score={result.riskScore} level={result.threatLevel} />
              </div>
              
              <button
                className="export-btn"
                onClick={() => exportToPdf('doc-analyzer-result', `MOPAS-Doc-Report-${Date.now()}.pdf`)}
                style={{ width: '100%', background: 'rgba(184,169,240,0.1)', border: '1px solid var(--accent)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, transition: 'all 0.2s', padding: '10px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = '#000'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(184,169,240,0.1)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              >
                PDF EXPORT
              </button>

              <button
                onClick={() => { setResult(null); setFileName(null); setExtractedText(''); }}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, transition: 'all 0.2s', padding: '10px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              >
                <X size={14} /> NEW SCAN
              </button>
            </div>

            {/* Details */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div>
                <h3 className="font-display" style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.riskScore > 50 
                    ? <ShieldAlert size={16} color="var(--danger)" /> 
                    : <CheckCircle2 size={16} color="var(--success)" />}
                  Analysis Summary
                </h3>
                <p className="font-mono" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{result.summary}</p>
              </div>

              <div>
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 2, marginBottom: 10 }}>THREAT INDICATORS</p>
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
                padding: '12px 16px',
                borderRadius: 8,
                background: result.riskScore > 50 ? 'rgba(255,143,171,0.07)' : 'rgba(184,169,240,0.07)',
                border: `1px solid ${result.riskScore > 50 ? 'rgba(255,143,171,0.25)' : 'rgba(184,169,240,0.25)'}`,
              }}>
                <p className="font-display" style={{ fontSize: 12, color: result.riskScore > 50 ? 'var(--danger)' : 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Security Action
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
