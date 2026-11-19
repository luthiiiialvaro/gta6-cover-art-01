// Vice Cover Lab — the cover renderer.
//
// Draws a multi-panel GTA-style cover onto a canvas: diagonal photo panels,
// a code-drawn Vice City scene (sky, sun, skyline, palms) wherever a panel
// has no photo, a sunset or neon colour grade, grain, and the big caption.
// Every bit of scenery is drawn with the canvas 2D API, so a cover looks
// finished even with a plain photo, and nothing here needs the network.

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    sky: ['#2b1055', '#c6426e', '#ff7e2e'],
    sun: '#ffd166',
    tint: ['rgba(255, 110, 60, 0.20)', 'rgba(255, 46, 130, 0.22)'],
    accent: '#ff2e63',
    dark: '#1c0b2e',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#0d0221', '#5b2ee5', '#ff2ea6'],
    sun: '#00f0ff',
    tint: ['rgba(123, 47, 247, 0.20)', 'rgba(0, 240, 255, 0.16)'],
    accent: '#00f0ff',
    dark: '#0d0221',
  },
  ocean: {
    label: 'Ocean Drive',
    sky: ['#062a33', '#0e7490', '#fbbf77'],
    sun: '#fff3b0',
    tint: ['rgba(14, 165, 165, 0.18)', 'rgba(255, 180, 110, 0.20)'],
    accent: '#ff7a59',
    dark: '#062a33',
  },
  noir: {
    label: 'Palm Noir',
    sky: ['#0a0a0f', '#23202e', '#6b4a2f'],
    sun: '#d4af37',
    tint: ['rgba(212, 175, 55, 0.14)', 'rgba(0, 0, 0, 0.28)'],
    accent: '#d4af37',
    dark: '#0a0a0f',
  },
};

export const LAYOUTS = ['hero', 'duo', 'triple', 'quad'];
export const EXPORT_SIZES = [
  { id: '1080x1080', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Landscape 1920 x 1080', w: 1920, h: 1080 },
];

// A tiny seeded generator (mulberry32) so the grain, the skyline and the
// palms are identical on every run: screenshots stay deterministic.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygonBounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function tracePolygon(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
}

function pointInPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// The panel shapes for each layout, as polygons in canvas pixels. The
// diagonal edges are what make the cover read as GTA-style.
export function panelPolygons(layout, w, h) {
  if (layout === 'hero') return [[[0, 0], [w, 0], [w, h], [0, h]]];
  if (layout === 'duo') {
    return [
      [[0, 0], [w * 0.58, 0], [w * 0.42, h], [0, h]],
      [[w * 0.58, 0], [w, 0], [w, h], [w * 0.42, h]],
    ];
  }
  if (layout === 'triple') {
    return [
      [[0, 0], [w * 0.36, 0], [w * 0.24, h], [0, h]],
      [[w * 0.36, 0], [w * 0.72, 0], [w * 0.60, h], [w * 0.24, h]],
      [[w * 0.72, 0], [w, 0], [w, h], [w * 0.60, h]],
    ];
  }
  // quad: a 2 x 2 grid whose inner edges lean, so it is not a plain grid.
  return [
    [[0, 0], [w * 0.52, 0], [w * 0.48, h * 0.52], [0, h * 0.48]],
    [[w * 0.52, 0], [w, 0], [w, h * 0.48], [w * 0.48, h * 0.52]],
    [[0, h * 0.48], [w * 0.48, h * 0.52], [w * 0.52, h], [0, h]],
    [[w * 0.48, h * 0.52], [w, h * 0.48], [w, h], [w * 0.52, h]],
  ];
}

export function hitPanel(layout, w, h, x, y) {
  const polys = panelPolygons(layout, w, h);
  for (let i = polys.length - 1; i >= 0; i--) {
    if (pointInPolygon(polys[i], x, y)) return i;
  }
  return 0;
}

function drawPhoto(ctx, image, poly, panel) {
  const box = polygonBounds(poly);
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const zoom = panel.zoom || 1;
  let scale;
  if (panel.fit === 'fit') {
    scale = Math.min(box.w / iw, box.h / ih) * zoom;
  } else {
    scale = Math.max(box.w / iw, box.h / ih) * zoom;
  }
  const dw = iw * scale;
  const dh = ih * scale;
  const cx = box.x + box.w / 2 + (panel.panX || 0) * box.w * 0.25;
  const cy = box.y + box.h / 2 + (panel.panY || 0) * box.h * 0.25;
  ctx.save();
  tracePolygon(ctx, poly);
  ctx.clip();
  ctx.drawImage(image, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawPalm(ctx, x, baseY, size, lean, dark) {
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.fillStyle = dark;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.lineCap = 'round';
  const tipX = x + lean * size;
  const tipY = baseY - size;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * size * 0.4, baseY - size * 0.6, tipX, tipY);
  ctx.stroke();
  // Fronds: five arcs fanning out from the crown.
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI * (0.08 + i * 0.21);
    const fx = tipX + Math.cos(angle) * size * 0.42 * (i % 2 === 0 ? 1 : 0.8);
    const fy = tipY + Math.sin(angle) * size * 0.3 - size * 0.06;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(
      tipX + (fx - tipX) * 0.5,
      tipY + (fy - tipY) * 0.5 - size * 0.16,
      fx,
      fy,
    );
    ctx.lineWidth = Math.max(2, size * 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScene(ctx, poly, grade, seed) {
  const box = polygonBounds(poly);
  const rand = seededRandom(seed);
  ctx.save();
  tracePolygon(ctx, poly);
  ctx.clip();
  // Sky.
  const sky = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  // Sun with a soft glow.
  const sunR = Math.min(box.w, box.h) * 0.16;
  const sunX = box.x + box.w * (0.3 + rand() * 0.4);
  const sunY = box.y + box.h * (0.26 + rand() * 0.1);
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, grade.sun);
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = glow;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Halftone dots fading down from the sun.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let row = 0; row < 7; row++) {
    const y = box.y + box.h * (0.06 + row * 0.045);
    const r = Math.max(0.6, sunR * 0.05 * (1 - row / 8));
    for (let x = box.x + box.w * 0.08; x < box.x + box.w * 0.94; x += sunR * 0.22) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Skyline: a row of flat buildings with lit windows.
  const baseY = box.y + box.h;
  let bx = box.x - box.w * 0.02;
  ctx.fillStyle = grade.dark;
  while (bx < box.x + box.w) {
    const bw = box.w * (0.06 + rand() * 0.09);
    const bh = box.h * (0.1 + rand() * 0.24);
    const top = baseY - bh;
    ctx.fillRect(bx, top, bw, bh);
    if (rand() > 0.6) {
      // A rooftop antenna.
      ctx.fillRect(bx + bw / 2 - 1, top - box.h * 0.05, 2, box.h * 0.05);
    }
    ctx.fillStyle = 'rgba(255, 220, 130, 0.85)';
    const cols = Math.max(1, Math.floor(bw / (box.w * 0.028)));
    const rows = Math.max(1, Math.floor(bh / (box.h * 0.05)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() > 0.55) {
          ctx.fillRect(
            bx + box.w * 0.012 + c * box.w * 0.028,
            top + box.h * 0.02 + r * box.h * 0.05,
            Math.max(1.5, box.w * 0.011),
            Math.max(1.5, box.h * 0.02),
          );
        }
      }
    }
    ctx.fillStyle = grade.dark;
    bx += bw + box.w * 0.008;
  }
  // Palms at the panel edges.
  drawPalm(ctx, box.x + box.w * 0.06, baseY, box.h * 0.3, 0.35, grade.dark);
  drawPalm(ctx, box.x + box.w * 0.94, baseY, box.h * 0.26, -0.3, grade.dark);
  ctx.restore();
}

function drawGrain(ctx, w, h, seed) {
  const rand = seededRandom(seed + 77);
  const step = Math.max(3, Math.round(w / 320));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = rand();
      if (v > 0.84) {
        ctx.fillStyle = v > 0.92 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, step * 0.7, step * 0.7);
      }
    }
  }
}

function wrapTitle(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawCaption(ctx, w, h, opts, grade) {
  const title = (opts.title || '').trim().toUpperCase();
  const subtitle = (opts.subtitle || '').trim();
  if (!title && !subtitle) return;
  const base = Math.min(w, h);
  let size = base * (opts.titleSize || 0.15);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => { ctx.font = `400 ${s}px Anton, 'Arial Narrow', sans-serif`; };
  setFont(size);
  let lines = title ? wrapTitle(ctx, title, w * 0.92) : [];
  while (lines.some((l) => ctx.measureText(l).width > w * 0.92) && size > 14) {
    size -= 2;
    setFont(size);
    lines = wrapTitle(ctx, title, w * 0.92);
  }
  const lineHeight = size * 1.02;
  const blockH = lines.length * lineHeight;
  const bottom = h - h * 0.055;
  const top = bottom - blockH;
  // A dark band behind the caption so it reads over any photo.
  if (lines.length) {
    const band = ctx.createLinearGradient(0, top - size * 0.55, 0, h);
    band.addColorStop(0, 'rgba(0, 0, 0, 0)');
    band.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    ctx.fillStyle = band;
    ctx.fillRect(0, top - size * 0.55, w, h - (top - size * 0.55));
    // Accent rule centred just above the title, a divider between the
    // subtitle pill and the title block.
    const ruleW = w * 0.16;
    ctx.fillStyle = grade.accent;
    ctx.fillRect((w - ruleW) / 2, top - size * 0.22, ruleW, Math.max(3, h * 0.006));
  }
  // Subtitle pill, above the title.
  if (subtitle) {
    const subSize = Math.max(13, Math.round(base * 0.028));
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.18)}px`; } catch { /* older canvas */ }
    const tw = ctx.measureText(subtitle.toUpperCase()).width;
    const padX = subSize * 0.9;
    const pillW = tw + padX * 2;
    const pillH = subSize * 2.1;
    const pillX = (w - pillW) / 2;
    const pillY = top - size * 0.62 - pillH;
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = grade.dark;
    ctx.textAlign = 'center';
    ctx.fillText(subtitle.toUpperCase(), w / 2, pillY + pillH / 2 + subSize * 0.36);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  // The title itself: outline, shadow, then fill.
  if (lines.length) {
    setFont(size);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.1;
    ctx.shadowOffsetY = size * 0.045;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = opts.outline === false ? 'transparent' : '#111111';
    ctx.lineWidth = Math.max(2, size * 0.13);
    ctx.fillStyle = opts.titleColor || '#ffffff';
    lines.forEach((line, i) => {
      const y = top + lineHeight * (i + 1) - size * 0.18;
      if (opts.outline !== false) ctx.strokeText(line, w / 2, y);
      ctx.fillText(line, w / 2, y);
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
}

// Draws the whole cover. `panels` is an array with one entry per panel of
// the layout: { image, zoom, panX, panY, fit }. A panel with no image gets
// the code-drawn Vice City scene instead.
export function drawCover(canvas, panels, opts) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[opts.grade] || GRADES.sunset;
  const polys = panelPolygons(opts.layout || 'duo', w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = grade.dark;
  ctx.fillRect(0, 0, w, h);
  polys.forEach((poly, i) => {
    const panel = panels[i] || {};
    if (panel.image) {
      drawPhoto(ctx, panel.image, poly, panel);
    } else {
      drawScene(ctx, poly, grade, 1000 + i * 131);
    }
  });
  // White panel separators.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = Math.max(3, w * 0.005);
  ctx.lineJoin = 'round';
  polys.forEach((poly) => {
    tracePolygon(ctx, poly);
    ctx.stroke();
  });
  // Grade tint over the whole cover.
  const tint = ctx.createLinearGradient(0, 0, 0, h);
  tint.addColorStop(0, grade.tint[0]);
  tint.addColorStop(1, grade.tint[1]);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  // Vignette.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  drawGrain(ctx, w, h, 42);
  drawCaption(ctx, w, h, opts, grade);
}
