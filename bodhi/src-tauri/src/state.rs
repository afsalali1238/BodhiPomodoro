//! Application state. The backend is the source of truth; the Svelte pet
//! is a pure renderer fed by the `bodhi://state` event stream.
//! M1 grows this into the full phase machine + timer loop.

use serde::Serialize;

/// Focus phases. M0 only ever emits `Idle`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Idle,
}

/// What the frontend renders. Field names serialize camelCase to match TS.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetSnapshot {
    pub phase: Phase,
    pub paused: bool,
    /// Seconds remaining in the current phase.
    pub remaining: u64,
    /// Total seconds of the current phase (0 when idle).
    pub total: u64,
    /// Bodhi tree stage, 0–4.
    pub tree_stage: u8,
}

impl Default for PetSnapshot {
    fn default() -> Self {
        Self {
            phase: Phase::Idle,
            paused: false,
            remaining: 0,
            total: 0,
            tree_stage: 0,
        }
    }
}

/// Mutable backend state behind a `Mutex` managed by Tauri.
#[derive(Debug, Default)]
pub struct AppState {
    snapshot: PetSnapshot,
}

impl AppState {
    pub fn snapshot(&self) -> PetSnapshot {
        self.snapshot.clone()
    }
}

/// Database connectivity probe (also powers the lifetime-sessions count).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbHealth {
    pub ok: bool,
    pub sessions: i64,
}
