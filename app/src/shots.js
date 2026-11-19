// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo; ?shot=cover shows the cover alone at its export size. The query
// also takes layout, grade, size, title, subtitle, mode and up to three
// sample photos (photo, photo2, photo3). With export=1 the cover scene
// downloads the PNG the app wrote. window.__shotReady is set once painted.

function queryList(query, key) {
  const value = query.get(key);
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const names = queryList(query, 'photos');
  if (!names.length) {
    const first = query.get('photo');
    if (first) names.push(first);
    const second = query.get('photo2');
    if (second) names.push(second);
    const third = query.get('photo3');
    if (third) names.push(third);
  }
  if (names.length) await api.loadSamples(names);
  const patch = {
    layout: query.get('layout') || undefined,
    grade: query.get('grade') || undefined,
    size: query.get('size') || undefined,
    title: query.get('title') ?? undefined,
    subtitle: query.get('subtitle') ?? undefined,
    mode: query.get('mode') || undefined,
  };
  api.apply(patch);
  // In "each" mode the panels take the loaded photos in order.
  if (patch.mode === 'each') {
    api.apply({ panels: [0, 1, 2, 0] });
  }
  if (document.fonts) {
    try { await document.fonts.ready; } catch { /* fall back to system fonts */ }
  }
  api.render();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (shot === 'cover' && query.get('export') === '1') {
    api.exportPng();
  }
  window.__shotReady = true;
}
