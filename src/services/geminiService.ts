import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  riskScore: number;
  threatLevel: "Low" | "Medium" | "High" | "Critical";
  summary: string;
  details: string[];
  recommendation: string;
  domainInfo?: {
    domain: string;
    isNew: boolean;
    suspiciousTld: boolean;
  };
}

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    riskScore: { type: Type.NUMBER, description: "Risk percentage from 0 to 100" },
    threatLevel: { type: Type.STRING, description: "One of: Low, Medium, High, Critical" },
    summary: { type: Type.STRING, description: "A brief summary of the findings" },
    details: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of specific indicators found"
    },
    recommendation: { type: Type.STRING, description: "What the user should do" },
    domainInfo: {
      type: Type.OBJECT,
      properties: {
        domain: { type: Type.STRING },
        isNew: { type: Type.BOOLEAN },
        suspiciousTld: { type: Type.BOOLEAN }
      }
    }
  },
  required: ["riskScore", "threatLevel", "summary", "details", "recommendation"]
};

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this URL for phishing or malicious intent: ${url}. 
    Check for:
    1. Typosquatting (e.g., g00gle.com instead of google.com)
    2. Suspicious TLDs (.xyz, .top, .pw)
    3. Obfuscated paths or subdomains
    4. Brand impersonation
    5. Lack of HTTPS or suspicious certificates (if inferred)`,
    config: {
      systemInstruction: "You are a world-class cybersecurity expert specializing in phishing detection. Provide accurate, technical yet human-readable analysis.",
      responseMimeType: "application/json",
      responseSchema: analysisSchema
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function analyzeEmail(content: string): Promise<AnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this email content for phishing, social engineering, or malicious links: \n\n${content}`,
    config: {
      systemInstruction: "You are a cybersecurity analyst. Identify social engineering tactics like urgency, fear, authority, or suspicious requests for sensitive information.",
      responseMimeType: "application/json",
      responseSchema: analysisSchema
    }
  });
  return JSON.parse(response.text || "{}");
}

export async function analyzeImage(base64Image: string): Promise<AnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: "image/png" } },
        { text: "Analyze this screenshot or image for phishing indicators. Look for fake login forms, suspicious URLs, brand impersonation, and urgency-driven UI elements." }
      ]
    },
    config: {
      systemInstruction: "You are a visual security expert. Analyze images for UI/UX patterns common in phishing sites, such as mismatched branding, suspicious input fields, and deceptive layouts.",
      responseMimeType: "application/json",
      responseSchema: analysisSchema
    }
  });
  return JSON.parse(response.text || "{}");
}
