// Site vitrine : estimateur du hero, grille des véhicules, formulaire entreprises, installation PWA.
(function () {
  const { t, VEHICLES, COMMUNES, quote, distanceKm, store, ui } = TK;

  const q = { from: 'yopougon', to: 'cocody', vehicle: 'van1t' };

  function renderQuote() {
    const kmVal = distanceKm(q.from, q.to);
    const res = quote(q.vehicle, kmVal, null);
    document.getElementById('qKm').textContent = ui.km(kmVal);
    document.getElementById('qFloor').textContent = ui.fcfa(TK.vehicle(q.vehicle).floor);
    document.getElementById('qPrice').textContent = ui.fcfa(res.reference);
    document.getElementById('qMap').innerHTML = ui.routeMap(q.from, q.to, null);
    document.getElementById('quoteRef').textContent = `${TK.commune(q.from).name.slice(0, 3).toUpperCase()}→${TK.commune(q.to).name.slice(0, 3).toUpperCase()}`;
    document.getElementById('qGo').href = `#app`;
    document.getElementById('qGo').onclick = () => {
      try { sessionStorage.setItem('takaata.prefill', JSON.stringify(q)); } catch (e) { /* ignore */ }
      window.TKApp && window.TKApp.prefill(q);
    };
  }

  function renderVehiclePick() {
    const box = document.getElementById('qVehicles');
    box.querySelectorAll('label').forEach(l => l.remove());
    VEHICLES.forEach(v => {
      const l = document.createElement('label');
      l.className = 'chip-radio';
      l.innerHTML = `<input type="radio" name="qVehicle" id="qv-${v.id}" value="${v.id}"${v.id === q.vehicle ? ' checked' : ''}><span>${ui.esc(t('veh.' + v.id))}</span>`;
      box.appendChild(l);
    });
    box.onchange = e => { q.vehicle = e.target.value; renderQuote(); };
  }

  // Présentoir des véhicules (section « Véhicules et prix »).
  let showcaseId = 'van1t';
  function renderShowcase() {
    const V = TK.vehicles, box = document.getElementById('vehShowcase');
    box.innerHTML = `
      ${V.tabs(showcaseId, 'data-site-veh')}
      <div class="showcase-grid">
        ${V.stage(showcaseId, 'data-site-step')}
        <div class="showcase-side">
          <p class="showcase-name">${ui.esc(t('veh.' + showcaseId))}</p>
          <p class="sheet-sum">${ui.esc(t('sum.' + showcaseId))}</p>
          <ul class="item-grid item-grid-mini">${V.SPECS[showcaseId].items.slice(0, 6).map(([key, cap]) => `
            <li class="item-card"><span class="item-label">${ui.esc(t('it.' + key))}${cap ? ` <b class="mono">${ui.esc(cap)}</b>` : ''}</span><span class="item-ic">${V.icon(key)}</span></li>`).join('')}</ul>
          <p class="showcase-price">${ui.esc(t('vs.from', { p: ui.fcfa(TK.vehicle(showcaseId).floor) }))}</p>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" data-veh-open="${showcaseId}">${ui.esc(t('vs.how'))}</button>
            <a class="btn btn-signal" href="#app" data-site-order="${showcaseId}">${ui.esc(t('vs.order'))}</a>
          </div>
        </div>
      </div>`;
    V.centerTabs(box);
  }

  function orderWith(id) {
    q.vehicle = id;
    window.TKApp && window.TKApp.prefill(q);
    location.hash = 'app';
  }

  function bindShowcase() {
    const box = document.getElementById('vehShowcase');
    const show = id => { showcaseId = id; renderShowcase(); };
    box.addEventListener('click', e => {
      const tab = e.target.closest('[data-site-veh]');
      if (tab) return show(tab.dataset.siteVeh);
      const st = e.target.closest('[data-site-step]');
      if (st) return show(TK.vehicles.step(showcaseId, st.dataset.siteStep));
      const op = e.target.closest('[data-veh-open]');
      if (op) return TK.vehicles.openSheet(op.dataset.vehOpen, { label: t('vs.order'), onChoose: orderWith });
      const ord = e.target.closest('[data-site-order]');
      if (ord) { e.preventDefault(); orderWith(ord.dataset.siteOrder); }
    });
    TK.vehicles.swipe(box, dir => show(TK.vehicles.step(showcaseId, dir)));
  }

  function renderStatic() {
    document.getElementById('vehicleRows').innerHTML = VEHICLES.map(v => `
      <tr>
        <th scope="row">${ui.esc(t('veh.' + v.id))}</th>
        <td>${v.load}</td>
        <td class="mono">${ui.fmt(v.base)}</td>
        <td class="mono">${ui.fmt(v.perKm)}</td>
        <td class="mono">${ui.fmt(v.floor)}</td>
        <td>${ui.esc(t('use.' + v.id))}</td>
      </tr>`).join('');
    document.getElementById('communeList').innerHTML = COMMUNES.map(c => `<li>${ui.esc(c.name)}</li>`).join('');
    renderVehiclePick();
    renderQuote();
    renderShowcase();
  }

  function init() {
    document.querySelectorAll('select[data-communes]').forEach(s => { s.innerHTML = ui.communeOptions(); });
    const from = document.getElementById('qFrom'), to = document.getElementById('qTo');
    from.value = q.from; to.value = q.to;
    from.onchange = () => { q.from = from.value; renderQuote(); };
    to.onchange = () => { q.to = to.value; renderQuote(); };
    document.getElementById('qSwap').onclick = () => {
      [q.from, q.to] = [q.to, q.from];
      from.value = q.from; to.value = q.to;
      renderQuote();
    };
    document.getElementById('quoteForm').onsubmit = e => e.preventDefault();

    document.getElementById('bizForm').onsubmit = e => {
      e.preventDefault();
      store.addLead({
        company: document.getElementById('bizCompany').value.trim(),
        phone: document.getElementById('bizPhone').value.trim(),
        volume: document.getElementById('bizVolume').value
      });
      const st = document.getElementById('bizStatus');
      st.textContent = t('biz.sent');
      st.hidden = false;
      e.target.reset();
    };

    bindShowcase();
    renderStatic();
  }

  // Installation PWA (Android / Chrome). iOS : consigne affichée.
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.querySelectorAll('[data-install]').forEach(b => { b.hidden = false; });
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-install]');
    if (!b || !deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (err) { /* ignore */ }
    deferredPrompt = null;
    document.querySelectorAll('[data-install]').forEach(x => { x.hidden = true; });
  });

  window.TKSite = { init, refresh: renderStatic };
})();
