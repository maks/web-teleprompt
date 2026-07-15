// @ts-check
// ── Script storage (localStorage) ──
const STORAGE_KEY = 'teleprompter_scripts';

/**
 * @typedef {Object} Script
 * @property {string} id        unique id from nextId()
 * @property {string} title     display title ('Untitled' if blank)
 * @property {string} content   raw markdown source
 * @property {number} createdAt epoch ms
 * @property {number} updatedAt epoch ms
 */

/** @returns {Script[]} */
export function loadScripts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    return [];
  }
}

/** @param {Script[]} scripts */
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
