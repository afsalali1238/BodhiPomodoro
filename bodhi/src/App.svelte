<script lang="ts">
  import { onMount } from 'svelte';
  import { bodhiTree, defs, sittingBuddha } from './lib/art';
  import { labelFor } from './lib/format';
  import { initState, pet } from './lib/state';
  import { beginDrag, isTauri } from './lib/tauri';

  /** Click-vs-drag tracking (screen px). */
  let down: { x: number; y: number; moved: boolean; dragging: boolean } | null = null;
  /** Browser-preview fallback position (Tauri drags the native window). */
  let offset = $state({ x: 0, y: 0 });
  let baseOffset = { x: 0, y: 0 };
  let startClient = { x: 0, y: 0 };
  /** Click feedback pulse. */
  let clicked = $state(false);

  let stage = $derived(Math.max(0, Math.min(4, $pet.treeStage)));
  let label = $derived(labelFor($pet.phase, $pet.paused, $pet.remaining));

  onMount(() => {
    void initState();
  });

  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    down = { x: e.screenX, y: e.screenY, moved: false, dragging: false };
    startClient = { x: e.clientX, y: e.clientY };
  }

  async function onMouseMove(e: MouseEvent): Promise<void> {
    if (!down || down.dragging) return;
    if (Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y) <= 4) return;
    down.moved = true;
    if (isTauri) {
      // Hand the gesture to the OS once; it owns the drag from here.
      down.dragging = true;
      await beginDrag();
    } else {
      offset = {
        x: baseOffset.x + e.clientX - startClient.x,
        y: baseOffset.y + e.clientY - startClient.y
      };
    }
  }

  function onMouseUp(): void {
    if (!down) return;
    if (!isTauri) baseOffset = { ...offset };
    // M1+: click opens the start wizard / pauses. M0: a gentle pulse.
    if (!down.moved) {
      clicked = true;
      setTimeout(() => (clicked = false), 350);
    }
    down = null;
  }
</script>

<svelte:window
  onmousemove={onMouseMove}
  onmouseup={onMouseUp}
  oncontextmenu={(e) => e.preventDefault()}
/>

<div
  class="stage"
  style:transform={isTauri ? undefined : `translate(${offset.x}px, ${offset.y}px)`}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions: the whole pet surface
       is the native drag handle (like a window titlebar). Keyboard users get the tray
       menu + global shortcuts (M5); the pet itself is intentionally pointer-only. -->
  <svg
    id="stage"
    viewBox="0 0 240 310"
    class="idle listening"
    class:clicked
    onmousedown={onMouseDown}
    role="img"
    aria-label="Bodhi the monk pet"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- art.ts is pure local SVG, never user input -->
    {@html defs()}

    <!-- ground -->
    <ellipse cx="120" cy="258" rx="114" ry="15" fill="#5f8a34" />
    <ellipse cx="120" cy="254" rx="106" ry="11" fill="#86b24a" />
    <ellipse cx="100" cy="251" rx="70" ry="5" fill="#a6cc62" opacity=".6" />

    <!-- eslint-disable-next-line svelte/no-at-html-tags -- art.ts is pure local SVG, never user input -->
    {@html bodhiTree(stage)}

    <!-- cushion + monk -->
    <g id="cushionBase">
      <ellipse cx="150" cy="253" rx="44" ry="9" fill="#a83838" />
      <ellipse cx="150" cy="249" rx="42" ry="8" fill="#d94f4f" />
      <ellipse cx="141" cy="246.5" rx="20" ry="2.6" fill="#f07a7a" opacity=".6" />
    </g>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- art.ts is pure local SVG, never user input -->
    <g transform="translate(150,247)">{@html sittingBuddha()}</g>

    <!-- label pill -->
    <g id="pill" transform="translate(120,274)">
      <rect x="-90" y="-12" width="180" height="24" rx="12" />
      <text id="label" text-anchor="middle" dy="4">{label}</text>
    </g>

    <g id="hint" transform="translate(120,12)">
      <text text-anchor="middle">{isTauri ? 'drag me anywhere' : 'drag me (preview)'}</text>
    </g>
  </svg>
</div>

<style>
  .stage {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  svg {
    width: min(100vw, 77.4vh);
    height: auto;
    max-height: 100vh;
    display: block;
    cursor: grab;
  }
  svg:active {
    cursor: grabbing;
  }
  text {
    font-family: 'Segoe UI', system-ui, sans-serif;
  }

  /* M0 click feedback: a soft scale pulse on the whole scene. */
  svg.clicked {
    animation: pulse 0.35s ease-out 1;
    transform-box: fill-box;
    transform-origin: 50% 80%;
  }
  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.025);
    }
    100% {
      transform: scale(1);
    }
  }

  #pill rect {
    fill: rgba(28, 24, 20, 0.86);
    stroke: rgba(245, 154, 60, 0.7);
    stroke-width: 1;
  }
  #label {
    fill: #fff;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  #hint {
    opacity: 0;
    transition: opacity 0.3s;
  }
  svg:hover #hint {
    opacity: 1;
  }
  #hint text {
    fill: #fff;
    font-size: 8.5px;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.65);
    stroke-width: 2.5px;
  }

  @media (prefers-reduced-motion: reduce) {
    svg.clicked {
      animation: none;
    }
  }
</style>
