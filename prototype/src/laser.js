// Laser overlay: 2D canvas, click-through window covering the selected display's work area.
// Receives {lensL, lensR, target, tier, duration, width, height, sound, reduceMotion} from main.
// reduceMotion: static red edge outline instead of animated sweep.
const c = document.getElementById('c');
const g = c.getContext('2d');
let blast = null, scorch = [];

window.bodhi.on('blast', b => {
  const dpr = window.devicePixelRatio || 1;
  c.width = b.width * dpr; c.height = b.height * dpr;
  c.style.width = b.width + 'px'; c.style.height = b.height + 'px';
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  blast = { ...b, t0: performance.now() };
  requestAnimationFrame(frame);
});

function targetAt(p) {
  const { width: W, height: H, target, tier } = blast;
  if (tier === 1 && target) return target;                       // aimed beam at the offending window
  const a = Math.PI * (1.05 + p * 0.9);                            // sweep an arc across the screen
  return { x: W / 2 + Math.cos(a) * W * 0.55, y: H * 0.95 + Math.sin(a) * H * 0.8 };
}

function frame(now) {
  if (!blast) return;
  const t = now - blast.t0, CHARGE = 300;
  g.clearRect(0, 0, blast.width, blast.height);
  const p = Math.min(1, Math.max(0, (t - CHARGE) / blast.duration));
  const lenses = [blast.lensL, blast.lensR];

  if (t < CHARGE) {                                                 // charge glow on the lenses
    for (const l of lenses) { g.fillStyle = `rgba(255,42,42,${t / CHARGE})`; g.beginPath(); g.arc(l.x, l.y, 4 + 6 * t / CHARGE, 0, 7); g.fill(); }
  } else if (p < 1 && !blast.reduceMotion) {
    const tg = targetAt(p);
    scorch.push({ x: tg.x + (Math.random() - .5) * 10, y: tg.y + (Math.random() - .5) * 10, t: now });
    g.globalCompositeOperation = 'lighter';
    for (const l of lenses) {
      g.strokeStyle = 'rgba(255,138,138,0.35)'; g.lineWidth = 10; g.lineCap = 'round';
      g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(tg.x, tg.y); g.stroke();
      g.strokeStyle = '#ff2a2a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(tg.x, tg.y); g.stroke();
    }
    g.fillStyle = 'rgba(255,220,200,.9)'; g.beginPath(); g.arc(tg.x, tg.y, 6 + Math.random() * 4, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  } else if (blast.reduceMotion && p < 1) {
    // reduce-motion: static red edge outline on the target window rect
    const { width: W, height: H, target, tier } = blast;
    const pad = 6;
    if (target) {
      const tw = Math.max(50, target.width || 120);
      const th = Math.max(50, target.height || 80);
      g.strokeStyle = '#ff2a2a'; g.lineWidth = 3; g.lineCap = 'round'; g.lineDashOffset = now / 10;
      g.setLineDash([15, 10]); g.strokeRect(target.x - tw / 2 - pad, target.y - th / 2 - pad, tw + pad * 2, th + pad * 2); g.setLineDash([]);
    }
  }
  scorch = scorch.filter(s => now - s.t < 800);                     // scorch marks fade in 800 ms
  for (const s of scorch) { g.fillStyle = `rgba(60,20,10,${0.5 * (1 - (now - s.t) / 800)})`; g.fillRect(s.x - 2, s.y - 2, 4, 4); }

  if (p < 1 || scorch.length) requestAnimationFrame(frame); else blast = null;
}
