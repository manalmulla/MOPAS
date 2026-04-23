from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import whois
import dns.resolver
import requests
from datetime import datetime
import os
from typing import List, Optional
from dotenv import load_dotenv
import re
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

load_dotenv()



# Load Random Forest Model
import joblib
rf_model = None
if os.path.exists("backend/models/url_model.pkl"):
    print("Loading Random Forest model...")
    rf_model = joblib.load("backend/models/url_model.pkl")
    print("RF Model loaded successfully.")

# High-Reputation Whitelist to prevent False Positives (e.g. YouTube, Google)
TRUSTED_DOMAINS = [
    'google.com', 'youtube.com', 'facebook.com', 'microsoft.com', 'apple.com',
    'github.com', 'linkedin.com', 'netflix.com', 'twitter.com', 'amazon.com',
    'wikipedia.org', 'instagram.com', 'spotify.com', 'adobe.com', 'zoom.us'
]

import tldextract

def is_trusted_domain(url):
    try:
        ext = tldextract.extract(url)
        domain = f"{ext.domain}.{ext.suffix}"
        return domain in TRUSTED_DOMAINS
    except:
        return False


# Feature Extraction helper (must match train_model.py)
import math
from urllib.parse import urlparse

def calculate_entropy(text):
    if not text: return 0
    probabilities = [float(text.count(c)) / len(text) for c in set(text)]
    return - sum([p * math.log2(p) for p in probabilities])

def extract_rf_features(url_str):
    try:
        if not isinstance(url_str, str): url_str = str(url_str)
        if not url_str.startswith('http'):
            url_str = 'http://' + url_str
        parsed = urlparse(url_str)
        hostname = parsed.hostname or ''
        path = parsed.path or ''
        query = parsed.query or ''
        
        features = [
            len(url_str), len(hostname), len(path), url_str.count('.'), url_str.count('-'),
            url_str.count('_'), url_str.count('/'), url_str.count('@'), url_str.count('?'), url_str.count('='),
            url_str.count('&'), url_str.count('%'), sum(c.isdigit() for c in url_str),
            sum(c.isdigit() for c in url_str) / len(url_str) if len(url_str) > 0 else 0,
            len(re.findall(r'[^a-zA-Z0-9]', url_str)) / len(url_str) if len(url_str) > 0 else 0,
            calculate_entropy(url_str), calculate_entropy(hostname), max(0, hostname.count('.') - 1),
            1 if re.match(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$', hostname) else 0,
            1 if url_str.startswith('https') else 0,
            1 if any(s in hostname for s in ['bit.ly', 'goo.gl', 't.co', 'tinyurl.com']) else 0,
            1 if any(w in url_str.lower() for w in ['login', 'verify', 'secure', 'update', 'banking', 'account', 'signin', 'confirm', 'password']) else 0,
            len([p for p in path.split('/') if p]), len(query)
        ]
        return np.array(features).reshape(1, -1)
    except:
        return np.zeros((1, 24))




app = FastAPI(title="MOPAS Advanced Security API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    url: str

class RedirectNode(BaseModel):
    url: str
    status: int

class DomainIntel(BaseModel):
    creation_date: Optional[str]
    registrar: Optional[str]
    age_days: Optional[int]
    dns_records: dict
    is_suspicious: bool

@app.post("/analyze/url")
async def analyze_url(request: AnalysisRequest):
    url = request.url
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    results = {
        "url": url,
        "redirect_chain": [],
        "domain_intel": {},
        "external_threats": {},
        "ml_nlp_score": 0.5
    }

    # 1. Dynamic Analysis: Follow Redirects
    try:
        session = requests.Session()
        response = session.get(url, allow_redirects=True, timeout=5)
        for resp in response.history:
            results["redirect_chain"].append({"url": resp.url, "status": resp.status_code})
        results["redirect_chain"].append({"url": response.url, "status": response.status_code})
        final_url = response.url
    except Exception as e:
        final_url = url
        results["redirect_chain"].append({"error": str(e)})

    # 2. Domain Intelligence
    try:
        # Extract base domain (e.g. subdomain.domain.com -> domain.com)
        import tldextract
        ext = tldextract.extract(final_url)
        base_domain = f"{ext.domain}.{ext.suffix}"
        
        w = whois.whois(base_domain)
        creation_date = w.creation_date
        
        # creation_date can be: None, datetime, list[datetime], or string
        if isinstance(creation_date, list):
            creation_date = creation_date[0]
        
        # Some WHOIS servers return strings
        if isinstance(creation_date, str):
            try:
                creation_date = datetime.fromisoformat(creation_date.replace('Z', '+00:00'))
            except:
                creation_date = None
        
        age_days = None
        if isinstance(creation_date, datetime):
            age_days = (datetime.now() - creation_date).days
            
        results["domain_intel"] = {
            "creation_date": creation_date.isoformat() if creation_date and isinstance(creation_date, datetime) else None,
            "registrar": w.registrar if hasattr(w, 'registrar') else "Unknown",
            "age_days": age_days,
            "is_new_domain": age_days < 90 if age_days is not None else False # 90 days is safer
        }
    except Exception as e:
        results["domain_intel"] = {"error": f"WHOIS lookup failed: {str(e)}", "age_days": None, "registrar": "N/A", "is_new_domain": False}


    # 3. DNS Anomalies
    dns_info = {}
    try:
        for r_type in ['A', 'MX', 'NS', 'TXT']:
            try:
                answers = dns.resolver.resolve(domain, r_type)
                dns_info[r_type] = [str(rdata) for rdata in answers]
            except:
                dns_info[r_type] = []
        results["dns_info"] = dns_info
    except:
        results["dns_info"] = {"error": "DNS lookup failed"}

    # 4. BERT/NLP Prediction (Removed)
    results["ml_nlp_score"] = 0.0


    # 5. Random Forest Prediction (New)
    try:
        if is_trusted_domain(url):
            results["ml_rf_score"] = 0.01 # Force low risk for high-reputation sites
        elif rf_model:
            features = extract_rf_features(url)
            rf_prob = rf_model.predict_proba(features)[0][1] # Probability of phishing
            results["ml_rf_score"] = float(rf_prob)
        else:
            results["ml_rf_score"] = 0.5
    except Exception as e:
        results["ml_rf_score_error"] = str(e)



    # 5. External Intelligence: VirusTotal
    vt_key = os.getenv("VIRUSTOTAL_API_KEY")
    if vt_key:
        try:
            vt_url = f"https://www.virustotal.com/api/v3/urls/{requests.utils.quote(url, safe='')}"
            headers = {"x-apikey": vt_key}
            vt_resp = requests.get(vt_url, headers=headers)
            if vt_resp.status_code == 200:
                stats = vt_resp.json()["data"]["attributes"]["last_analysis_stats"]
                results["external_threats"]["virustotal"] = {
                    "malicious": stats["malicious"],
                    "suspicious": stats["suspicious"],
                    "harmless": stats["harmless"]
                }
        except:
            pass

    return results

import mailparser
import re

def perform_text_analysis(content: str):
    # 1. NLP Intent Classification
    try:
        inputs = text_tokenizer(content, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = text_model(**inputs)
            scores = torch.nn.functional.softmax(outputs.logits, dim=1)
            risk_score = float(scores[0][1].item())
            confidence = float(torch.max(scores).item())
    except Exception as e:
        print(f"NLP Error: {e}")
        risk_score = 0.5
        confidence = 0.0

    # 2. Heuristic Pattern Analysis
    patterns = {
        "Urgency": [r"immediate", r"urgent", r"action required", r"within 24 hours", r"suspended", r"final notice"],
        "Threat Tone": [r"legal action", r"blocked", r"police", r"penalty", r"fine", r"court"],
        "Fake Authority": [r"official", r"department", r"government", r"bank", r"security team", r"support"],
        "OTP/Password Request": [r"otp", r"password", r"one-time password", r"verification code", r"pin"],
        "Payment Scam": [r"unpaid", r"invoice", r"refund", r"prize", r"won", r"gift card", r"claim"],
        "Grammar Anomalies": [r"[A-Z]{3,}", r"\!{2,}", r"\?{2,}", r"\$\$\$"]
    }

    found_indicators = []
    suspicious_phrases = []

    for category, keywords in patterns.items():
        found_in_cat = []
        for kw in keywords:
            matches = re.findall(kw, content.lower())
            if matches:
                found_in_cat.append(kw)
                suspicious_phrases.extend(matches)
        if found_in_cat:
            found_indicators.append(category)

    if found_indicators:
        risk_score = min(0.99, risk_score + (len(found_indicators) * 0.1))

    return {
        "risk_score": risk_score,
        "confidence": confidence,
        "indicators": found_indicators,
        "highlights": list(set(suspicious_phrases))
    }

class TextAnalysisRequest(BaseModel):
    text: str

class EmailAnalysisRequest(BaseModel):
    raw_email: Optional[str] = None
    file_content: Optional[str] = None # Base64 for .eml files


@app.post("/analyze/text")
async def analyze_text(request: TextAnalysisRequest):
    res = perform_text_analysis(request.text)
    intent = "Suspicious/Phishing" if res["risk_score"] > 0.6 else "Likely Safe"
    if res["risk_score"] > 0.85: intent = "Highly Malicious"
    
    return {
        **res,
        "intent": intent,
        "summary": f"Detected {len(res['indicators'])} risk patterns: {', '.join(res['indicators'])}." if res["indicators"] else "No explicit phishing patterns found via heuristics."
    }

@app.post("/analyze/email")
async def analyze_email(request: EmailAnalysisRequest):
    raw_content = ""
    if request.raw_email:
        raw_content = request.raw_email
    elif request.file_content:
        import base64
        raw_content = base64.b64decode(request.file_content).decode('utf-8', errors='ignore')
    
    if not raw_content:
        raise HTTPException(status_code=400, detail="No email content provided")

    mail = mailparser.parse_from_string(raw_content)
    
    # 1. Header Security Analysis
    headers = mail.headers
    from_addr = mail.from_
    reply_to = mail.reply_to
    
    sender_domain = ""
    if from_addr:
        sender_domain = from_addr[0][1].split('@')[-1]
    
    # Check if headers actually exist in the paste
    headers_present = 'Authentication-Results' in headers or 'Received' in headers
    
    spf_pass = 'spf=pass' in str(headers).lower()
    dkim_pass = 'dkim=pass' in str(headers).lower()
    dmarc_pass = 'dmarc=pass' in str(headers).lower()

    # If headers are missing, perform a LIVE DNS check on the sender's domain
    live_dns_risk = 0.0
    if not headers_present and sender_domain:
        try:
            # Check if domain has SPF/DMARC records at all
            check_res = checkdmarc.check_domains([sender_domain])
            spf_present = 'spf' in check_res and not check_res['spf'].get('error')
            dmarc_present = 'dmarc' in check_res and not check_res['dmarc'].get('error')
            
            if not spf_present or not dmarc_present:
                live_dns_risk = 0.4 # Higher risk if domain lacks basic security
        except:
            pass

    sender_spoofing_score = 0
    if from_addr and reply_to:
        if from_addr[0][1].lower() != reply_to[0][1].lower():
            sender_spoofing_score = 0.8

    # 2. AI Body Analysis (Unified Logic)
    body_analysis = perform_text_analysis(mail.body)
    links = re.findall(r'https?://[^\s<>"]+|www\.[^\s<>"]+', mail.body)

    # 3. Attachment Scan
    attachments = mail.attachments
    attachment_risks = []
    for att in attachments:
        filename = att.get('filename', '').lower()
        if filename.endswith(('.exe', '.js', '.vbs', '.scr', '.vbe', '.cmd')):
            attachment_risks.append(f"Malicious Script ({filename})")
        elif filename.endswith(('.docm', '.xlsm', '.pptm')):
            attachment_risks.append(f"Macro Lure ({filename})")

    # 4. Balanced Risk Calculation (Revised for Accuracy)
    # Start with AI Body Risk
    final_risk = body_analysis["risk_score"] * 0.4
    
    # Add Technical Risks
    tech_risk = 0.0
    if headers_present:
        if not spf_pass: tech_risk += 0.2
        if not dkim_pass: tech_risk += 0.2
        if not dmarc_pass: tech_risk += 0.2
    else:
        # If headers missing, use live DNS risk + baseline for 'Unverified'
        tech_risk += (live_dns_risk + 0.15) 
        
    if sender_spoofing_score > 0.5: tech_risk += 0.4
    
    final_risk += (tech_risk * 0.6)

    
    # Critical penalty for malicious attachments
    if attachment_risks:
        final_risk = max(0.85, final_risk + 0.3)

    risk_score_int = int(min(1.0, final_risk) * 100)
    
    return {
        "header_security": {
            "spf": "Pass" if spf_pass else ("Fail" if headers_present else "Unknown"),
            "dkim": "Pass" if dkim_pass else ("Fail" if headers_present else "Unknown"),
            "dmarc": "Pass" if dmarc_pass else ("Fail" if headers_present else "Unknown"),
            "headers_present": headers_present,
            "sender_spoofing": sender_spoofing_score,
            "reply_to_mismatch": sender_spoofing_score > 0.5
        },
        "body_analysis": {
            "intent": "Suspicious" if body_analysis["risk_score"] > 0.6 else "Safe",
            "indicators": body_analysis["indicators"],
            "link_count": len(links),
            "links": links[:10]
        },
        "attachment_scan": {
            "count": len(attachments),
            "risks": attachment_risks
        },
        "risk_score": risk_score_int,
        "verdict": "MALICIOUS" if risk_score_int > 75 else "SUSPICIOUS" if risk_score_int > 40 else "SAFE"
    }


@app.post("/analyze/email-domain")
async def analyze_email_domain(request: AnalysisRequest):

    domain = request.url.split('@')[-1]
    results = {"domain": domain, "security": {}, "threat_intel": {}}
    
    # 1. DMARC/SPF
    try:
        results["security"] = checkdmarc.check_domains([domain])
    except:
        results["security"] = {"error": "Authentication check failed"}
        
    # 2. VirusTotal Domain Check
    vt_key = os.getenv("VIRUSTOTAL_API_KEY")
    if vt_key:
        try:
            vt_url = f"https://www.virustotal.com/api/v3/domains/{domain}"
            headers = {"x-apikey": vt_key}
            vt_resp = requests.get(vt_url, headers=headers)
            if vt_resp.status_code == 200:
                results["threat_intel"]["virustotal"] = vt_resp.json()["data"]["attributes"]["last_analysis_stats"]
        except:
            pass
            
import checkdmarc

# Load specialized text phishing classifier

print("Loading Text Phishing NLP model...")
# Using a lightweight but effective BERT model for spam/phishing detection
text_tokenizer = AutoTokenizer.from_pretrained("mrm8488/bert-tiny-finetuned-sms-spam-detection")
text_model = AutoModelForSequenceClassification.from_pretrained("mrm8488/bert-tiny-finetuned-sms-spam-detection")
print("Text NLP model loaded.")

class TextAnalysisRequest(BaseModel):
    text: str

@app.post("/analyze/text")
async def analyze_text(request: TextAnalysisRequest):
    content = request.text
    if not content:
        raise HTTPException(status_code=400, detail="No text provided")
    
    # 1. NLP Intent Classification
    try:
        inputs = text_tokenizer(content, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = text_model(**inputs)
            scores = torch.nn.functional.softmax(outputs.logits, dim=1)
            # Label 0: ham, Label 1: spam/phishing (depends on model mapping)
            # For this specific model: Label 0 is HAM, Label 1 is SPAM
            risk_score = float(scores[0][1].item())
            confidence = float(torch.max(scores).item())
    except Exception as e:
        print(f"NLP Error: {e}")
        risk_score = 0.5
        confidence = 0.0

    # 2. Heuristic Pattern Analysis
    patterns = {
        "Urgency": [r"immediate", r"urgent", r"action required", r"within 24 hours", r"suspended", r"final notice"],
        "Threat Tone": [r"legal action", r"blocked", r"police", r"penalty", r"fine", r"court"],
        "Fake Authority": [r"official", r"department", r"government", r"bank", r"security team", r"support"],
        "OTP/Password Request": [r"otp", r"password", r"one-time password", r"verification code", r"pin"],
        "Payment Scam": [r"unpaid", r"invoice", r"refund", r"prize", r"won", r"gift card", r"claim"],
        "Grammar Anomalies": [r"[A-Z]{3,}", r"\!{2,}", r"\?{2,}", r"\$\$\$"]
    }

    found_indicators = []
    suspicious_phrases = []

    for category, keywords in patterns.items():
        found_in_cat = []
        for kw in keywords:
            matches = re.findall(kw, content.lower())
            if matches:
                found_in_cat.append(kw)
                suspicious_phrases.extend(matches)
        if found_in_cat:
            found_indicators.append(category)

    # 3. Final Decision
    # Boost risk if heuristics found
    if found_indicators:
        risk_score = min(0.99, risk_score + (len(found_indicators) * 0.1))

    intent = "Suspicious/Phishing" if risk_score > 0.6 else "Likely Safe"
    if risk_score > 0.85: intent = "Highly Malicious"

    return {
        "risk_score": risk_score,
        "confidence": confidence,
        "intent": intent,
        "indicators": found_indicators,
        "highlights": list(set(suspicious_phrases)),
        "summary": f"Detected {len(found_indicators)} risk patterns: {', '.join(found_indicators)}." if found_indicators else "No explicit phishing patterns found via heuristics."
    }

if __name__ == "__main__":


    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
