/** Pure display helpers. No DOM, no Tauri — fully unit-tested. */

/** Seconds → "MM:SS". */
export function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Minutes → "45m" | "1h 05m". */
export function hm(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** Truncate with an ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Phase → pet pill label. Single source for the text under the monk. */
export function labelFor(phase: string, paused: boolean, remaining: number): string {
  switch (phase) {
    case 'idle':
      return 'Click to start';
    case 'ready':
      return 'Back · click to sit';
    case 'focus':
      return paused ? `Paused · ${fmt(remaining)}` : fmt(remaining);
    case 'waking':
      return 'Session complete';
    case 'walkingOut':
      return 'Walking out…';
    case 'break':
      return paused ? `Break paused · ${fmt(remaining)}` : `On a break · ${fmt(remaining)}`;
    case 'returning':
      return 'Returning…';
    default:
      return '…';
  }
}
