import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ShieldAlert, CheckCircle2, AlertTriangle, Search, Info, Upload, FileText, Link2, Paperclip, ChevronRight } from 'lucide-react';

export default function EmailAnalyzer() {
  const [rawEmail, setRawEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e?: React.FormEvent, fileContent?: string) => {
    e?.preventDefault();
    if (!rawEmail.trim() && !fileContent) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/analyze/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          raw_email: rawEmail || null,
          file_content: fileContent || null
        })
      });

      if (!response.ok) throw new Error('Failed to analyze email');
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to security engine");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      handleAnalyze(undefined, base64);
    };
    reader.readAsDataURL(file);
  };

  const getSeverityColor = (score: number) => {
    if (score > 70) return 'var(--danger)';
    if (score > 30) return 'var(--warn)';
    return 'var(--success)';
  };

  return (
    <div className="analyzer-container" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="analyzer-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,179,71,0.1)', color: 'var(--warn)' }}>
            <Mail size={24} />
          </div>
          <div>
            <h2 className="font-display" style={{ fontSize: 24, letterSpacing: -0.5 }}>Forensic Email Analyzer</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Deep header inspection, body intent analysis, and attachment scanning</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <label className="upload-zone" style={{ minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer', gap: 20, background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
            <div style={{ padding: 20, borderRadius: '50%', background: 'rgba(196,168,255,0.1)', color: 'var(--accent)' }}>
              <Upload size={48} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 className="font-display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>UPLOAD .EML FILE</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Drag and drop your forensic email export or click to browse</p>
            </div>
            <input type="file" style={{ display: 'none' }} accept=".eml" onChange={handleFileUpload} />
            {loading && <div className="spinner" style={{ marginTop: 10 }} />}
          </label>
          
          <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Info size={18} color="var(--accent)" style={{ marginTop: 2 }} />
            <div>
              <p className="font-display" style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Why .eml files?</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                .eml files contain full server headers (SPF, DKIM, DMARC) which are essential for verifying the sender's true identity and detecting spoofing attempts.
              </p>
            </div>
          </div>
        </div>


        {error && <div className="error-box" style={{ marginTop: 20 }}>{error}</div>}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
            
            {/* Main Analysis Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Header Security Card */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                <p className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 2, marginBottom: 20 }}>HEADER SECURITY REPORT</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'SPF', status: result.header_security.spf },
                    { label: 'DKIM', status: result.header_security.dkim },
                    { label: 'DMARC', status: result.header_security.dmarc },
                  ].map(check => (
                    <div key={check.label} style={{ padding: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
                      <p className="font-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>{check.label}</p>
                      <p className="font-display" style={{ fontSize: 16, color: check.status === 'Pass' ? 'var(--success)' : 'var(--danger)' }}>{check.status}</p>
                    </div>
                  ))}
                </div>
                {result.header_security.reply_to_mismatch && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,143,171,0.1)', border: '1px solid rgba(255,143,171,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldAlert size={16} color="var(--danger)" />
                    <p style={{ fontSize: 12, color: 'var(--danger)' }}>Sender Spoofing Detected: Reply-to address does not match Sender address.</p>
                  </div>
                )}
              </div>

              {/* Body & Links Card */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                <p className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 2, marginBottom: 20 }}>BODY & LINK ANALYSIS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                         <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>PHISHING INTENT</p>
                         <p style={{ fontSize: 14, color: result.body_analysis.intent === 'Suspicious' ? 'var(--warn)' : 'var(--success)', marginTop: 4 }}>{result.body_analysis.intent}</p>
                      </div>
                      <div style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                         <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>EXTRACTED LINKS</p>
                         <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 4 }}>{result.body_analysis.link_count} found</p>
                      </div>
                   </div>
                   {result.body_analysis.links.length > 0 && (
                     <div style={{ marginTop: 10 }}>
                        <p className="font-mono" style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 10 }}>TOP LINKS DETECTED</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {result.body_analysis.links.map((link: string, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                               <Link2 size={12} color="var(--accent)" />
                               <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</span>
                            </div>
                          ))}
                        </div>
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Unified Risk Engine Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
               <div style={{ background: 'var(--card)', border: `2px solid ${getSeverityColor(result.risk_score)}30`, borderRadius: 16, padding: 28, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: getSeverityColor(result.risk_score) }} />
                  <p className="font-display" style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: 4, marginBottom: 24 }}>UNIFIED RISK ENGINE</p>
                  
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
                     <svg width="160" height="160" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                        <circle cx="50" cy="50" r="45" fill="none" stroke={getSeverityColor(result.risk_score)} strokeWidth="8" strokeDasharray={`${result.risk_score * 2.82} 282`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                     </svg>
                     <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <p className="font-display" style={{ fontSize: 32, color: getSeverityColor(result.risk_score) }}>{result.risk_score}%</p>
                        <p className="font-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>THREAT</p>
                     </div>
                  </div>

                  <div style={{ background: `${getSeverityColor(result.risk_score)}15`, borderRadius: 12, padding: '16px 20px', border: `1px solid ${getSeverityColor(result.risk_score)}30` }}>
                     <p className="font-display" style={{ fontSize: 18, color: getSeverityColor(result.risk_score), letterSpacing: 1 }}>{result.verdict}</p>
                     <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                        {result.header_security.headers_present 
                          ? `Security ${result.header_security.spf === 'Pass' ? 'verified' : 'anomalies detected'} via email headers.`
                          : 'Source identity unverified (Headers missing). Results based on content AI.'}
                        {' '}{result.attachment_scan.count > 0 ? `Found ${result.attachment_scan.count} files.` : '0 suspicious attachments.'}
                     </p>
                  </div>

               </div>

               {/* Attachment Report */}
               <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                  <p className="font-display" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 2, marginBottom: 16 }}>ATTACHMENT SCAN</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.attachment_scan.risks.length > 0 ? (
                      result.attachment_scan.risks.map((risk: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)' }}>
                           <AlertTriangle size={14} />
                           <span style={{ fontSize: 12 }}>{risk}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)' }}>
                         <CheckCircle2 size={14} />
                         <span style={{ fontSize: 12 }}>No malicious filetypes found</span>
                      </div>
                    )}
                  </div>
               </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}