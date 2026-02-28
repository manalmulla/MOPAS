export interface HeuristicFeatures {
  url_length: number;
  hostname_length: number;
  path_length: number;
  num_dots: number;
  num_hyphens: number;
  num_underscores: number;
  num_slashes: number;
  num_at: number;
  num_question: number;
  num_equals: number;
  num_ampersand: number;
  num_percent: number;
  num_digits_url: number;
  digit_ratio: number;
  special_char_ratio: number;
  url_entropy: number;
  hostname_entropy: number;
  num_subdomains: number;
  has_ip: boolean;
  has_https: boolean;
  has_port: boolean;
  has_at_symbol: boolean;
  has_double_slash: boolean;
  has_encoded_chars: boolean;
  has_shortener: boolean;
  has_suspicious_words: boolean;
  has_common_tld: boolean;
  hyphen_in_domain: boolean;
  path_depth: number;
  query_length: number;
}

export interface HeuristicResult {
  score: number;
  features: HeuristicFeatures;
}

function calculateEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;
  const frequencies: Record<string, number> = {};
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

const SUSPICIOUS_WORDS = ['login', 'verify', 'secure', 'update', 'banking', 'account', 'signin', 'confirm', 'password', 'webscr', 'ebayisapi', 'wallet'];
const COMMON_TLDS = ['com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'uk', 'de', 'jp'];
const SHORTENERS = ['bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'is.gd', 'buff.ly', 'ow.ly'];

export function analyzeHeuristics(urlStr: string): HeuristicResult {
  let url: URL;
  try {
    url = new URL(urlStr.startsWith('http') ? urlStr : `http://${urlStr}`);
  } catch {
    return { score: 100, features: {} as any }; // Invalid URL is high risk
  }

  const hostname = url.hostname;
  const path = url.pathname;
  const query = url.search;
  const fullUrl = url.href;

  const features: HeuristicFeatures = {
    url_length: fullUrl.length,
    hostname_length: hostname.length,
    path_length: path.length,
    num_dots: (fullUrl.match(/\./g) || []).length,
    num_hyphens: (fullUrl.match(/-/g) || []).length,
    num_underscores: (fullUrl.match(/_/g) || []).length,
    num_slashes: (fullUrl.match(/\//g) || []).length,
    num_at: (fullUrl.match(/@/g) || []).length,
    num_question: (fullUrl.match(/\?/g) || []).length,
    num_equals: (fullUrl.match(/=/g) || []).length,
    num_ampersand: (fullUrl.match(/&/g) || []).length,
    num_percent: (fullUrl.match(/%/g) || []).length,
    num_digits_url: (fullUrl.match(/\d/g) || []).length,
    digit_ratio: (fullUrl.match(/\d/g) || []).length / fullUrl.length,
    special_char_ratio: (fullUrl.match(/[^a-zA-Z0-9]/g) || []).length / fullUrl.length,
    url_entropy: calculateEntropy(fullUrl),
    hostname_entropy: calculateEntropy(hostname),
    num_subdomains: hostname.split('.').length - 2,
    has_ip: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname),
    has_https: url.protocol === 'https:',
    has_port: url.port !== '',
    has_at_symbol: fullUrl.includes('@'),
    has_double_slash: fullUrl.indexOf('//', 7) !== -1,
    has_encoded_chars: /%[0-9a-fA-F]{2}/.test(fullUrl),
    has_shortener: SHORTENERS.some(s => hostname.includes(s)),
    has_suspicious_words: SUSPICIOUS_WORDS.some(w => fullUrl.toLowerCase().includes(w)),
    has_common_tld: COMMON_TLDS.some(tld => hostname.endsWith(`.${tld}`)),
    hyphen_in_domain: hostname.includes('-'),
    path_depth: path.split('/').filter(Boolean).length,
    query_length: query.length,
  };

  // Scoring Logic
  let riskScore = 0;

  if (features.url_length > 75) riskScore += 10;
  if (features.hostname_length > 30) riskScore += 5;
  if (features.num_dots > 3) riskScore += 10;
  if (features.num_hyphens > 2) riskScore += 5;
  if (features.num_at > 0) riskScore += 20;
  if (features.has_ip) riskScore += 40;
  if (!features.has_https) riskScore += 15;
  if (features.has_port) riskScore += 10;
  if (features.has_double_slash) riskScore += 20;
  if (features.has_shortener) riskScore += 15;
  if (features.has_suspicious_words) riskScore += 25;
  if (!features.has_common_tld) riskScore += 10;
  if (features.num_subdomains > 2) riskScore += 10;
  if (features.digit_ratio > 0.2) riskScore += 10;
  if (features.url_entropy > 4.5) riskScore += 10;

  return {
    score: Math.min(100, Math.max(0, riskScore)),
    features
  };
}
