// @ts-check
/**
 * @fileoverview Shared micro-helpers used by both the main process (Node/CommonJS)
 * and the renderer windows (loaded via <script src="utils.js">, exposed as
 * `window.BodhiUtils`). Isomorphic UMD pattern, same as report.js.
 *
 * These tiny functions used to be copy-pasted across pet.js, launcher.js,
 * settings.js, tasks.js, reportView.js, tray.js, state.js, and report.js —
 * this module is the single source of truth for them.
 */
(function (root) {
  /**
   * Shorthand DOM lookup. Browser-context only.
   * @param {string} id
   */
  const $ = id => document.getElementById(id);

  /**
   * Seconds → "MM:SS" clock label.
   * @param {number} s
   */
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /**
   * Minutes → human label, e.g. 85 → "1h 25m".
   * @param {number} min
   */
  const hm = min => {
    const m = Math.round(min);
    return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
  };

  /**
   * Escape a string for safe interpolation into HTML (including single
   * quotes — the old launcher-local copy missed those).
   * @param {*} s
   */
  const esc = s => String(s ?? '')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /**
   * "Write report 2p" → { title: "Write report", estimate: 2 }
   * @param {string} text
   * @returns {{title: string, estimate: number}}
   */
  const parseTask = text => {
    const m = text.match(/\s(\d{1,2})\s*(p|x|pomo|poms?|sessions?)\s*$/i);
    return m ? { title: text.slice(0, m.index).trim(), estimate: +m[1] } : { title: text.trim(), estimate: 1 };
  };

  /** Well-known focus durations (minutes) → their canonical break length. */
  const BREAK_FOR = { 15: 3, 25: 5, 50: 10, 90: 20 };

  /**
   * Break length in minutes for a given focus duration.
   * @param {number} min
   * @returns {number}
   */
  const breakFor = min => BREAK_FOR[min] || Math.max(3, Math.min(20, Math.round(min / 5)));

  const api = { $, fmt, hm, esc, parseTask, BREAK_FOR, breakFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BodhiUtils = api;
})(this);
