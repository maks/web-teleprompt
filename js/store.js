// ── Script storage (localStorage) ──
const STORAGE_KEY = 'teleprompter_scripts';

export function loadScripts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    return [];
  }
}

export function saveScripts(scripts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

export function nextId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
