// Petits utilitaires d'affichage partagés par le site et l'application.
(function () {
  const { COMMUNES, commune } = TK;

  const fmt = n => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const fcfa = n => `${fmt(n)} FCFA`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const km = n => `${String(n).replace('.', TK.getLang() === 'fr' ? ',' : '.')} km`;

  function communeOptions(selected) {
    return COMMUNES.map(c => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // Carte schématique des communes : points + trajet, et position du véhicule (0 → 1).
  const BOUNDS = { minLon: -4.29, maxLon: -3.86, minLat: 5.235, maxLat: 5.515 };
  const W = 340, H = 200;
  function project(c) {
    return {
      x: 14 + (c.lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon) * (W - 28),
      y: 12 + (BOUNDS.maxLat - c.lat) / (BOUNDS.maxLat - BOUNDS.minLat) * (H - 24)
    };
  }
  function routeMap(fromId, toId, progress) {
    const a = project(commune(fromId)), b = project(commune(toId));
    const dots = COMMUNES.map(c => {
      const p = project(c);
      const on = c.id === fromId || c.id === toId;
      return `<g class="${on ? 'm-on' : 'm-off'}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${on ? 5 : 2.6}"></circle>` +
        `<text x="${(p.x + 7).toFixed(1)}" y="${(p.y + 3.5).toFixed(1)}">${esc(c.name)}</text></g>`;
    }).join('');
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.max(18, Math.hypot(b.x - a.x, b.y - a.y) * 0.18);
    const path = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
    let truck = '';
    if (progress != null) {
      const tt = Math.max(0, Math.min(1, progress));
      const x = (1 - tt) ** 2 * a.x + 2 * (1 - tt) * tt * mx + tt ** 2 * b.x;
      const y = (1 - tt) ** 2 * a.y + 2 * (1 - tt) * tt * my + tt ** 2 * b.y;
      truck = `<g class="m-truck" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><rect x="-9" y="-6" width="18" height="12" rx="3"></rect><circle r="2.2" cx="0" cy="0"></circle></g>`;
    }
    return `<svg class="route-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(commune(fromId).name)} → ${esc(commune(toId).name)}">` +
      `<path class="m-route-bg" d="${path}"></path><path class="m-route" d="${path}"></path>${dots}${truck}</svg>`;
  }

  window.TK = Object.assign(window.TK || {}, { ui: { fmt, fcfa, esc, km, communeOptions, toast, routeMap } });
})();
