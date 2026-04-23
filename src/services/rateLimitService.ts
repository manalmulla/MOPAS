interface SearchHistory {
  timestamps: number[];
}

const STORAGE_KEY = 'mopas_search_history';
const LIMIT = 5;
const WINDOW_MS = 2 * 60 * 1000; // 2 minutes (Changed from 2 hours as per user request)

export const getRemainingSearches = (): number => {
  const historyStr = localStorage.getItem(STORAGE_KEY);
  if (!historyStr) return LIMIT;

  const history: SearchHistory = JSON.parse(historyStr);
  const now = Date.now();
  
  // Clean up old timestamps
  const recentTimestamps = history.timestamps.filter(t => now - t < WINDOW_MS);
  
  return Math.max(0, LIMIT - recentTimestamps.length);
};

export const canSearch = (): boolean => {
  return getRemainingSearches() > 0;
};

export const recordSearch = () => {
  const historyStr = localStorage.getItem(STORAGE_KEY);
  let history: SearchHistory = historyStr ? JSON.parse(historyStr) : { timestamps: [] };
  
  const now = Date.now();
  history.timestamps.push(now);
  
  // Clean up while saving
  history.timestamps = history.timestamps.filter(t => now - t < WINDOW_MS);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

export const getMsUntilNextSearch = (): number => {
  const historyStr = localStorage.getItem(STORAGE_KEY);
  if (!historyStr) return 0;

  const history: SearchHistory = JSON.parse(historyStr);
  const now = Date.now();
  const recentTimestamps = history.timestamps.filter(t => now - t < WINDOW_MS);
  
  if (recentTimestamps.length < LIMIT) return 0;

  const oldestRecent = Math.min(...recentTimestamps);
  return WINDOW_MS - (now - oldestRecent);
};
