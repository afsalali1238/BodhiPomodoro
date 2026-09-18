/**
 * Frontend mirror of backend state. Fed by `get_state` once, then kept live
 * by the `bodhi://state` event stream. Never mutated directly by UI code —
 * all changes go through backend commands (M1+).
 */
import { writable } from 'svelte/store';
import type { PetSnapshot } from './types';
import { fetchDbHealth, fetchState, onState } from './tauri';

export const pet = writable<PetSnapshot>({
  phase: 'idle',
  paused: false,
  remaining: 0,
  total: 0,
  treeStage: 0
});

/** Lifetime committed sessions (null until the first health check lands). */
export const dbSessions = writable<number | null>(null);

let started = false;

/** One-time wiring. Safe to call repeatedly. */
export async function initState(): Promise<void> {
  if (started) return;
  started = true;
  pet.set(await fetchState());
  void onState((snapshot) => pet.set(snapshot));
  const health = await fetchDbHealth();
  if (health.ok) dbSessions.set(health.sessions);
}
