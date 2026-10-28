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
