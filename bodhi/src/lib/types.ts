/**
 * Shared shapes. Mirrors of the Rust structs in src-tauri/src/state.rs —
 * the backend is the source of truth, the frontend never invents state.
 */
export interface PetSnapshot {
  phase: string;
  paused: boolean;
  /** Seconds remaining in the current phase. */
  remaining: number;
  /** Total seconds of the current phase (0 when idle). */
  total: number;
  /** Bodhi tree stage, 0–4. */
  treeStage: number;
}

export interface DbHealth {
  ok: boolean;
  sessions: number;
}
