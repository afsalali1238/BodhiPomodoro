import { describe, expect, it } from 'vitest';
import { bodhiTree, defs, sittingBuddha, standingBuddha } from './art';

describe('art', () => {
  it('exposes shared gradient defs', () => {
    expect(defs()).toContain('id="gSkin"');
    expect(defs()).toContain('id="gRobe"');
  });

  it('renders a sitting monk with shades', () => {
    const svg = sittingBuddha();
    expect(svg).toContain('class="body"');
    expect(svg).toContain('class="shades"');
    expect(svg).toContain('class="head"');
  });

  it('renders a standing monk with limbs', () => {
    const svg = standingBuddha();
    expect(svg).toContain('walker-body');
    expect(svg).toContain('leg-front');
    expect(svg).toContain('arm-back');
  });

  it('renders all five tree stages deterministically', () => {
    const stages = [0, 1, 2, 3, 4].map((s) => bodhiTree(s));
    for (const svg of stages) {
      expect(svg).toContain('class="tree"');
      expect(svg.length).toBeGreaterThan(1000);
    }
    // Higher stages carry more leaves.
    const counts = stages.map((svg) => (svg.match(/<path d="M0,-9/g) || []).length);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
    // Same input → same output, every launch.
    expect(bodhiTree(4)).toBe(bodhiTree(4));
    // Blossoms only from stage 3.
    expect(bodhiTree(2)).not.toContain('#ffe3ee');
    expect(bodhiTree(3)).toContain('#ffe3ee');
  });
});
