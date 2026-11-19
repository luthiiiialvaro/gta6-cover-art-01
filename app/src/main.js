// Vice Cover Lab — the editor wiring.
//
// Loads photos, binds every control, renders the live preview and exports
// the cover as a PNG. A `?shot=` query sets up a fixed scene for a
// screenshot instead (see ./shots.js).

import { drawCover, hitPanel, panelPolygons, GRADES, LAYOUTS, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const panelCount = { hero: 1, duo: 2, triple: 3, quad: 4 };

const state = {
  layout: 'duo',
  grade: 'sunset',
  mode: 'one',
  title: 'Vice Heist',
  subtitle: 'A Vice City story',
  titleSize: 0.15,
  titleColor: '#ffffff',
  outline: true,
  size: '1920x1080',
  photos: [null, null, null],
  photoNames: ['', '', ''],
  panels: [
    { photo: 0, zoom: 1, panX: 0, panY: 0, fit: 'fill' },
    { photo: 0, zoom: 1, panX: 0, panY: 0, fit: 'fill' },
    { photo: 0, zoom: 1, panX: 0, panY: 0, fit: 'fill' },
    { photo: 0, zoom: 1, panX: 0, panY: 0, fit: 'fill' },
  ],
  selected: 0,
};

function currentSize() {
  return EXPORT_SIZES.find((s) => s.id === state.size) || EXPORT_SIZES[2];
}

function setStatus(text) {
  statusEl.textContent = text;
}

function render() {
  const size = currentSize();
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  const panels = panelPolygons(state.layout, size.w, size.h).map((_, i) => {
    const p = state.panels[i];
    const photoIndex = state.mode === 'one' ? 0 : p.photo;
    return {
      image: state.photos[photoIndex] || null,
      zoom: p.zoom,
      panX: p.panX,
      panY: p.panY,
      fit: p.fit,
    };
  });
  drawCover(canvas, panels, {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    titleSize: state.titleSize,
    titleColor: state.titleColor,
    outline: state.outline,
  });
  const loaded = state.photos.filter(Boolean).length;
  const sizeLabel = currentSize().label;
  setStatus(`${loaded} photo${loaded === 1 ? '' : 's'} loaded · ${state.layout} · ${GRADES[state.grade].label} · ${sizeLabel}`);
}

// Loads an image from a URL, resolving to the image once it can be drawn.
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function addFiles(files) {
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const slot = state.photos.findIndex((p) => p === null);
    if (slot === -1) {
      setStatus('All 3 photo slots are full — remove one first.');
      break;
    }
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos[slot] = img;
      state.photoNames[slot] = file.name;
      added++;
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  if (added) {
    refreshPhotoSlots();
    refreshPanelPhotoSelect();
    render();
  }
}

async function loadSample(name) {
  const slot = state.photos.findIndex((p) => p === null);
  if (slot === -1) {
    setStatus('All 3 photo slots are full — remove one first.');
    return;
  }
  try {
    const img = await loadImage(`samples/${name}.jpg`);
    state.photos[slot] = img;
    state.photoNames[slot] = `${name}.jpg (sample)`;
    refreshPhotoSlots();
    refreshPanelPhotoSelect();
    render();
  } catch {
    setStatus(`Could not load sample ${name}.`);
  }
}

function refreshPhotoSlots() {
  const wrap = document.getElementById('photoSlots');
  wrap.innerHTML = '';
  state.photos.forEach((img, i) => {
    const slot = document.createElement('div');
    slot.className = `slot${img ? ' filled' : ''}`;
    if (img) {
      const thumb = document.createElement('img');
      thumb.src = img.src;
      thumb.alt = state.photoNames[i];
      slot.appendChild(thumb);
      const label = document.createElement('span');
      label.textContent = state.photoNames[i].slice(0, 18);
      slot.appendChild(label);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'slot-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove photo ${i + 1}`);
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        state.photos[i] = null;
        state.photoNames[i] = '';
        refreshPhotoSlots();
        refreshPanelPhotoSelect();
        render();
      });
      slot.appendChild(remove);
    } else {
      slot.textContent = `Photo ${i + 1} — empty`;
    }
    slot.addEventListener('click', () => {
      if (!img) return;
      if (state.mode === 'each') {
        state.panels[state.selected].photo = i;
        refreshPanelPhotoSelect();
        render();
      }
    });
    wrap.appendChild(slot);
  });
}

function refreshPanelTabs() {
  const wrap = document.getElementById('panelTabs');
  wrap.innerHTML = '';
  const count = panelCount[state.layout];
  if (state.selected >= count) state.selected = 0;
  for (let i = 0; i < count; i++) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `tab${i === state.selected ? ' active' : ''}`;
    tab.textContent = `Panel ${i + 1}`;
    tab.addEventListener('click', () => {
      state.selected = i;
      refreshPanelTabs();
      refreshPanelPhotoSelect();
      syncPanelControls();
    });
    wrap.appendChild(tab);
  }
}

function refreshPanelPhotoSelect() {
  const select = document.getElementById('panelPhoto');
  const current = state.panels[state.selected].photo;
  select.innerHTML = '';
  const scene = document.createElement('option');
  scene.value = '-1';
  scene.textContent = 'Vice City scene (no photo)';
  select.appendChild(scene);
  state.photos.forEach((img, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = img ? `Photo ${i + 1} — ${state.photoNames[i].slice(0, 22)}` : `Photo ${i + 1} — empty`;
    select.appendChild(opt);
  });
  select.value = state.photos[current] ? String(current) : '-1';
  select.disabled = state.mode === 'one';
}

function syncPanelControls() {
  const p = state.panels[state.selected];
  document.getElementById('zoom').value = String(p.zoom);
  document.getElementById('zoomVal').textContent = `${p.zoom.toFixed(2)}×`;
  document.getElementById('panX').value = String(p.panX);
  document.getElementById('panY').value = String(p.panY);
  document.getElementById('fitToggle').value = p.fit;
}

function syncControlStates() {
  document.querySelectorAll('#layoutBtns [data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeBtns [data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#sizeBtns [data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  document.querySelectorAll('[name="mode"]').forEach((r) => {
    r.checked = r.value === state.mode;
  });
  document.getElementById('title').value = state.title;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('titleSize').value = String(state.titleSize);
  document.getElementById('titleSizeVal').textContent = `${Math.round(state.titleSize * 100)}%`;
  document.getElementById('outline').checked = state.outline;
  document.querySelectorAll('#titleColors [data-color]').forEach((b) => {
    b.classList.toggle('active', b.dataset.color === state.titleColor);
  });
}

function exportPng() {
  render();
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — the canvas is empty.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${state.size}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus(`Saved vice-cover-${state.size}.png`);
  }, 'image/png');
}

const SURPRISE_TITLES = [
  ['Vice Heist', 'A Vice City story'],
  ['Neon Nights', 'Drive fast, shine bright'],
  ['Boulevard Queen', 'Ocean Drive after dark'],
  ['Palm Shadows', 'No witnesses, no mercy'],
  ['Sunset Run', 'One last score'],
  ['Midnight Vice', 'The city never sleeps'],
];

function surpriseMe() {
  const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
  const gradeKeys = Object.keys(GRADES);
  const grade = gradeKeys[Math.floor(Math.random() * gradeKeys.length)];
  const [title, subtitle] = SURPRISE_TITLES[Math.floor(Math.random() * SURPRISE_TITLES.length)];
  state.layout = layout;
  state.grade = grade;
  state.title = title;
  state.subtitle = subtitle;
  state.panels.forEach((p) => {
    p.zoom = 1 + Math.random() * 0.6;
    p.panX = (Math.random() - 0.5) * 0.8;
    p.panY = (Math.random() - 0.5) * 0.8;
  });
  refreshPanelTabs();
  refreshPanelPhotoSelect();
  syncPanelControls();
  syncControlStates();
  render();
  setStatus(`Surprise: ${layout} · ${GRADES[grade].label} · “${title}”`);
}

// --- Drag to pan, scroll to zoom, on the preview canvas. ---
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const panelIndex = hitPanel(state.layout, canvas.width, canvas.height, x, y);
  state.selected = panelIndex;
  refreshPanelTabs();
  syncPanelControls();
  drag = { x, y, panel: state.panels[panelIndex] };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const p = drag.panel;
  p.panX = Math.max(-1, Math.min(1, p.panX + ((x - drag.x) / canvas.width) * 4));
  p.panY = Math.max(-1, Math.min(1, p.panY + ((y - drag.y) / canvas.height) * 4));
  drag.x = x;
  drag.y = y;
  syncPanelControls();
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = state.panels[state.selected];
  p.zoom = Math.max(1, Math.min(3, p.zoom * Math.exp(-e.deltaY * 0.001)));
  syncPanelControls();
  render();
}, { passive: false });

// --- Controls. ---
document.getElementById('fileInput').addEventListener('change', (e) => {
  addFiles(Array.from(e.target.files || []));
  e.target.value = '';
});
const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('click', () => document.getElementById('fileInput').click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  addFiles(Array.from(e.dataTransfer.files || []));
});
document.querySelectorAll('[data-sample]').forEach((b) => {
  b.addEventListener('click', () => loadSample(b.dataset.sample));
});
document.querySelectorAll('[name="mode"]').forEach((r) => {
  r.addEventListener('change', () => {
    state.mode = r.value;
    refreshPanelPhotoSelect();
    render();
  });
});
document.getElementById('panelPhoto').addEventListener('change', (e) => {
  // -1 means "Vice City scene (no photo)": render() reads photos[-1] as
  // undefined and draws the code-drawn scene for that panel instead.
  state.panels[state.selected].photo = Number(e.target.value);
  render();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  syncPanelControls();
  render();
});
document.getElementById('panX').addEventListener('input', (e) => {
  state.panels[state.selected].panX = Number(e.target.value);
  render();
});
document.getElementById('panY').addEventListener('input', (e) => {
  state.panels[state.selected].panY = Number(e.target.value);
  render();
});
document.getElementById('fitToggle').addEventListener('change', (e) => {
  state.panels[state.selected].fit = e.target.value;
  render();
});
document.querySelectorAll('#layoutBtns [data-layout]').forEach((b) => {
  b.addEventListener('click', () => {
    state.layout = b.dataset.layout;
    refreshPanelTabs();
    syncControlStates();
    render();
  });
});
document.querySelectorAll('#gradeBtns [data-grade]').forEach((b) => {
  b.addEventListener('click', () => {
    state.grade = b.dataset.grade;
    syncControlStates();
    render();
  });
});
document.querySelectorAll('#sizeBtns [data-size]').forEach((b) => {
  b.addEventListener('click', () => {
    state.size = b.dataset.size;
    syncControlStates();
    render();
  });
});
document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  render();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  render();
});
document.getElementById('titleSize').addEventListener('input', (e) => {
  state.titleSize = Number(e.target.value);
  document.getElementById('titleSizeVal').textContent = `${Math.round(state.titleSize * 100)}%`;
  render();
});
document.querySelectorAll('#titleColors [data-color]').forEach((b) => {
  b.addEventListener('click', () => {
    state.titleColor = b.dataset.color;
    syncControlStates();
    render();
  });
});
document.getElementById('outline').addEventListener('change', (e) => {
  state.outline = e.target.checked;
  render();
});
document.getElementById('exportBtn').addEventListener('click', exportPng);
document.getElementById('surpriseBtn').addEventListener('click', surpriseMe);

// The shot API: what ./shots.js drives for deterministic screenshots.
const shotApi = {
  state,
  canvas,
  async loadSamples(names) {
    for (const name of names) {
      const slot = state.photos.findIndex((p) => p === null);
      if (slot === -1) break;
      state.photos[slot] = await loadImage(`samples/${name}.jpg`);
      state.photoNames[slot] = `${name}.jpg (sample)`;
    }
    refreshPhotoSlots();
    refreshPanelPhotoSelect();
  },
  apply(patch) {
    if (patch.layout) state.layout = patch.layout;
    if (patch.grade) state.grade = patch.grade;
    if (patch.size) state.size = patch.size;
    if (patch.title !== undefined) state.title = patch.title;
    if (patch.subtitle !== undefined) state.subtitle = patch.subtitle;
    if (patch.mode) state.mode = patch.mode;
    if (patch.panels) {
      patch.panels.forEach((photo, i) => {
        if (state.panels[i]) state.panels[i].photo = photo;
      });
    }
    refreshPanelTabs();
    refreshPanelPhotoSelect();
    syncPanelControls();
    syncControlStates();
  },
  render,
  exportPng,
};

// Render once the Anton face is ready, so the caption never draws in a
// fallback font; re-render on the first paint either way.
if (document.fonts) {
  document.fonts.load('400 100px Anton').catch(() => {});
  document.fonts.ready.then(() => render());
}
refreshPhotoSlots();
refreshPanelTabs();
refreshPanelPhotoSelect();
syncPanelControls();
syncControlStates();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), shotApi);
} else {
  render();
}
