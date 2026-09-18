/**
 * Procedural vector artwork: soft-3D shaded Bodhi tree, sitting + walking monk.
 * Zero image assets — everything is generated SVG. All figures are
 * origin-anchored bottom-center for breathe/walk transforms.
 */

const C = {
  skin: '#fbf3ea',
  skinMid: '#efdccb',
  skinDk: '#d9bfa8',
  line: '#6b4a3a',
  robe: '#f59a3c',
  robeMid: '#e67e22',
  robeDk: '#b85a14',
  hair: '#2b211d',
  hairHi: '#4a3b34',
  lens: '#141414'
} as const;

/** Shared gradient defs — inject once per SVG root. */
export function defs(): string {
  return `
  <defs>
    <radialGradient id="gSkin" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="${C.skin}"/><stop offset="1" stop-color="${C.skinDk}"/>
    </radialGradient>
    <linearGradient id="gSkinL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.skinDk}"/><stop offset=".45" stop-color="${C.skin}"/><stop offset="1" stop-color="${C.skinMid}"/>
    </linearGradient>
    <linearGradient id="gRobe" x1="0" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="#ffb35c"/><stop offset=".5" stop-color="${C.robe}"/><stop offset="1" stop-color="${C.robeMid}"/>
    </linearGradient>
    <linearGradient id="gRobeDk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.robeMid}"/><stop offset="1" stop-color="${C.robeDk}"/>
    </linearGradient>
    <radialGradient id="gHair" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="${C.hairHi}"/><stop offset="1" stop-color="${C.hair}"/>
    </radialGradient>
    <linearGradient id="gLens" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3d3d3d"/><stop offset=".45" stop-color="${C.lens}"/><stop offset="1" stop-color="#000"/>
    </linearGradient>
    <radialGradient id="gShadow"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="gLeaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8fd16a"/><stop offset="1" stop-color="#2e7d32"/>
    </linearGradient>
    <linearGradient id="gTrunk" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4e3526"/><stop offset=".45" stop-color="#8a6247"/><stop offset="1" stop-color="#5a3d2b"/>
    </linearGradient>
  </defs>`;
}

/** Head centred at (0, hy). */
function head(hy: number): string {
  const dots = [-9, -5, -1, 3, 7, -7, -3, 1, 5]
    .map((x, i) => `<circle cx="${x + (i > 4 ? 1 : 0)}" cy="${hy - (i > 4 ? 17 : 13.5)}" r="1.3"/>`)
    .join('');
  return `
  <g class="head">
    <path d="M-5,${hy + 10} L-5,${hy + 19} Q0,${hy + 22} 5,${hy + 19} L5,${hy + 10} Z" fill="${C.skinMid}"/>
    <path d="M-13.5,${hy - 4} C-17.5,${hy - 4} -17.5,${hy + 8} -14.2,${hy + 10.5} C-12.5,${hy + 13} -12,${hy + 6} -12.5,${hy + 1} Z" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".6"/>
    <path d="M13.5,${hy - 4} C17.5,${hy - 4} 17.5,${hy + 8} 14.2,${hy + 10.5} C12.5,${hy + 13} 12,${hy + 6} 12.5,${hy + 1} Z" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".6"/>
    <ellipse cx="0" cy="${hy}" rx="13.8" ry="15.2" fill="url(#gSkin)"/>
    <path d="M-14,${hy - 3} C-15,${hy - 17} -7,${hy - 21} 0,${hy - 21} C7,${hy - 21} 15,${hy - 17} 14,${hy - 3} C10,${hy - 9} 4,${hy - 10} 0,${hy - 10} C-4,${hy - 10} -10,${hy - 9} -14,${hy - 3} Z" fill="url(#gHair)"/>
    <g fill="${C.hairHi}" opacity=".55">${dots}</g>
    <ellipse cx="0" cy="${hy - 24}" rx="7" ry="6" fill="url(#gHair)"/>
    <ellipse cx="0" cy="${hy - 30.5}" rx="3.2" ry="3" fill="url(#gHair)"/>
    <ellipse cx="-2" cy="${hy - 26}" rx="2.2" ry="1.4" fill="#fff" opacity=".12"/>
    <g class="eyes-closed" opacity="0">
      <path d="M-9.5,${hy + 1.5} q3,2.2 6,0 M3.5,${hy + 1.5} q3,2.2 6,0" stroke="${C.line}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    </g>
    <g class="shades">
      <path d="M-13,${hy - 1.5} L13,${hy - 1.5}" stroke="#0d0d0d" stroke-width="1.6"/>
      <rect x="-12.2" y="${hy - 2}" width="10.4" height="6.6" rx="2.6" fill="url(#gLens)"/>
      <rect x="1.8" y="${hy - 2}" width="10.4" height="6.6" rx="2.6" fill="url(#gLens)"/>
      <path class="lens-glint" d="M-10.5,${hy + 2.5} L-7,${hy - 0.8} M3.5,${hy + 2.5} L7,${hy - 0.8}" stroke="#fff" stroke-width="1" opacity=".55" stroke-linecap="round"/>
    </g>
    <path d="M0,${hy + 3} q-1.2,3 .2,4.6" stroke="${C.skinDk}" stroke-width=".9" fill="none" stroke-linecap="round"/>
    <path d="M-3.2,${hy + 10} q3.2,1.3 6.4,0" stroke="${C.line}" stroke-width="1" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="${hy + 14.2}" rx="6" ry="1.2" fill="${C.skinDk}" opacity=".35"/>
  </g>`;
}

/** Raised hand (palm out, fingers up) centred at (x, y). */
function raisedHand(x: number, y: number): string {
  return `
  <g transform="translate(${x},${y})">
    <rect x="-3.4" y="-11" width="2.3" height="8" rx="1.15" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".4"/>
    <rect x="-1" y="-12.2" width="2.3" height="9" rx="1.15" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".4"/>
    <rect x="1.4" y="-11.4" width="2.3" height="8.4" rx="1.15" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".4"/>
    <rect x="3.7" y="-9.4" width="2.1" height="6.8" rx="1.05" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".4"/>
    <path d="M-4.2,-4 C-4.6,2 -3,5 .5,5.5 C4,5.5 5.8,2 5.8,-4 Z" fill="url(#gSkin)" stroke="${C.skinDk}" stroke-width=".4"/>
    <path d="M-4,-1 C-7,-3 -8,-6 -7,-7.5 C-5.5,-8 -4,-5.5 -3,-3.5 Z" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".4"/>
    <path d="M-1,0 q1.5,1.2 3.5,.2" stroke="${C.skinDk}" stroke-width=".5" fill="none"/>
  </g>`;
}

/** Resting hand in the lap, palm up, centred at (x, y). */
function lapHand(x: number, y: number): string {
  return `
  <g transform="translate(${x},${y})">
    <path d="M-9,1 C-9,-3.5 -3,-4.5 3,-4 C7,-3.6 10,-1.5 9.5,1 C9,3.5 3,4.2 -2,4 C-6,3.8 -9,3 -9,1 Z" fill="url(#gSkin)" stroke="${C.skinDk}" stroke-width=".5"/>
    <path d="M-7,-2.4 C-9,-5.5 -6,-7 -3.5,-4.5" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".5"/>
    <path d="M1,-1.2 q3,.8 6,-.2 M0,1 q3.5,.9 7,0" stroke="${C.skinDk}" stroke-width=".45" fill="none"/>
  </g>`;
}

export function sittingBuddha(): string {
  return `
  <g class="body">
    <ellipse cx="0" cy="-1" rx="56" ry="8" fill="url(#gShadow)"/>
    <path d="M-48,-5 C-52,-20 -34,-31 -6,-30 C24,-31 52,-22 48,-5 C30,2 -30,2 -48,-5 Z" fill="url(#gRobeDk)"/>
    <path d="M-44,-9 C-38,-22 -14,-25 6,-23 C26,-22 42,-17 44,-9" fill="none" stroke="#ffb35c" stroke-width="1.4" opacity=".5"/>
    <path d="M-10,-6 C0,-14 16,-16 30,-12 M-30,-8 C-20,-16 -6,-18 4,-16" stroke="${C.robeDk}" stroke-width="1" fill="none" opacity=".6"/>
    <path d="M-44,-11 C-36,-19 -14,-20 -2,-16 C0,-12 -4,-8 -10,-8 C-22,-8 -36,-6 -44,-11 Z" fill="url(#gSkinL)" stroke="${C.skinDk}" stroke-width=".5"/>
    <ellipse cx="-44" cy="-12" rx="7" ry="4.2" fill="url(#gSkin)" stroke="${C.skinDk}" stroke-width=".5"/>
    <path d="M22,-19 C30,-23 40,-21 42,-15 C40,-11 30,-11 22,-13 Z" fill="url(#gSkin)" stroke="${C.skinDk}" stroke-width=".5"/>
    <path d="M-23,-26 C-28,-46 -24,-64 -8,-68 L8,-68 C24,-64 28,-46 23,-26 Z" fill="url(#gSkin)"/>
    <path d="M-12,-54 q5,3 9,1 M3,-53 q4,2 8,-1" stroke="${C.skinDk}" stroke-width=".7" fill="none" opacity=".7"/>
    <path d="M-6,-68 C6,-70 22,-66 27,-52 C30,-40 28,-30 25,-26 L2,-26 C2,-38 -2,-52 -12,-62 Z" fill="url(#gRobe)"/>
    <path d="M-2,-62 C8,-54 14,-42 14,-27 M6,-66 C16,-58 22,-46 22,-28" stroke="${C.robeMid}" stroke-width="1.1" fill="none" opacity=".8"/>
    <path d="M-6,-68 C4,-58 8,-44 6,-26" stroke="#ffc680" stroke-width="1.2" fill="none" opacity=".7"/>
    <path d="M22,-60 C30,-52 31,-40 26,-32 C22,-28 14,-28 8,-28" stroke="url(#gRobeDk)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M24,-58 C30,-50 30,-42 27,-35" stroke="#ffb35c" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>
    ${lapHand(2, -28)}
    <g class="arm-lap" opacity="0">
      <path d="M-19,-62 C-28,-54 -29,-40 -22,-32 C-18,-28 -12,-28 -6,-29" stroke="${C.skinDk}" stroke-width="9.5" fill="none" stroke-linecap="round"/>
      <path d="M-19,-62 C-28,-54 -29,-40 -22,-32 C-18,-28 -12,-28 -6,-29" stroke="url(#gSkinL)" stroke-width="8" fill="none" stroke-linecap="round"/>
      ${lapHand(-1, -31)}
    </g>
    <g class="book" opacity="0">
      <rect x="-10" y="-20" width="20" height="14" rx="2" fill="#c89b6a" stroke="${C.skinDk}" stroke-width=".6"/>
      <rect x="-8" y="-18" width="16" height="10" fill="#fbf3ea"/>
      <line x1="-8" y1="-14" x2="8" y2="-14" stroke="${C.skinDk}" stroke-width=".5" opacity=".4"/>
      <line x1="-8" y1="-11" x2="8" y2="-11" stroke="${C.skinDk}" stroke-width=".5" opacity=".4"/>
    </g>
    <g class="headphones" opacity="0">
      <ellipse cx="0" cy="-55" rx="14" ry="4" fill="${C.skinDk}"/>
      <rect x="-18" y="-48" width="4" height="12" fill="${C.skinDk}"/>
      <rect x="14" y="-48" width="4" height="12" fill="${C.skinDk}"/>
      <ellipse cx="-18" cy="-38" rx="6" ry="8" fill="#2b211d" stroke="${C.skinDk}" stroke-width=".6"/>
      <ellipse cx="18" cy="-38" rx="6" ry="8" fill="#2b211d" stroke="${C.skinDk}" stroke-width=".6"/>
    </g>
    <g class="arm-raised">
      <path d="M-19,-62 C-27,-56 -31,-44 -27,-38 C-24,-34 -20,-40 -17,-48" stroke="${C.skinDk}" stroke-width="9.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-19,-62 C-27,-56 -31,-44 -27,-38 C-24,-34 -20,-40 -17,-48" stroke="url(#gSkinL)" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${raisedHand(-15, -50)}
    </g>
    ${head(-83)}
  </g>`;
}

export function standingBuddha(): string {
  return `
  <g class="walker-body">
    <ellipse cx="0" cy="-1" rx="26" ry="5" fill="url(#gShadow)"/>
    <g class="leg leg-back"><path d="M1,-34 L4,-6" stroke="${C.skinDk}" stroke-width="7" stroke-linecap="round"/><ellipse cx="6" cy="-4" rx="6.5" ry="3" fill="${C.skinDk}"/></g>
    <g class="arm arm-back"><path d="M13,-80 C18,-68 19,-58 16,-50" stroke="url(#gRobeDk)" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="16" cy="-47" r="4" fill="${C.skinMid}"/></g>
    <path d="M-17,-80 C-24,-60 -22,-36 -20,-18 C-10,-14 10,-14 20,-18 C22,-36 24,-60 17,-80 C8,-86 -8,-86 -17,-80 Z" fill="url(#gRobe)"/>
    <path d="M-17,-80 C-10,-86 -2,-86 2,-84 C-4,-70 -12,-66 -18,-64 Z" fill="url(#gSkin)"/>
    <path d="M2,-84 C-4,-64 4,-40 12,-17 M10,-82 C4,-60 12,-40 18,-18 M-6,-66 C-12,-48 -12,-34 -14,-17" stroke="${C.robeMid}" stroke-width="1.1" fill="none" opacity=".8"/>
    <path d="M2,-84 C-5,-66 -2,-46 4,-17" stroke="#ffc680" stroke-width="1.2" fill="none" opacity=".6"/>
    <g class="leg leg-front"><path d="M-3,-22 L-4,-6" stroke="url(#gSkinL)" stroke-width="7" stroke-linecap="round"/><ellipse cx="-2" cy="-4" rx="6.5" ry="3" fill="url(#gSkin)" stroke="${C.skinDk}" stroke-width=".5"/></g>
    <g class="arm arm-front">
      <path d="M-15,-78 C-21,-66 -22,-56 -19,-48" stroke="${C.skinDk}" stroke-width="8.5" fill="none" stroke-linecap="round"/>
      <path d="M-15,-78 C-21,-66 -22,-56 -19,-48" stroke="url(#gSkinL)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="-19" cy="-45" rx="4.2" ry="5" fill="url(#gSkin)" stroke="${C.skinDk}" stroke-width=".5"/>
    </g>
    ${head(-101)}
  </g>`;
}

type Blob = [number, number, number, number];

function blossoms(stage: number, rnd: () => number, blobs: Blob[]): string {
  if (stage < 3) return '';
  const n = stage === 3 ? 7 : 16;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const [cx, cy, rx, ry] = blobs[i % blobs.length];
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.85;
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    const petals = [0, 72, 144, 216, 288]
      .map(
        (d) =>
          `<ellipse cx="0" cy="-2.2" rx="1.6" ry="2.4" fill="#ffe3ee" transform="rotate(${d})"/>`
      )
      .join('');
    out.push(
      `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">${petals}<circle r="1.1" fill="#ffb74d"/></g>`
    );
  }
  return out.join('');
}

export function leafPath(): string {
  return 'M0,-9 C-7,-9 -8,-1 -4,4 Q-1,7 0,12 Q1,7 4,4 C8,-1 7,-9 0,-9 Z';
}

/** Bodhi tree at growth stage 0–4. Deterministic: same seed every render. */
export function bodhiTree(stage = 4): string {
  const clamped = Math.max(0, Math.min(4, Math.floor(stage)));
  const density = [0.5, 0.64, 0.78, 0.9, 1][clamped];
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const tones = ['#2e7d32', '#388e3c', '#43a047', '#1b5e20', '#4caf50', '#66bb6a'];
  const blobs: Blob[] = [
    [118, 92, 96, 62],
    [60, 118, 52, 36],
    [175, 110, 58, 40],
    [110, 52, 70, 38]
  ];
  const leaves: string[] = [];
  for (const [cx, cy, rx, ry] of blobs) {
    const n = Math.round(((rx * ry) / 50) * density);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      const x = cx + Math.cos(a) * rx * r;
      const y = cy + Math.sin(a) * ry * r;
      const lit = ((cx + rx - x) / (2 * rx) + (cy + ry - y) / (2 * ry)) / 2 + rnd() * 0.35;
      const c =
        lit > 0.85
          ? 'url(#gLeaf)'
          : tones[Math.min(tones.length - 1, Math.floor(rnd() * 4 + (1 - lit) * 2))];
      leaves.push(
        `<path d="${leafPath()}" fill="${c}" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${Math.round(rnd() * 360)}) scale(${(0.75 + rnd() * 0.6).toFixed(2)})"/>`
      );
    }
  }
  return `
  <g class="tree">
    <g fill="#1b4d20" opacity=".6">
      <ellipse cx="118" cy="98" rx="100" ry="64"/><ellipse cx="58" cy="122" rx="54" ry="38"/>
      <ellipse cx="178" cy="114" rx="60" ry="42"/><ellipse cx="110" cy="56" rx="72" ry="40"/>
    </g>
    <path d="M66,256 Q84,232 84,196 Q82,160 66,134 L76,130 Q92,150 96,170 Q104,140 128,118 L134,124 Q108,150 104,190 Q102,232 124,256 Z" fill="url(#gTrunk)"/>
    <path d="M84,200 Q60,180 40,160" stroke="#6d4c35" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M100,170 Q140,150 172,140" stroke="#6d4c35" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M90,248 Q94,220 92,198 M100,246 Q104,226 101,206" stroke="#3e2a1e" stroke-width="1.6" fill="none" opacity=".5"/>
    <g class="canopy">${leaves.join('')}${blossoms(clamped, rnd, blobs)}</g>
  </g>`;
}

export const leafSvg = `<path d="${leafPath()}" fill="#7cb342" transform="scale(.8)"/>`;
