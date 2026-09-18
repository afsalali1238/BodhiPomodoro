import { describe, expect, it } from 'vitest';
import { clip, fmt, hm, labelFor } from './format';

describe('fmt', () => {
  it('formats seconds as MM:SS', () => {
    expect(fmt(0)).toBe('00:00');
    expect(fmt(5)).toBe('00:05');
    expect(fmt(65)).toBe('01:05');
    expect(fmt(1500)).toBe('25:00');
  });

  it('clamps negatives and floors fractions', () => {
    expect(fmt(-3)).toBe('00:00');
    expect(fmt(59.9)).toBe('00:59');
  });
});

describe('hm', () => {
  it('formats minutes compactly', () => {
    expect(hm(0)).toBe('0m');
    expect(hm(45)).toBe('45m');
    expect(hm(60)).toBe('1h 00m');
    expect(hm(125)).toBe('2h 05m');
  });
});

describe('clip', () => {
  it('leaves short text alone', () => {
    expect(clip('hello', 10)).toBe('hello');
  });

  it('truncates with an ellipsis', () => {
    expect(clip('hello world', 6)).toBe('hello…');
  });
});

describe('labelFor', () => {
  it('covers every phase', () => {
    expect(labelFor('idle', false, 0)).toBe('Click to start');
    expect(labelFor('ready', false, 0)).toBe('Back · click to sit');
    expect(labelFor('focus', false, 125)).toBe('02:05');
    expect(labelFor('focus', true, 125)).toBe('Paused · 02:05');
    expect(labelFor('waking', false, 0)).toBe('Session complete');
    expect(labelFor('walkingOut', false, 0)).toBe('Walking out…');
    expect(labelFor('break', false, 300)).toBe('On a break · 05:00');
    expect(labelFor('break', true, 300)).toBe('Break paused · 05:00');
    expect(labelFor('returning', false, 0)).toBe('Returning…');
  });
});
