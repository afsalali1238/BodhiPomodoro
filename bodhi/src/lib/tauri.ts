/**
 * Tauri bridge with graceful browser fallbacks.
 * Every helper is safe to call from plain `vite dev` (and the sandbox
 * preview): outside the Tauri shell they return mocks instead of crashing.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DbHealth, PetSnapshot } from './types';

export const STATE_EVENT = 'bodhi://state';

/** True when running inside the Tauri shell. */
export const isTauri =
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

const mockState: PetSnapshot = {
  phase: 'idle',
  paused: false,
  remaining: 0,
  total: 0,
  treeStage: 0
};

export async function fetchState(): Promise<PetSnapshot> {
  if (!isTauri) return { ...mockState };
  return invoke<PetSnapshot>('get_state');
}

export async function fetchDbHealth(): Promise<DbHealth> {
  if (!isTauri) return { ok: true, sessions: 0 };
  return invoke<DbHealth>('db_health');
}

export async function onState(cb: (snapshot: PetSnapshot) => void): Promise<UnlistenFn> {
  if (!isTauri) return () => {};
  return listen<PetSnapshot>(STATE_EVENT, (event) => cb(event.payload));
}

/** Starts a native window drag. Returns false outside Tauri. */
export async function beginDrag(): Promise<boolean> {
  if (!isTauri) return false;
  await getCurrentWindow().startDragging();
  return true;
}
