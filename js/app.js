// Application Takaata (PWA) : espaces Client, Chauffeur et Admin + routage.
(function () {
  const { t, VEHICLES, NEEDS, PAYMENTS, STATUSES, store, ui, quote, distanceKm, commission, commune, vehicle } = TK;
  const { fcfa, esc, fmt } = ui;

  const ROUTES = { app: 'client', chauffeur: 'driver', admin: 'admin' };
  const NEED_VEHICLE = { moving: 'truck3t', furniture: 'van1t', food: 'truck3t', shop: 'van1t', parcel: 'tricycle' };
  const PROGRESS = { open: null, assigned: 0, pickup: 0, loading: 0.04, transit: 0.55, arrived: 1, delivered: 1, cancelled: null };
  const ACTIVE = ['open', 'assigned', 'pickup', 'loading', 'transit', 'arrived'];

  const view = { name: 'home', step: 1, draft: null, auth: { mode: 'signup', step: 'form' }, meSub: '', rate: null, confirmLogout: false, supportSent: false, orderId: null, confirmCancel: false, reportOpen: false, reported: false, counterFor: null, confirmReset: false, offerMsg: {} };
  const root = document.getElementById('app');

  // ---------- helpers ----------
  const route = o => `${esc(commune(o.from).name)} → ${esc(commune(o.to).name)}`;
  const pill = s => `<span class="pill pill-${s}">${esc(t('status.' + s))}</span>`;
  const stars = n => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));
  const time = ts => new Date(ts).toLocaleTimeString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = ts => new Date(ts).toLocaleDateString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });

  function newDraft(patch) {
    return Object.assign({
      need: 'moving', from: 'yopougon', to: '', fromDetail: '', toDetail: '', when: 'now', whenAt: '',
      vehicle: 'truck3t', service: 'transport', items: '', notes: '', itemsQty: {}, weightManual: '', weight: '',
      floorsFrom: 0, floorsTo: 0, elevator: false, helpers: 1, packing: false, dismantle: false, price: null, payment: 'cash'
    }, patch);
  }
  function draftQuote(d) { return quote(d.vehicle, distanceKm(d.from, d.to), d); }

  // ---------- en-tête de l'app ----------
  function header(role) {
    const tab = (r, hash) => `<a href="#${hash}" class="seg${role === r ? ' is-on' : ''}"${role === r ? ' aria-current="page"' : ''}>${esc(t('role.' + r))}</a>`;
    return `
    <header class="app-top">
      <div class="app-top-in">
        <a class="brand brand-sm" href="#" aria-label="${esc(t('app.site'))}"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">takaata</span></a>
        <nav class="segs" aria-label="Espaces">${tab('client', 'app')}${tab('driver', 'chauffeur')}${tab('admin', 'admin')}</nav>
        <button class="lang-toggle" type="button" data-lang-toggle>${TK.getLang() === 'fr' ? 'EN' : 'FR'}</button>
      </div>
    </header>`;
  }

  // ---------- CLIENT ----------
  const V = () => TK.vehicles;
  function servicePrices(d, kmVal) {
    return {
      handling: quote(d.vehicle, kmVal, { service: 'handling', helpers: Math.max(1, d.helpers || 1), floorsFrom: d.floorsFrom, floorsTo: d.floorsTo, elevator: d.elevator }).reference,
      transport: quote(d.vehicle, kmVal, { service: 'transport' }).reference
    };
  }
  const code = id => commune(id).name.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

  // Poids estimé à partir des objets cochés (le client peut le corriger).
  function estimatedKg(d) {
    const W = V().WEIGHTS;
    return Object.entries(d.itemsQty || {}).reduce((a, [k, n]) => a + (W[k] || 0) * n, 0);
  }
  function loadKg(d) { return d.weightManual ? Number(d.weightManual) || 0 : estimatedKg(d); }
  function itemsSummary(d) {
    const list = Object.entries(d.itemsQty || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} × ${t('it.' + k)}`);
    if (d.notes && d.notes.trim()) list.push(d.notes.trim());
    return list.join(', ');
  }

  // Départ : position du téléphone → commune la plus proche.
  function locate() {
    const d = view.draft;
    if (!navigator.geolocation) { d.loc = 'off'; render(); return; }
    d.loc = 'busy';
    try {
      navigator.geolocation.getCurrentPosition(pos => {
        const c = TK.nearestCommune(pos.coords.latitude, pos.coords.longitude);
        if (c) { d.from = c.id; d.fromLat = pos.coords.latitude; d.fromLon = pos.coords.longitude; d.loc = 'ok'; } else d.loc = 'out';
        render();
      }, () => { d.loc = 'off'; render(); }, { timeout: 10000, maximumAge: 300000 });
    } catch (e) { d.loc = 'off'; }
  }

  // Accueil : besoin, véhicule, départ (localisé) et arrivée. Choisir l'arrivée ouvre la page suivante.
  function clientHome() {
    const d = view.draft || (view.draft = newDraft());
    if (!d.loc) setTimeout(locate, 0);
    const active = store.state.orders.filter(o => o.owner === 'me' && ACTIVE.includes(o.status));
    const locLabel = { busy: 'loc.busy', ok: 'loc.ok', off: 'loc.off', out: 'loc.out', manual: 'quote.from' }[d.loc] || 'loc.busy';
    return `
      ${active.length ? `<section class="home-active"><h2 class="app-h">${esc(t('c.active'))}</h2><div class="stack">${active.map(orderRow).join('')}</div></section>` : ''}
      ${(() => {
        const toRate = store.state.orders.find(o => o.owner === 'me' && o.status === 'delivered' && o.rating == null && o.driver);
        return toRate ? `<button type="button" class="rate-banner" data-act="open-order" data-id="${toRate.id}">
          <span class="stars" aria-hidden="true">★★★★★</span><span>${esc(t('rt.pending', { n: toRate.driver.me ? t('o.you') : toRate.driver.name }))}</span><b>${esc(t('rt.rate'))} ›</b></button>` : '';
      })()}
      <div class="home">
        <div class="need-row" role="radiogroup" aria-label="${esc(t('c.hello'))}">
          ${NEEDS.map(n => `<label class="need-chip"><input type="radio" name="need" id="h-need-${n}" value="${n}" data-bind="need"${d.need === n ? ' checked' : ''}><span><i class="need-ic need-${n}" aria-hidden="true"></i>${esc(t('need.' + n))}</span></label>`).join('')}
        </div>
        <section class="home-veh">
          ${V().tabs(d.vehicle, 'data-veh-tab')}
          ${V().stage(d.vehicle, 'data-veh-step')}
          <div class="veh-sum">
            <p>${esc(t('sum.' + d.vehicle))}</p>
            <button type="button" class="link-btn veh-how" data-veh-open="${d.vehicle}">${esc(t('vs.how'))} ›</button>
          </div>
        </section>
        <section class="addr-card">
          <div class="addr-row">
            <span class="addr-dot addr-dot-from" aria-hidden="true"></span>
            <div class="addr-fields">
              <label class="addr-label${d.loc === 'off' || d.loc === 'out' ? ' is-warn' : ''}" for="h-from">${esc(t(locLabel))}</label>
              <select id="h-from" data-bind="from">${ui.communeOptions(d.from)}</select>
            </div>
            <button type="button" class="addr-locate${d.loc === 'busy' ? ' is-busy' : ''}" data-act="locate" aria-label="${esc(t('loc.btn'))}" title="${esc(t('loc.btn'))}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
            </button>
          </div>
          <div class="addr-row addr-row-to">
            <span class="addr-dot addr-dot-to" aria-hidden="true"></span>
            <div class="addr-fields">
              <label class="addr-label" for="h-to">${esc(t('quote.to'))}</label>
              <select id="h-to" data-bind="to" class="${d.to ? '' : 'is-empty'}">
                <option value=""${d.to ? '' : ' selected'}>${esc(t('h.where'))}</option>${ui.communeOptions(d.to)}
              </select>
            </div>
          </div>
        </section>
        <p class="hint">${esc(t('h.hint'))}</p>
      </div>`;
  }

  function ordersView() {
    const mine = store.state.orders.filter(o => o.owner === 'me');
    const active = mine.filter(o => ACTIVE.includes(o.status));
    const past = mine.filter(o => !ACTIVE.includes(o.status));
    return `
      <section class="app-sec">
        <h1 class="app-title">${esc(t('c.history'))}</h1>
        ${active.length ? `<h2 class="app-h">${esc(t('c.active'))}</h2><div class="stack">${active.map(orderRow).join('')}</div>` : ''}
        ${past.length ? `<div class="stack">${past.map(orderRow).join('')}</div>` : active.length ? '' : `<p class="empty">${esc(t('c.noHistory'))}</p>`}
      </section>`;
  }

  // Barre du bas (client) : Commander / Mes courses.
  function bottomNav() {
    const section = { home: 'home', wizard: 'home', orders: 'orders', order: 'orders', me: 'me' }[view.name] || 'home';
    const item = (act, key, path) => `<button type="button" class="bn-item${section === act ? ' is-on' : ''}" data-act="${act}"${section === act ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><span>${esc(t(key))}</span></button>`;
    return `<nav class="bottom-nav" aria-label="${esc(t('role.client'))}">
      ${item('home', 'bn.order', 'M3 11 12 4l9 7v9h-6v-6H9v6H3z')}
      ${item('orders', 'c.history', 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4')}
      ${item('me', 'bn.me', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0')}
    </nav>`;
  }

  function orderRow(o) {
    return `<button class="order-row" type="button" data-act="open-order" data-id="${o.id}">
      <span class="order-row-main"><b>${route(o)}</b><small>${esc(t('need.' + o.need))} · ${esc(t('veh.' + o.vehicle))} · ${date(o.createdAt)}</small></span>
      <span class="order-row-side"><span class="mono">${fcfa(o.price)}</span>${pill(o.status)}</span>
    </button>`;
  }

  function tripSummary(d, kmVal) {
    return `<div class="trip-sum">
      <div class="trip-route">
        <span class="addr-dot addr-dot-from" aria-hidden="true"></span><b>${esc(commune(d.from).name)}</b>
        <span class="trip-arrow" aria-hidden="true">→</span>
        <span class="addr-dot addr-dot-to" aria-hidden="true"></span><b>${esc(commune(d.to).name)}</b>
      </div>
      <div class="trip-meta">
        <span class="trip-veh">${esc(t('veh.' + d.vehicle))}</span>
        <span class="mono">${ui.km(kmVal)}</span>
        <button type="button" class="link-btn" data-act="home">${esc(t('w.edit'))}</button>
      </div>
    </div>`;
  }

  // Suite de la commande : 3 = détails (aide, objets), 4 = prix et paiement.
  function wizard() {
    const d = view.draft, step = view.step;
    const q = draftQuote(d);
    const kmVal = distanceKm(d.from, d.to);
    const titles = { 3: 'w.s3', 4: 'w.s4' };
    let body = '';

    if (step === 3) {
      const handling = d.service === 'handling';
      const prices = servicePrices(d, kmVal);
      const spec = V().SPECS[d.vehicle];
      const est = estimatedKg(d), kg = loadKg(d);
      const over = kg > spec.payloadKg;
      const bigger = VEHICLES.find(v => V().SPECS[v.id].payloadKg >= kg);
      const svc = kind => `
        <label class="svc-card${d.service === kind ? ' is-on' : ''}">
          <input type="radio" name="service" id="w-svc-${kind}" value="${kind}" data-bind="service"${d.service === kind ? ' checked' : ''}>
          <span class="svc-check" aria-hidden="true"></span>
          <span class="svc-txt"><b>${esc(t('svc.' + kind))}</b><small>${esc(t('svc.' + kind + 'D'))}</small></span>
          <span class="svc-price"><b class="mono">${fmt(prices[kind])}</b><small>FCFA · ${esc(t('svc.from'))}</small></span>
        </label>`;
      const keys = V().PICK.filter(k => spec.items.some(([key]) => key === k) || (d.itemsQty[k] || 0) > 0);
      const rest = V().PICK.filter(k => !keys.includes(k));
      const pick = k => {
        const n = d.itemsQty[k] || 0;
        return `<li class="pick${n ? ' is-on' : ''}">
          <span class="pick-ic">${V().icon(k)}</span>
          <span class="pick-name">${esc(t('it.' + k))}</span>
          <span class="pick-ctr">
            <button type="button" data-act="item" data-k="${k}" data-d="-1" aria-label="− ${esc(t('it.' + k))}"${n ? '' : ' disabled'}>−</button>
            <b class="mono" aria-live="polite">${n}</b>
            <button type="button" data-act="item" data-k="${k}" data-d="1" aria-label="+ ${esc(t('it.' + k))}">+</button>
          </span></li>`;
      };
      body = `
        ${tripSummary(d, kmVal)}
        <div class="row-2">
          <label class="field"><span>${esc(t('w.fromDetail'))}</span><input id="w-fromDetail" data-bind="fromDetail" value="${esc(d.fromDetail)}" placeholder="${esc(t('w.detailPh'))}"></label>
          <label class="field"><span>${esc(t('w.toDetail'))}</span><input id="w-toDetail" data-bind="toDetail" value="${esc(d.toDetail)}" placeholder="${esc(t('w.detailPh'))}"></label>
        </div>

        <fieldset class="svc-list"><legend class="app-h">${esc(t('w.service'))}</legend>${svc('transport')}${svc('handling')}</fieldset>
        ${handling ? `
        <div class="reveal">
          <div class="row-3">
            ${counter('helpers', t('w.helpers'), d.helpers, 1, 6)}
            ${counter('floorsFrom', t('w.floorsFrom'), d.floorsFrom, 0, 20)}
            ${counter('floorsTo', t('w.floorsTo'), d.floorsTo, 0, 20)}
          </div>
          <label class="check"><input type="checkbox" id="w-elevator" data-bind="elevator"${d.elevator ? ' checked' : ''}><span>${esc(t('w.elevator'))}</span></label>
          <p class="hint">${esc(t('w.perHelper', { p: fcfa(TK.OPTIONS.helper) }))} · ${esc(t('w.perFloor', { p: fcfa(TK.OPTIONS.floor) }))}</p>
        </div>` : ''}

        <section class="items-pick">
          <h2 class="app-h">${esc(t('w.items'))} <small>${esc(t('w.optional'))}</small></h2>
          <ul class="pick-grid">${keys.map(pick).join('')}</ul>
          ${rest.length ? (view.moreItems
            ? `<ul class="pick-grid">${rest.map(pick).join('')}</ul>`
            : `<button type="button" class="link-btn" data-act="more-items">+ ${esc(t('w.moreItems'))}</button>`) : ''}
          <label class="field"><span>${esc(t('w.notes'))}</span><textarea id="w-notes" rows="2" data-bind="notes" placeholder="${esc(t('w.itemsPh'))}">${esc(d.notes)}</textarea></label>
        </section>

        <div class="weight-box${over ? ' is-over' : ''}">
          <div class="weight-top">
            <span>${esc(t('w.weight'))}</span>
            <b class="mono">${kg ? `≈ ${fmt(kg)} kg` : '—'}</b>
          </div>
          <div class="weight-bar" aria-hidden="true"><i style="width:${Math.min(100, Math.round(kg / spec.payloadKg * 100))}%"></i></div>
          <p class="hint">${esc(est ? t('w.weightCalc', { p: spec.payload }) : t('w.weightEmpty'))}</p>
          ${over ? `<p class="field-error">${esc(t('w.tooHeavy', { p: spec.payload }))}</p>
            ${bigger ? `<button type="button" class="btn btn-ghost btn-sm" data-act="upsize" data-v="${bigger.id}">${esc(t('w.switchTo', { v: t('veh.' + bigger.id) }))}</button>` : ''}` : ''}
          <label class="field field-inline"><span>${esc(t('w.weightFix'))}</span>
            <input id="w-weightManual" type="number" inputmode="numeric" min="0" step="10" data-bind="weightManual" value="${esc(d.weightManual || '')}" placeholder="kg" class="weight-input">
          </label>
        </div>`;
    }

    if (step === 4) {
      if (d.price == null || d.price < q.minimum) d.price = q.reference;
      const kg = loadKg(d);
      body = `
        <article class="ticket" aria-label="${esc(t('tk.title'))}">
          <div class="ticket-band"><span class="brand-name">takaata</span><span class="mono">${esc(t('tk.title'))}</span></div>
          <div class="ticket-main">
            <div class="ticket-route">
              <div><small>${esc(t('quote.from'))}</small><b class="ticket-code">${code(d.from)}</b><span>${esc(commune(d.from).name)}</span></div>
              <div class="ticket-line" aria-hidden="true"><i></i><span class="mono">${ui.km(kmVal)}</span></div>
              <div class="ta-r"><small>${esc(t('quote.to'))}</small><b class="ticket-code">${code(d.to)}</b><span>${esc(commune(d.to).name)}</span></div>
            </div>
            <dl class="ticket-meta">
              <div><dt>${esc(t('quote.vehicle'))}</dt><dd>${esc(t('veh.' + d.vehicle))}</dd></div>
              <div><dt>${esc(t('w.service'))}</dt><dd>${esc(t(d.service === 'handling' ? 'svc.handling' : 'svc.transport'))}${d.service === 'handling' ? ` · ${d.helpers}` : ''}</dd></div>
              <div><dt>${esc(t('w.weight'))}</dt><dd class="mono">${kg ? `≈ ${fmt(kg)} kg` : '—'}</dd></div>
            </dl>
          </div>
          <div class="ticket-tear" aria-hidden="true"></div>
          <dl class="ticket-prices">
            <div><dt>${esc(t('w.transport'))}</dt><dd class="mono">${fcfa(q.transport)}</dd></div>
            <div><dt>${esc(t('w.options'))}</dt><dd class="mono">${fcfa(q.options)}</dd></div>
            <div class="total"><dt>${esc(t('w.reference'))}</dt><dd class="mono">${fcfa(q.reference)}</dd></div>
            <div class="min"><dt>${esc(t('w.minimum'))}</dt><dd class="mono">${fcfa(q.minimum)}</dd></div>
          </dl>
        </article>
        <div class="price-box">
          <span class="label">${esc(t('w.yourPrice'))}</span>
          <div class="stepper">
            <button type="button" class="step-btn" data-act="price" data-d="-500" aria-label="−500"${d.price - 500 < q.minimum ? ' disabled' : ''}>−</button>
            <label class="price-input"><input id="w-price" type="number" inputmode="numeric" step="100" min="${q.minimum}" value="${d.price}" data-bind="price"><span>FCFA</span></label>
            <button type="button" class="step-btn" data-act="price" data-d="500" aria-label="+500">+</button>
          </div>
          <p class="hint">${esc(t('w.negotiate', { min: fcfa(q.minimum) }))}</p>
          <p class="field-error" id="w-price-err" hidden>${esc(t('w.belowMin', { min: fcfa(q.minimum) }))}</p>
        </div>
        <fieldset class="chips"><legend>${esc(t('w.when'))}</legend>
          <label class="chip-radio"><input type="radio" name="when" id="w-when-now" value="now" data-bind="when"${d.when === 'now' ? ' checked' : ''}><span>${esc(t('w.now'))}</span></label>
          <label class="chip-radio"><input type="radio" name="when" id="w-when-later" value="later" data-bind="when"${d.when === 'later' ? ' checked' : ''}><span>${esc(t('w.later'))}</span></label>
        </fieldset>
        ${d.when === 'later' ? `<label class="field"><span class="sr-only">${esc(t('w.later'))}</span><input type="datetime-local" id="w-whenAt" data-bind="whenAt" value="${esc(d.whenAt)}"></label>` : ''}
        <fieldset class="chips"><legend>${esc(t('w.payment'))}</legend>
          ${PAYMENTS.map(p => `<label class="chip-radio"><input type="radio" name="payment" id="w-pay-${p}" value="${p}" data-bind="payment"${d.payment === p ? ' checked' : ''}><span>${esc(t('pay.' + p))}</span></label>`).join('')}
        </fieldset>
        <p class="hint">${esc(t('w.priceNote'))}</p>`;
    }

    return `
      <section class="app-sec wizard">
        <div class="wiz-head">
          <button class="link-btn" type="button" data-act="${step === 3 ? 'home' : 'wiz-prev'}">← ${esc(t('w.prev'))}</button>
          <span class="mono">${esc(t('w.step', { n: step - 1 }))}</span>
        </div>
        <ol class="wiz-bar" aria-hidden="true">${[1, 2, 3].map(i => `<li class="${i <= step - 1 ? 'is-done' : ''}"></li>`).join('')}</ol>
        <h1 class="app-title">${esc(t(titles[step]))}</h1>
        <form class="wiz-form" id="wizForm" novalidate>${body}
          <div class="wiz-actions">
            <button class="btn btn-signal btn-block" type="submit">${esc(t(step === 4 ? 'w.publish' : 'w.next'))} · ${fcfa(step === 4 ? d.price : q.reference)}</button>
          </div>
        </form>
      </section>`;
  }

  function counter(field, label, value, min, max) {
    return `<div class="counter"><span>${esc(label)}</span>
      <div class="counter-in">
        <button type="button" data-act="count" data-f="${field}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="−"${value <= min ? ' disabled' : ''}>−</button>
        <b class="mono">${value}</b>
        <button type="button" data-act="count" data-f="${field}" data-d="1" data-min="${min}" data-max="${max}" aria-label="+"${value >= max ? ' disabled' : ''}>+</button>
      </div></div>`;
  }

  function orderView() {
    const o = store.getOrder(view.orderId);
    if (!o) { view.name = 'home'; return clientHome(); }
    const progress = PROGRESS[o.status];
    let main = '';

    if (o.status === 'open') {
      const offers = store.visibleOffers(o);
      main = `
        <div class="offers-head">
          <p class="${offers.length ? '' : 'pulse'}">${esc(offers.length ? t('o.offers', { n: offers.length }) : t('o.waiting'))}</p>
          <span class="mono">${esc(t('o.yourPrice', { p: fcfa(o.price) }))}</span>
        </div>
        <div class="stack">${offers.map(of => `
          <article class="offer${of.kind === 'accept' ? ' offer-accept' : ''}">
            <div class="offer-who">
              <span class="avatar" aria-hidden="true">${esc(of.name.split(' ').map(s => s[0]).join('').slice(0, 2))}</span>
              <div><b>${esc(of.me ? t('o.you') : of.name)}</b>
              <small><span class="stars" aria-label="${of.rating}/5">${stars(of.rating)}</span> ${of.rating.toFixed(1)} · ${esc(t('o.trips', { n: of.trips }))} · ${esc(t('o.away', { n: of.eta }))}</small></div>
            </div>
            <div class="offer-side">
              <span class="offer-kind">${esc(t(of.kind === 'accept' ? 'o.accepts' : 'o.counter'))}</span>
              <b class="mono offer-price">${fcfa(of.price)}</b>
              <button class="btn btn-signal btn-sm" type="button" data-act="choose" data-id="${of.id}">${esc(t('o.choose'))}</button>
            </div>
          </article>`).join('')}</div>
        ${cancelBlock(o)}`;
    } else if (o.status === 'cancelled') {
      main = `<p class="notice">${esc(o.cancelFree ? t('o.cancelFree') : t('o.cancelFee'))}</p>`;
    } else {
      const dv = o.driver;
      const steps = STATUSES.slice(1);
      const idx = steps.indexOf(o.status);
      main = `
        <article class="driver-card">
          <span class="avatar avatar-lg" aria-hidden="true">${esc(dv.name.split(' ').map(s => s[0]).join('').slice(0, 2))}</span>
          <div class="driver-info">
            <small>${esc(t('t.driver'))}</small>
            <b>${esc(dv.me ? t('o.you') : dv.name)}</b>
            <span><span class="stars">${stars(dv.rating)}</span> ${dv.rating.toFixed(1)} · ${esc(t('veh.' + o.vehicle))}</span>
          </div>
          <div class="plate mono" aria-label="Immatriculation">${esc(dv.plate)}</div>
        </article>
        <p class="phone-line">${esc(t('t.call'))} : <span class="mono select-all">${esc(dv.phone)}</span></p>

        <ol class="timeline">${steps.map((s, i) => `
          <li class="${i < idx || o.status === 'delivered' ? 'is-done' : i === idx ? 'is-now' : ''}">
            <span>${esc(t('status.' + s))}</span><small class="mono">${o.timeline[s] ? time(o.timeline[s]) : ''}</small>
          </li>`).join('')}</ol>

        <dl class="kv">
          <div><dt>${esc(t('t.agreed'))}</dt><dd class="mono">${fcfa(o.price)}</dd></div>
          <div><dt>${esc(t('w.payment'))}</dt><dd>${esc(t('pay.' + o.payment))}</dd></div>
        </dl>

        ${o.photos.start || o.photos.end ? `<p class="hint">${esc(t('dl.proofs', { a: o.photos.start, b: o.photos.end }))}</p>` : ''}

        ${o.status === 'arrived' ? `
          <div class="confirm-box">
            <p><b>${esc(t('dl.arrived'))}</b>${o.photos.end ? ' ' + esc(t('dl.proof', { n: o.photos.end })) : ''}</p>
            ${o.disputed ? `<p class="notice">${esc(t('dl.disputed'))}</p>`
              : `<p class="hint">${esc(t('dl.optional', { t: mmss((o.autoConfirmAt || Date.now()) - Date.now()) }))}</p>`}
            <button class="btn btn-signal btn-block" type="button" data-act="confirm" data-id="${o.id}">${esc(t('dl.ok'))}</button>
          </div>` : ''}

        ${o.sim && store.NEXT[o.status] ? `<button class="link-btn demo-btn" type="button" data-act="demo-next" data-id="${o.id}">${esc(t('t.demoNext'))} →</button>` : ''}

        ${o.status === 'delivered' && o.closedBy === 'auto' ? `<p class="notice">${esc(t('dl.auto'))}</p>` : ''}
        ${o.status === 'delivered' && o.closedBy === 'support' ? `<p class="notice">${esc(t('dl.support'))}</p>` : ''}
        ${o.status === 'delivered' ? rateBlock(o) + receipt(o) : ''}
        ${reportBlock(o)}
        ${['assigned', 'pickup'].includes(o.status) ? cancelBlock(o) : ''}`;
    }

    return `
      <section class="app-sec">
        <div class="wiz-head">
          <button class="link-btn" type="button" data-act="orders">← ${esc(t('c.history'))}</button>
          <span class="mono">${esc(o.id)}</span>
        </div>
        <div class="order-top">
          <h1 class="app-title">${route(o)}</h1>
          ${pill(o.status)}
        </div>
        <p class="sub">${esc(t('need.' + o.need))} · ${esc(t('veh.' + o.vehicle))} · <span class="mono">${ui.km(o.km)}</span></p>
        <div class="map-card">${ui.routeMap(o.from, o.to, progress)}</div>
        ${main}
      </section>`;
  }

  function photoInput(o, which, label) {
    return `<label class="photo-in">
      <input type="file" accept="image/*" multiple id="ph-${which}-${o.id}" data-act="photos" data-which="${which}" data-id="${o.id}">
      <span>${esc(label)}</span><small class="mono">${esc(t('t.photosCount', { n: o.photos[which] }))}</small>
    </label>`;
  }

  function cancelBlock(o) {
    const info = store.cancelInfo(o);
    if (!view.confirmCancel) return `<button class="link-btn danger" type="button" data-act="ask-cancel">${esc(t('o.cancel'))}</button>`;
    return `<div class="confirm-inline" role="alertdialog" aria-label="${esc(t('o.cancel'))}">
      <p>${esc(info.free ? t('o.cancelFree') : t('o.cancelFee'))}</p>
      <div class="btn-row">
        <button class="btn btn-danger btn-sm" type="button" data-act="cancel" data-id="${o.id}">${esc(t('o.confirmCancel'))}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="keep">${esc(t('o.keep'))}</button>
      </div></div>`;
  }

  function reportBlock(o) {
    if (view.reported) return `<p class="notice">${esc(t('t.reported'))}</p>`;
    if (!view.reportOpen) return `<button class="link-btn" type="button" data-act="report-open">${esc(t('t.report'))}</button>`;
    return `<form class="report" id="reportForm" data-id="${o.id}">
      <label class="field"><span>${esc(t('t.report'))}</span><textarea id="reportText" rows="3" required placeholder="${esc(t('t.reportPh'))}"></textarea></label>
      <button class="btn btn-ghost btn-sm" type="submit">${esc(t('t.send'))}</button>
    </form>`;
  }

  function receipt(o) {
    return `
      <div class="waybill waybill-app receipt">
        <div class="waybill-head"><span>${esc(t('r.receipt'))}</span><span class="mono">${esc(o.id)}</span></div>
        <dl class="waybill-lines">
          <div><dt>${esc(t('w.transport'))}</dt><dd class="mono">${fcfa(o.price - o.optionsPrice > 0 ? o.price - o.optionsPrice : o.price)}</dd></div>
          <div><dt>${esc(t('w.options'))}</dt><dd class="mono">${fcfa(Math.min(o.optionsPrice, o.price))}</dd></div>
          <div class="total"><dt>${esc(t('t.agreed'))}</dt><dd class="mono">${fcfa(o.price)}</dd></div>
          <div><dt>${esc(t('w.payment'))}</dt><dd>${esc(t('pay.' + o.payment))}</dd></div>
          <div><dt>${esc(t('status.delivered'))}</dt><dd class="mono">${date(o.timeline.delivered)} ${time(o.timeline.delivered)}</dd></div>
        </dl>
      </div>
      <button class="btn btn-ghost btn-block" type="button" data-act="again" data-id="${o.id}">${esc(t('r.again'))}</button>`;
  }

  // ---------- CHAUFFEUR ----------
  function driverView() {
    const d = store.state.driver;
    const avail = store.available();
    const mineActive = store.state.orders.filter(o => o.driver && o.driver.me && ['assigned', 'pickup', 'loading', 'transit', 'arrived'].includes(o.status));
    const open = store.state.orders.filter(o => o.status === 'open');
    const pending = open.filter(o => o.offers.some(of => of.me && !of.declined));
    const requests = open.filter(o => !pending.includes(o) && !(o.driver && o.driver.me));

    return `
      <section class="app-sec">
        <div class="wallet">
          <div class="wallet-head"><span>${esc(t('d.wallet'))}</span><span class="mono">${esc(d.name)}</span></div>
          <div class="wallet-nums">
            <div><small>${esc(t('d.balance'))}</small><b class="mono">${fmt(d.balance)}</b></div>
            <div><small>${esc(t('d.reserved'))}</small><b class="mono">${fmt(store.held())}</b></div>
            <div class="wallet-avail"><small>${esc(t('d.available'))}</small><b class="mono">${fmt(avail)}</b></div>
          </div>
          <div class="wallet-actions">
            <label class="field field-inline"><span class="sr-only">Mobile Money</span>
              <select id="rcChannel">${PAYMENTS.slice(1).map(p => `<option value="${p}">${esc(t('pay.' + p))}</option>`).join('')}</select>
            </label>
            ${[2000, 5000, 10000].map(n => `<button class="btn btn-light btn-sm" type="button" data-act="recharge" data-n="${n}">+${fmt(n)}</button>`).join('')}
          </div>
          ${avail < 2000 ? `<p class="wallet-alert">${esc(t('d.low'))}</p>` : ''}
          ${d.digitalEarnings ? `<p class="wallet-sub">${esc(t('d.digital'))} : <span class="mono">${fcfa(d.digitalEarnings)}</span></p>` : ''}
        </div>
        <div class="driver-prefs">
          <label class="field field-inline"><span>${esc(t('d.vehicle'))}</span>
            <select id="drvVehicle">${VEHICLES.map(v => `<option value="${v.id}"${v.id === d.vehicle ? ' selected' : ''}>${esc(t('veh.' + v.id))}</option>`).join('')}</select>
          </label>
          <span class="plate mono">${esc(d.plate)}</span>
        </div>
      </section>

      ${mineActive.length ? `<section class="app-sec"><h2 class="app-h">${esc(t('d.myCourse'))}</h2>${mineActive.map(driverCourse).join('')}</section>` : ''}

      ${pending.length ? `<section class="app-sec"><div class="stack">${pending.map(o => {
        const mine = o.offers.find(of => of.me && !of.declined);
        return `<div class="notice">${route(o)} · ${esc(t('d.offerSent', { p: fcfa(mine.price) }))}</div>`;
      }).join('')}</div></section>` : ''}

      <section class="app-sec">
        <h2 class="app-h">${esc(t('d.requests'))}</h2>
        ${requests.length ? `<div class="stack">${requests.map(requestCard).join('')}</div>` : `<p class="empty">${esc(t('d.noRequests'))}</p>`}
      </section>

      <section class="app-sec">
        <h2 class="app-h">${esc(t('d.ledger'))}</h2>
        ${d.ledger.length ? `<ol class="ledger-list">${d.ledger.slice(0, 30).map(l => `
          <li><span><b>${esc(t('l.' + l.type))}</b><small>${l.orderId ? esc(l.orderId) + ' · ' : ''}${l.channel ? esc(t('pay.' + l.channel)) + ' · ' : ''}${date(l.at)} ${time(l.at)}</small></span>
          <span class="mono ${['recharge', 'release'].includes(l.type) ? 'pos' : l.type === 'payout' ? 'neutral' : 'neg'}">${l.type === 'recharge' || l.type === 'release' ? '+' : l.type === 'payout' ? '' : '−'} ${fmt(l.amount)}</span></li>`).join('')}</ol>`
          : `<p class="empty">${esc(t('d.noLedger'))}</p>`}
      </section>`;
  }

  function requestCard(o) {
    const d = store.state.driver;
    const c = commission(o.price);
    const avail = store.available();
    const sameVehicle = o.vehicle === d.vehicle;
    const msg = view.offerMsg[o.id];
    const counterOpen = view.counterFor === o.id;
    return `
      <article class="request">
        <div class="request-top">
          <div><b>${route(o)}</b><small>${esc(t('need.' + o.need))} · <span class="mono">${ui.km(o.km)}</span> · ${esc(o.owner === 'me' ? t('role.client') : o.client || '')}</small></div>
          <b class="mono request-price">${fcfa(o.price)}</b>
        </div>
        <p class="request-items">${esc(o.items || '—')}${o.weight ? ` · ${esc(o.weight)}` : ''}</p>
        <p class="request-meta">${esc(t(o.service === 'handling' ? 'w.handling' : 'w.transportOnly'))}${o.service === 'handling' ? ` · ${esc(t('w.helpers'))} ${o.helpers}` : ''} · ${esc(t('pay.' + o.payment))}</p>
        <p class="request-meta mono">${esc(t('d.commission', { c: fcfa(c) }))} · ${esc(t('d.minPrice', { p: fcfa(o.minimum) }))}</p>
        ${!sameVehicle ? `<p class="hint">${esc(t('d.wrongVehicle', { v: t('veh.' + o.vehicle) }))}</p>` : `
          ${avail < c ? `<p class="field-error">${esc(t('d.need', { m: fcfa(c - avail) }))}</p>` : ''}
          ${msg ? `<p class="field-error">${esc(msg)}</p>` : ''}
          <div class="btn-row">
            <button class="btn btn-signal btn-sm" type="button" data-act="d-accept" data-id="${o.id}"${avail < c ? ' disabled' : ''}>${esc(t('d.accept', { p: fcfa(o.price) }))}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-act="d-counter-open" data-id="${o.id}">${esc(t('d.counter'))}</button>
          </div>
          ${counterOpen ? `<form class="counter-form" data-id="${o.id}">
            <label class="price-input"><input type="number" id="ctr-${o.id}" step="100" min="${o.minimum}" value="${TK.roundUp100(o.price * 1.1)}" inputmode="numeric"><span>FCFA</span></label>
            <button class="btn btn-signal btn-sm" type="submit">${esc(t('d.send'))}</button>
          </form>` : ''}`}
      </article>`;
  }

  function driverCourse(o) {
    const nextKey = store.NEXT[o.status] ? 'd.next.' + o.status : null;
    return `
      <article class="request request-active">
        <div class="request-top">
          <div><b>${route(o)}</b><small class="mono">${esc(o.id)}</small></div>
          ${pill(o.status)}
        </div>
        <div class="map-card">${ui.routeMap(o.from, o.to, PROGRESS[o.status])}</div>
        <p class="request-items">${esc(o.items || '—')}</p>
        <p class="request-meta">${esc(t('d.client'))} : ${esc(o.owner === 'me' ? t('role.client') : o.client || '')}${o.fromDetail ? ` · ${esc(o.fromDetail)}` : ''}</p>
        <p class="notice">${esc(o.payment === 'cash'
          ? t('d.cashHint', { p: fcfa(o.price), c: fcfa(o.commission) })
          : t('d.mmHint', { m: t('pay.' + o.payment), n: fcfa(o.price - o.commission) }))}</p>
        ${['loading', 'transit', 'arrived'].includes(o.status) ? `
        <div class="photo-row">
          ${photoInput(o, 'start', t('t.photosStart'))}
          ${['transit', 'arrived'].includes(o.status) ? photoInput(o, 'end', t('t.photosEnd')) : ''}
        </div>
        <p class="hint">${esc(t('d.proofHint'))}</p>` : ''}
        ${nextKey ? `<button class="btn btn-signal btn-block" type="button" data-act="d-next" data-id="${o.id}">${esc(t(nextKey))}</button>` : ''}
        ${o.status === 'arrived' ? `<p class="hint">${esc(t('d.waitClient'))}${o.autoConfirmAt ? ' ' + esc(t('d.autoIn', { t: mmss(o.autoConfirmAt - Date.now()) })) : ''}</p>
          ${o.owner === 'me' ? `<button class="link-btn demo-btn" type="button" data-act="confirm" data-id="${o.id}">${esc(t('d.clientConfirm'))}</button>` : ''}` : ''}
      </article>`;
  }

  // ---------- ADMIN ----------
  function adminView() {
    const s = store.state;
    const delivered = s.orders.filter(o => o.status === 'delivered');
    const gmv = delivered.reduce((a, o) => a + o.price, 0);
    const comm = delivered.reduce((a, o) => a + o.commission, 0);
    const led = s.driver.ledger;
    const recharges = led.filter(l => l.type === 'recharge').reduce((a, l) => a + l.amount, 0);
    const debits = led.filter(l => l.type === 'debit').reduce((a, l) => a + l.amount, 0);
    const expected = recharges - debits;
    const kpis = [
      ['a.done', fmt(delivered.length)], ['a.gmv', fcfa(gmv)], ['a.comm', fcfa(comm)],
      ['a.avg', delivered.length ? fcfa(gmv / delivered.length) : '—'],
      ['a.open', fmt(s.orders.filter(o => o.status === 'open').length)],
      ['a.cancel', fmt(s.orders.filter(o => o.status === 'cancelled').length)]
    ];
    return `
      <section class="app-sec">
        <div class="kpis">${kpis.map(([k, v]) => `<div class="kpi"><small>${esc(t(k))}</small><b class="mono">${v}</b></div>`).join('')}</div>
      </section>
      <section class="app-sec">
        <h2 class="app-h">${esc(t('a.orders'))}</h2>
        ${s.orders.length ? `<div class="table-scroll"><table class="grid-table compact">
          <thead><tr><th>${esc(t('a.colId'))}</th><th>${esc(t('a.colRoute'))}</th><th>${esc(t('a.colVehicle'))}</th><th>${esc(t('a.colPrice'))}</th><th>${esc(t('a.colPay'))}</th><th>${esc(t('a.colStatus'))}</th></tr></thead>
          <tbody>${s.orders.map(o => `<tr><td class="mono">${esc(o.id)}</td><td>${route(o)}</td><td>${esc(t('veh.' + o.vehicle))}</td><td class="mono">${fmt(o.price)}</td><td>${esc(t('pay.' + o.payment))}</td><td>${pill(o.status)}</td></tr>`).join('')}</tbody>
        </table></div>` : `<p class="empty">${esc(t('a.noOrders'))}</p>`}
      </section>
      <section class="app-sec">
        <h2 class="app-h">${esc(t('a.recon'))} · ${esc(s.driver.name)}</h2>
        <dl class="kv">
          <div><dt>${esc(t('a.reconRecharges'))}</dt><dd class="mono">${fcfa(recharges)}</dd></div>
          <div><dt>${esc(t('a.reconDebits'))}</dt><dd class="mono">− ${fcfa(debits)}</dd></div>
          <div><dt>${esc(t('a.reconExpected'))}</dt><dd class="mono">${fcfa(expected)}</dd></div>
          <div><dt>${esc(t('a.reconActual'))}</dt><dd class="mono">${fcfa(s.driver.balance)}</dd></div>
        </dl>
        <p class="${expected === s.driver.balance ? 'ok-line' : 'ko-line'}">${esc(t(expected === s.driver.balance ? 'a.reconOk' : 'a.reconKo'))}</p>
      </section>
      <section class="app-sec">
        <h2 class="app-h">${esc(t('a.reports'))}</h2>
        ${s.reports.length ? `<ol class="ledger-list">${s.reports.map(r => {
          const o = r.orderId && store.getOrder(r.orderId);
          return `<li><span><b class="mono">${esc(r.orderId || '—')}</b><small>${esc(r.text)}</small>
            ${o && o.status === 'arrived' ? `<button class="btn btn-ghost btn-sm" type="button" data-act="support-close" data-id="${o.id}">${esc(t('a.supportClose'))}</button>` : ''}</span><span class="mono">${date(r.at)}</span></li>`;
        }).join('')}</ol>` : `<p class="empty">${esc(t('a.noReports'))}</p>`}
      </section>
      <section class="app-sec">
        ${view.confirmReset ? `<div class="confirm-inline"><p>${esc(t('a.resetConfirm'))}</p><div class="btn-row">
          <button class="btn btn-danger btn-sm" type="button" data-act="reset-yes">${esc(t('a.resetYes'))}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="reset-no">${esc(t('a.resetNo'))}</button></div></div>`
          : `<button class="link-btn danger" type="button" data-act="reset-ask">${esc(t('a.reset'))}</button>`}
      </section>`;
  }

  // ---------- COMPTE CLIENT : inscription, connexion, « Moi » ----------
  TK.addStrings({
    fr: {
      'bn.me': 'Moi',
      'au.signupT': 'Créer mon compte', 'au.signupS': 'Votre numéro suffit pour commander. Vous recevrez un code par SMS.',
      'au.loginT': 'Se connecter', 'au.loginS': 'Entrez le numéro de votre compte Takaata.',
      'au.first': 'Prénom', 'au.last': 'Nom', 'au.phone': 'Numéro de téléphone',
      'au.getCode': 'Recevoir mon code', 'au.continue': 'Continuer', 'au.haveAccount': "J'ai déjà un compte · Se connecter",
      'au.noAccount': 'Pas encore de compte ? Créer un compte', 'au.badPhone': 'Numéro ivoirien à 10 chiffres, par exemple 07 48 21 63 90.',
      'au.badName': 'Indiquez votre prénom et votre nom.', 'au.exists': 'Un compte existe déjà avec ce numéro. Connectez-vous.',
      'au.unknown': 'Aucun compte avec ce numéro. Créez un compte.',
      'au.otpT': 'Code de vérification', 'au.otpS': 'Saisissez le code à 6 chiffres envoyé au {p}.',
      'au.demoCode': 'Prototype : aucun SMS n’est envoyé. Votre code est {c}.', 'au.verify': 'Valider',
      'au.resend': 'Renvoyer le code', 'au.resendIn': 'Renvoyer le code dans {s} s', 'au.editPhone': 'Modifier le numéro',
      'au.badOtp': 'Code incorrect. Vérifiez les 6 chiffres.', 'au.expired': 'Code expiré. Demandez un nouveau code.',
      'au.helloT': 'Bonjour {n}', 'au.chooseS': 'Comment voulez-vous vous connecter ?', 'au.bySms': 'Recevoir un code par SMS',
      'au.byPass': 'Utiliser mon mot de passe', 'au.passT': 'Mot de passe', 'au.password': 'Mot de passe', 'au.signin': 'Se connecter',
      'au.badPass': 'Mot de passe incorrect.', 'au.forgot': 'Mot de passe oublié ? Recevoir un code',
      'au.setPassT': 'Choisir un mot de passe', 'au.setPassS': 'Facultatif : pour vous connecter sans attendre de SMS.',
      'au.newPass': 'Nouveau mot de passe (6 caractères minimum)', 'au.save': 'Enregistrer', 'au.later': 'Plus tard',
      'au.shortPass': 'Le mot de passe doit faire au moins 6 caractères.', 'au.welcome': 'Bienvenue {n}',
      'me.newClient': 'Nouveau client', 'me.notes': '{n} notes de chauffeurs', 'me.note1': '1 note de chauffeur', 'me.trips': 'Courses', 'me.spent': 'Dépensé', 'me.coupons': 'Coupons',
      'me.edit': 'Modifier', 'me.photo': 'Photo', 'me.back': 'Moi',
      'me.m.coupons': 'Coupons', 'me.m.invoices': 'Factures et reçus', 'me.m.support': 'Service client', 'me.m.invite': 'Parrainer un proche',
      'me.m.settings': 'Paramètres', 'me.m.profile': 'Mon profil', 'me.logout': 'Se déconnecter', 'me.logoutQ': 'Se déconnecter de Takaata sur cet appareil ?',
      'me.couponName': 'Bienvenue', 'me.couponD': 'Sur votre première course terminée · offre du pilote, dans la limite des 200 premières courses',
      'me.couponOk': 'Disponible', 'me.couponNote': 'Le coupon sera déduit automatiquement au paiement dès le lancement.',
      'me.noInvoices': 'Vos reçus apparaîtront ici après votre première course livrée.',
      'me.supportPhone': 'Numéro du service client', 'me.tbd': 'À définir au lancement', 'me.faq': 'Questions fréquentes',
      'me.write': 'Écrire au support', 'me.writePh': 'Votre question ou votre problème', 'me.sent': 'Message envoyé. Réponse sous un jour ouvré.',
      'me.myMsgs': 'Mes messages', 'me.inviteS': 'Partagez votre code : votre proche le saisit à l’inscription.',
      'me.inviteNote': 'Le parrainage est récompensé seulement après une première course terminée. Le montant sera annoncé au lancement.',
      'me.copy': 'Copier', 'me.copied': 'Code copié',
      'me.lang': 'Langue', 'me.notif': 'Notifications de course (offres, arrivée du chauffeur)', 'me.pass': 'Mot de passe',
      'me.passSet': 'Changer le mot de passe', 'me.passNone': 'Définir un mot de passe', 'me.passSaved': 'Mot de passe enregistré',
      'me.phoneFixed': 'Pour changer de numéro, contactez le service client.', 'me.saved': 'Profil enregistré',
      'dl.arrived': 'Le chauffeur est arrivé à destination.', 'dl.proof': 'Il a ajouté {n} photo(s) de livraison comme preuve.',
      'dl.optional': 'Vérifiez vos biens. La confirmation est facultative : sans réponse, la course est clôturée automatiquement dans {t}.',
      'dl.ok': 'Tout est en ordre', 'dl.disputed': 'Signalement reçu : la clôture automatique est suspendue. Le support vous contacte.',
      'dl.auto': 'Course clôturée automatiquement, sans réponse de votre part, sur la preuve de livraison du chauffeur.',
      'dl.support': 'Livraison validée par le support après examen.', 'dl.proofs': 'Preuves du chauffeur : {a} photo(s) au chargement, {b} à la livraison.',
      'rt.q': 'Comment s’est passée la course avec {n} ?', 'rt.w1': 'Très mauvais', 'rt.w2': 'Mauvais', 'rt.w3': 'Moyen', 'rt.w4': 'Bien', 'rt.w5': 'Excellent',
      'rt.why': 'Qu’avez-vous apprécié ?', 'rt.whyBad': 'Qu’est-ce qui n’allait pas ?', 'rt.send': 'Envoyer la note', 'rt.thanks': 'Merci, votre note aide les autres clients.',
      'rt.pending': 'Notez votre course avec {n}', 'rt.rate': 'Noter',
      'tag.punctual': 'Ponctuel', 'tag.careful': 'Soigneux avec mes biens', 'tag.friendly': 'Aimable', 'tag.driving': 'Conduite prudente', 'tag.helpful': 'A aidé au chargement',
      'tag.late': 'En retard', 'tag.damage': 'Objets abîmés', 'tag.rude': 'Impoli', 'tag.unsafe': 'Conduite dangereuse', 'tag.price': 'A demandé plus que le prix convenu',
      'd.proofHint': 'Photos = preuve en cas de litige, et clôture de la course si le client ne répond pas.',
      'd.autoIn': 'Sans réponse du client, clôture automatique dans {t}.', 'a.supportClose': 'Valider la livraison (support)'
    },
    en: {
      'bn.me': 'Me',
      'au.signupT': 'Create my account', 'au.signupS': 'Your phone number is all you need. You will get a code by SMS.',
      'au.loginT': 'Sign in', 'au.loginS': 'Enter the number of your Takaata account.',
      'au.first': 'First name', 'au.last': 'Last name', 'au.phone': 'Phone number',
      'au.getCode': 'Get my code', 'au.continue': 'Continue', 'au.haveAccount': 'I already have an account · Sign in',
      'au.noAccount': 'No account yet? Create one', 'au.badPhone': 'Ivorian 10-digit number, for example 07 48 21 63 90.',
      'au.badName': 'Enter your first and last name.', 'au.exists': 'An account already uses this number. Please sign in.',
      'au.unknown': 'No account with this number. Create an account.',
      'au.otpT': 'Verification code', 'au.otpS': 'Enter the 6-digit code sent to {p}.',
      'au.demoCode': 'Prototype: no SMS is sent. Your code is {c}.', 'au.verify': 'Verify',
      'au.resend': 'Resend the code', 'au.resendIn': 'Resend the code in {s} s', 'au.editPhone': 'Change number',
      'au.badOtp': 'Wrong code. Check the 6 digits.', 'au.expired': 'Code expired. Request a new one.',
      'au.helloT': 'Hello {n}', 'au.chooseS': 'How do you want to sign in?', 'au.bySms': 'Get a code by SMS',
      'au.byPass': 'Use my password', 'au.passT': 'Password', 'au.password': 'Password', 'au.signin': 'Sign in',
      'au.badPass': 'Wrong password.', 'au.forgot': 'Forgot your password? Get a code',
      'au.setPassT': 'Choose a password', 'au.setPassS': 'Optional: sign in without waiting for an SMS.',
      'au.newPass': 'New password (at least 6 characters)', 'au.save': 'Save', 'au.later': 'Later',
      'au.shortPass': 'The password must be at least 6 characters.', 'au.welcome': 'Welcome {n}',
      'me.newClient': 'New customer', 'me.notes': '{n} driver ratings', 'me.note1': '1 driver rating', 'me.trips': 'Trips', 'me.spent': 'Spent', 'me.coupons': 'Coupons',
      'me.edit': 'Edit', 'me.photo': 'Photo', 'me.back': 'Me',
      'me.m.coupons': 'Coupons', 'me.m.invoices': 'Invoices and receipts', 'me.m.support': 'Customer service', 'me.m.invite': 'Invite someone',
      'me.m.settings': 'Settings', 'me.m.profile': 'My profile', 'me.logout': 'Sign out', 'me.logoutQ': 'Sign out of Takaata on this device?',
      'me.couponName': 'Welcome', 'me.couponD': 'On your first completed trip · pilot offer, limited to the first 200 trips',
      'me.couponOk': 'Available', 'me.couponNote': 'The coupon will be deducted automatically at payment from launch.',
      'me.noInvoices': 'Your receipts will appear here after your first delivered trip.',
      'me.supportPhone': 'Customer service number', 'me.tbd': 'To be set at launch', 'me.faq': 'Frequently asked questions',
      'me.write': 'Write to support', 'me.writePh': 'Your question or problem', 'me.sent': 'Message sent. Reply within one business day.',
      'me.myMsgs': 'My messages', 'me.inviteS': 'Share your code: they enter it when signing up.',
      'me.inviteNote': 'Referrals are rewarded only after a first completed trip. The amount will be announced at launch.',
      'me.copy': 'Copy', 'me.copied': 'Code copied',
      'me.lang': 'Language', 'me.notif': 'Trip notifications (offers, driver arrival)', 'me.pass': 'Password',
      'me.passSet': 'Change password', 'me.passNone': 'Set a password', 'me.passSaved': 'Password saved',
      'me.phoneFixed': 'To change your number, contact customer service.', 'me.saved': 'Profile saved',
      'dl.arrived': 'The driver has arrived at the destination.', 'dl.proof': 'They added {n} delivery photo(s) as proof.',
      'dl.optional': 'Check your goods. Confirming is optional: without a reply, the trip closes automatically in {t}.',
      'dl.ok': 'Everything is fine', 'dl.disputed': 'Report received: automatic closing is paused. Support will contact you.',
      'dl.auto': 'Trip closed automatically, without a reply from you, based on the driver’s proof of delivery.',
      'dl.support': 'Delivery validated by support after review.', 'dl.proofs': 'Driver’s proof: {a} photo(s) at loading, {b} at delivery.',
      'rt.q': 'How was your trip with {n}?', 'rt.w1': 'Very bad', 'rt.w2': 'Bad', 'rt.w3': 'Average', 'rt.w4': 'Good', 'rt.w5': 'Excellent',
      'rt.why': 'What did you like?', 'rt.whyBad': 'What went wrong?', 'rt.send': 'Send rating', 'rt.thanks': 'Thank you, your rating helps other customers.',
      'rt.pending': 'Rate your trip with {n}', 'rt.rate': 'Rate',
      'tag.punctual': 'On time', 'tag.careful': 'Careful with my goods', 'tag.friendly': 'Friendly', 'tag.driving': 'Safe driving', 'tag.helpful': 'Helped with loading',
      'tag.late': 'Late', 'tag.damage': 'Damaged items', 'tag.rude': 'Rude', 'tag.unsafe': 'Dangerous driving', 'tag.price': 'Asked for more than the agreed price',
      'd.proofHint': 'Photos = proof in case of dispute, and they close the trip if the customer does not reply.',
      'd.autoIn': 'Without a reply from the customer, automatic closing in {t}.', 'a.supportClose': 'Validate delivery (support)'
    }
  });

  const TAGS_GOOD = ['punctual', 'careful', 'friendly', 'driving', 'helpful'];
  const TAGS_BAD = ['late', 'damage', 'rude', 'unsafe', 'price'];
  const PHONE_RE = /^(01|05|07|21|25|27)\d{8}$/;
  const OTP_TTL = 5 * 60 * 1000, RESEND_S = 30;
  const fmtPhone = p => '+225 ' + String(p).replace(/(\d{2})(?=\d)/g, '$1 ');
  const initials = n => esc(String(n).split(' ').map(s => s[0] || '').join('').slice(0, 2).toUpperCase());
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  async function hashPass(phone, pass) {
    const data = new TextEncoder().encode(`takaata:${phone}:${pass}`);
    try {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return 'raw:' + btoa(unescape(encodeURIComponent(pass))); }
  }

  function sendOtp() {
    const a = view.auth;
    a.otp = String(Math.floor(100000 + Math.random() * 900000));
    a.otpAt = Date.now();
    a.step = 'otp';
    a.err = '';
  }

  function authView() {
    const a = view.auth;
    const err = a.err ? `<p class="field-error" role="alert">${esc(a.err)}</p>` : '';
    const head = (title, sub) => `<div class="auth-head"><span class="brand-mark auth-mark" aria-hidden="true"></span>
      <h1 class="app-title">${esc(title)}</h1><p class="sub">${esc(sub)}</p></div>`;
    const phoneField = `<label class="field"><span>${esc(t('au.phone'))}</span>
      <span class="phone-in"><b class="mono">+225</b><input id="auth-phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" value="${esc(a.phone || '')}" placeholder="07 00 00 00 00" required></span></label>`;
    let body = '';
    if (a.step === 'form' && a.mode === 'signup') {
      body = `${head(t('au.signupT'), t('au.signupS'))}
        <form class="auth-form" id="authForm" novalidate>
          <div class="row-2">
            <label class="field"><span>${esc(t('au.first'))}</span><input id="auth-first" autocomplete="given-name" value="${esc(a.first || '')}" required></label>
            <label class="field"><span>${esc(t('au.last'))}</span><input id="auth-last" autocomplete="family-name" value="${esc(a.last || '')}" required></label>
          </div>
          ${phoneField}${err}
          <button class="btn btn-signal btn-block" type="submit">${esc(t('au.getCode'))}</button>
        </form>
        <button class="link-btn auth-switch" type="button" data-act="auth-mode" data-mode="login">${esc(t('au.haveAccount'))}</button>`;
    } else if (a.step === 'form') {
      body = `${head(t('au.loginT'), t('au.loginS'))}
        <form class="auth-form" id="authForm" novalidate>${phoneField}${err}
          <button class="btn btn-signal btn-block" type="submit">${esc(t('au.continue'))}</button>
        </form>
        <button class="link-btn auth-switch" type="button" data-act="auth-mode" data-mode="signup">${esc(t('au.noAccount'))}</button>`;
    } else if (a.step === 'choose') {
      const acc = store.account(a.phone);
      body = `${head(t('au.helloT', { n: acc.firstName }), t('au.chooseS'))}
        <div class="auth-form">
          <button class="btn btn-signal btn-block" type="button" data-act="auth-sms">${esc(t('au.bySms'))}</button>
          <button class="btn btn-ghost btn-block" type="button" data-act="auth-pass">${esc(t('au.byPass'))}</button>
        </div>
        <button class="link-btn auth-switch" type="button" data-act="auth-edit">${esc(t('au.editPhone'))}</button>`;
    } else if (a.step === 'otp') {
      const wait = RESEND_S - Math.floor((Date.now() - a.otpAt) / 1000);
      body = `${head(t('au.otpT'), t('au.otpS', { p: fmtPhone(a.phone) }))}
        <p class="notice">${esc(t('au.demoCode', { c: a.otp }))}</p>
        <form class="auth-form" id="authForm" novalidate>
          <label class="field"><span class="sr-only">${esc(t('au.otpT'))}</span>
            <input id="auth-otp" class="otp-in mono" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required></label>
          ${err}
          <button class="btn btn-signal btn-block" type="submit">${esc(t('au.verify'))}</button>
        </form>
        <div class="auth-links">
          <button class="link-btn" type="button" data-act="auth-resend"${wait > 0 ? ' disabled' : ''}>${esc(wait > 0 ? t('au.resendIn', { s: wait }) : t('au.resend'))}</button>
          <button class="link-btn" type="button" data-act="auth-edit">${esc(t('au.editPhone'))}</button>
        </div>`;
    } else if (a.step === 'password') {
      body = `${head(t('au.passT'), fmtPhone(a.phone))}
        <form class="auth-form" id="authForm" novalidate>
          <label class="field"><span>${esc(t('au.password'))}</span><input id="auth-pass" type="password" autocomplete="current-password" required></label>
          ${err}
          <button class="btn btn-signal btn-block" type="submit">${esc(t('au.signin'))}</button>
        </form>
        <button class="link-btn auth-switch" type="button" data-act="auth-sms">${esc(t('au.forgot'))}</button>`;
    } else if (a.step === 'setpass') {
      body = `${head(t('au.setPassT'), t('au.setPassS'))}
        <form class="auth-form" id="authForm" novalidate>
          <label class="field"><span>${esc(t('au.newPass'))}</span><input id="auth-newpass" type="password" autocomplete="new-password" minlength="6"></label>
          ${err}
          <button class="btn btn-signal btn-block" type="submit">${esc(t('au.save'))}</button>
        </form>
        <button class="link-btn auth-switch" type="button" data-act="auth-skip">${esc(t('au.later'))}</button>`;
    }
    return `<section class="app-sec auth">${body}</section>`;
  }

  async function submitAuth() {
    const a = view.auth;
    const val = id => (document.getElementById(id) || {}).value || '';
    if (a.step === 'form') {
      a.phone = val('auth-phone').replace(/\D/g, '').replace(/^225(?=\d{10}$)/, '');
      if (a.mode === 'signup') { a.first = val('auth-first').trim(); a.last = val('auth-last').trim(); }
      if (a.mode === 'signup' && (!a.first || !a.last)) { a.err = t('au.badName'); return render(); }
      if (!PHONE_RE.test(a.phone)) { a.err = t('au.badPhone'); return render(); }
      const acc = store.account(a.phone);
      if (a.mode === 'signup' && acc) { Object.assign(a, { mode: 'login', err: t('au.exists') }); return render(); }
      if (a.mode === 'login' && !acc) { Object.assign(a, { mode: 'signup', err: t('au.unknown') }); return render(); }
      if (a.mode === 'login' && acc.passHash) { a.step = 'choose'; a.err = ''; return render(); }
      sendOtp();
      return render();
    }
    if (a.step === 'otp') {
      const code = val('auth-otp').replace(/\D/g, '');
      if (Date.now() - a.otpAt > OTP_TTL) { a.err = t('au.expired'); return render(); }
      if (code !== a.otp) { a.err = t('au.badOtp'); return render(); }
      if (a.mode === 'signup') {
        store.register({ phone: a.phone, firstName: a.first, lastName: a.last, coupons: [{ code: 'BIENVENUE', amount: 1000, used: false }] });
        view.auth = { mode: 'signup', step: 'setpass', phone: a.phone };
        return render();
      }
      store.login(a.phone);
      return finishAuth();
    }
    if (a.step === 'password') {
      const acc = store.account(a.phone);
      if (acc && acc.passHash === await hashPass(a.phone, val('auth-pass'))) { store.login(a.phone); return finishAuth(); }
      a.err = t('au.badPass');
      return render();
    }
    if (a.step === 'setpass') {
      const p = val('auth-newpass');
      if (p.length < 6) { a.err = t('au.shortPass'); return render(); }
      store.updateUser({ passHash: await hashPass(a.phone, p) });
      return finishAuth();
    }
  }

  function finishAuth() {
    view.auth = { mode: 'signup', step: 'form' };
    const u = store.user();
    go('home');
    if (u) ui.toast(t('au.welcome', { n: u.firstName }));
  }

  // Photo de profil : redimensionnée (160 px) avant d'être enregistrée.
  function readPhoto(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160, c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        store.updateUser({ photo: c.toDataURL('image/jpeg', 0.82) });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function avatar(u, cls) {
    return u.photo
      ? `<img class="${cls}" src="${u.photo}" alt="">`
      : `<span class="${cls} avatar-ini" aria-hidden="true">${initials(u.firstName + ' ' + u.lastName)}</span>`;
  }

  const MENU_ICONS = {
    coupons: 'M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM10 7v12',
    invoices: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    support: 'M4 13a8 8 0 0 1 16 0v4h-4v-5h4M4 12h4v5H4zM16 17a4 4 0 0 1-4 3',
    invite: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 1.9L6 8.2 4 8l-1 3 2 1v0l-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-1.9 1.3-1.3 2 .2 1-3z'
  };

  function meView() {
    const u = store.user();
    const sub = view.meSub;
    const mine = store.state.orders.filter(o => o.owner === 'me' && o.status === 'delivered');
    const back = `<button class="link-btn" type="button" data-act="me-sub" data-sub="">← ${esc(t('me.back'))}</button>`;
    const coupons = (u.coupons || []).filter(c => !c.used);

    if (sub === 'coupons') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('me.m.coupons'))}</h1>
        ${coupons.length ? coupons.map(c => `<article class="coupon">
          <div class="coupon-val"><b class="mono">− ${fmt(c.amount)}</b><small>FCFA</small></div>
          <div class="coupon-txt"><b>${esc(t('me.couponName'))} <span class="mono">${esc(c.code)}</span></b><small>${esc(t('me.couponD'))}</small><span class="pill pill-delivered">${esc(t('me.couponOk'))}</span></div>
        </article>`).join('') : `<p class="empty">—</p>`}
        <p class="hint">${esc(t('me.couponNote'))}</p></section>`;
    }
    if (sub === 'invoices') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('me.m.invoices'))}</h1>
        ${mine.length ? `<div class="stack">${mine.map(orderRow).join('')}</div>` : `<p class="empty">${esc(t('me.noInvoices'))}</p>`}</section>`;
    }
    if (sub === 'support') {
      const msgs = store.state.reports.filter(r => r.phone === u.phone);
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('me.m.support'))}</h1>
        <dl class="kv"><div><dt>${esc(t('me.supportPhone'))}</dt><dd>${esc(t('me.tbd'))}</dd></div></dl>
        <a class="me-link" href="#faq">${esc(t('me.faq'))} ›</a>
        ${view.supportSent ? `<p class="notice">${esc(t('me.sent'))}</p>` : `
        <form class="report" id="supportForm">
          <label class="field"><span>${esc(t('me.write'))}</span><textarea id="supportText" rows="3" required placeholder="${esc(t('me.writePh'))}"></textarea></label>
          <button class="btn btn-signal btn-sm" type="submit">${esc(t('t.send'))}</button>
        </form>`}
        ${msgs.length ? `<h2 class="app-h">${esc(t('me.myMsgs'))}</h2><ol class="ledger-list">${msgs.map(r => `<li><span><b>${esc(r.orderId || t('me.m.support'))}</b><small>${esc(r.text)}</small></span><span class="mono">${date(r.at)}</span></li>`).join('')}</ol>` : ''}
      </section>`;
    }
    if (sub === 'invite') {
      const codeStr = `${u.firstName.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}-${u.phone.slice(-4)}`;
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('me.m.invite'))}</h1>
        <p class="sub">${esc(t('me.inviteS'))}</p>
        <div class="invite-code"><b class="mono select-all" id="inviteCode">${esc(codeStr)}</b>
          <button class="btn btn-signal btn-sm" type="button" data-act="copy-code" data-code="${esc(codeStr)}">${esc(t('me.copy'))}</button></div>
        <p class="hint">${esc(t('me.inviteNote'))}</p></section>`;
    }
    if (sub === 'settings') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('me.m.settings'))}</h1>
        <fieldset class="chips"><legend>${esc(t('me.lang'))}</legend>
          <button type="button" class="chip-btn${TK.getLang() === 'fr' ? ' is-on' : ''}" data-act="set-lang" data-lang="fr">Français</button>
          <button type="button" class="chip-btn${TK.getLang() === 'en' ? ' is-on' : ''}" data-act="set-lang" data-lang="en">English</button>
        </fieldset>
        <label class="check"><input type="checkbox" id="set-notif"${u.notif ? ' checked' : ''}><span>${esc(t('me.notif'))}</span></label>
        <form class="report" id="passForm">
          <label class="field"><span>${esc(t(u.passHash ? 'me.passSet' : 'me.passNone'))}</span>
            <input id="set-pass" type="password" autocomplete="new-password" minlength="6" placeholder="${esc(t('au.newPass'))}"></label>
          <p class="field-error" id="set-pass-err" hidden>${esc(t('au.shortPass'))}</p>
          <button class="btn btn-ghost btn-sm" type="submit">${esc(t('au.save'))}</button>
        </form>
        ${logoutBlock()}
      </section>`;
    }
    if (sub === 'profile') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('me.m.profile'))}</h1>
        <form class="auth-form" id="profileForm">
          <div class="row-2">
            <label class="field"><span>${esc(t('au.first'))}</span><input id="pf-first" value="${esc(u.firstName)}" required></label>
            <label class="field"><span>${esc(t('au.last'))}</span><input id="pf-last" value="${esc(u.lastName)}" required></label>
          </div>
          <label class="field"><span>${esc(t('au.phone'))}</span><input value="${esc(fmtPhone(u.phone))}" disabled></label>
          <p class="hint">${esc(t('me.phoneFixed'))}</p>
          <button class="btn btn-signal btn-block" type="submit">${esc(t('au.save'))}</button>
        </form></section>`;
    }

    const spent = mine.reduce((a, o) => a + o.price, 0);
    const item = (key, extra) => `<li><button type="button" class="me-item" data-act="me-sub" data-sub="${key}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${MENU_ICONS[key]}"/></svg><span>${esc(t('me.m.' + key))}</span>${extra || ''}<i aria-hidden="true">›</i></button></li>`;
    return `
      <section class="app-sec">
        <div class="me-head">
          <label class="me-photo" title="${esc(t('me.photo'))}">
            ${avatar(u, 'me-avatar')}
            <input type="file" accept="image/*" id="me-photo-in" data-act="me-photo" aria-label="${esc(t('me.photo'))}">
            <span class="me-photo-edit" aria-hidden="true">+</span>
          </label>
          <div class="me-id">
            <b>${esc(u.firstName)} ${esc(u.lastName)}</b>
            <span class="mono">${esc(fmtPhone(u.phone))}</span>
            <span>${u.ratingCount ? `<span class="stars">${stars(u.rating)}</span> ${u.rating.toLocaleString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${esc(t(u.ratingCount > 1 ? 'me.notes' : 'me.note1', { n: u.ratingCount }))}` : `<span class="pill">${esc(t('me.newClient'))}</span>`}</span>
          </div>
          <button class="link-btn" type="button" data-act="me-sub" data-sub="profile">${esc(t('me.edit'))}</button>
        </div>
        <div class="me-stats">
          <div><b class="mono">${mine.length}</b><small>${esc(t('me.trips'))}</small></div>
          <div><b class="mono">${fmt(spent)}</b><small>${esc(t('me.spent'))} (FCFA)</small></div>
          <div><b class="mono">${coupons.length}</b><small>${esc(t('me.coupons'))}</small></div>
        </div>
        <ul class="me-menu">
          ${item('coupons', coupons.length ? `<span class="me-badge">${coupons.length}</span>` : '')}
          ${item('invoices')}${item('support')}${item('invite')}${item('settings')}
        </ul>
        ${logoutBlock()}
      </section>`;
  }

  function logoutBlock() {
    if (!view.confirmLogout) return `<button class="link-btn danger" type="button" data-act="logout-ask">${esc(t('me.logout'))}</button>`;
    return `<div class="confirm-inline"><p>${esc(t('me.logoutQ'))}</p><div class="btn-row">
      <button class="btn btn-danger btn-sm" type="button" data-act="logout-yes">${esc(t('me.logout'))}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-act="logout-no">${esc(t('a.resetNo'))}</button></div></div>`;
  }

  // Notation du chauffeur : étoiles, puis remarques rapides selon la note, commentaire facultatif.
  function rateBlock(o) {
    const name = o.driver.me ? t('o.you') : o.driver.name;
    if (o.rating != null) {
      return `<div class="rate-done"><span class="stars">${stars(o.rating)}</span><p>${esc(t('rt.thanks'))}</p>
        ${o.ratingTags && o.ratingTags.length ? `<div class="tag-row">${o.ratingTags.map(k => `<span class="tag is-on">${esc(t('tag.' + k))}</span>`).join('')}</div>` : ''}</div>`;
    }
    if (!view.rate || view.rate.orderId !== o.id) view.rate = { orderId: o.id, stars: 0, tags: [] };
    const r = view.rate;
    const tags = r.stars >= 4 ? TAGS_GOOD : TAGS_BAD;
    return `<section class="rate-card" aria-label="${esc(t('rt.q', { n: name }))}">
      <div class="rate-who"><span class="avatar avatar-lg" aria-hidden="true">${initials(name)}</span><p>${esc(t('rt.q', { n: name }))}</p></div>
      <div class="star-btns" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${r.stars === n}" aria-label="${n} / 5" class="star-btn${n <= r.stars ? ' is-on' : ''}" data-act="star" data-n="${n}">★</button>`).join('')}</div>
      ${r.stars ? `<p class="rate-word">${esc(t('rt.w' + r.stars))}</p>
        <p class="app-h">${esc(t(r.stars >= 4 ? 'rt.why' : 'rt.whyBad'))}</p>
        <div class="tag-row">${tags.map(k => `<button type="button" class="tag${r.tags.includes(k) ? ' is-on' : ''}" aria-pressed="${r.tags.includes(k)}" data-act="rate-tag" data-tag="${k}">${esc(t('tag.' + k))}</button>`).join('')}</div>
        <label class="field"><span class="sr-only">${esc(t('r.commentPh'))}</span><input id="rateComment" placeholder="${esc(t('r.commentPh'))}"></label>
        <button class="btn btn-signal btn-block" type="button" data-act="rate-send" data-id="${o.id}">${esc(t('rt.send'))}</button>` : ''}
    </section>`;
  }

  // ---------- rendu ----------
  function currentRole() { return ROUTES[location.hash.slice(1)] || null; }

  function render() {
    const role = currentRole();
    const site = document.getElementById('site');
    if (!role) { root.hidden = true; site.hidden = false; document.body.classList.remove('in-app'); return; }
    site.hidden = true; root.hidden = false; document.body.classList.add('in-app');

    // Conserver saisie, focus et défilement à travers les rendus.
    const keep = {};
    root.querySelectorAll('input[id]:not([type=radio]):not([type=checkbox]):not([type=file]), textarea[id], select[id]').forEach(el => { keep[el.id] = el.value; });
    const active = document.activeElement && root.contains(document.activeElement) ? document.activeElement : null;
    const focused = active ? active.id : null;
    let caret = null;
    try { if (active && active.selectionStart != null) caret = [active.selectionStart, active.selectionEnd]; } catch (e) { /* champ sans sélection */ }

    let body;
    // Le choix facultatif du mot de passe suit l'inscription, avant d'entrer dans l'app.
    const signedIn = !!store.user() && view.auth.step !== 'setpass';
    if (role === 'client' && !signedIn) body = authView();
    else if (role === 'client') body = view.name === 'wizard' ? wizard() : view.name === 'order' ? orderView() : view.name === 'orders' ? ordersView() : view.name === 'me' ? meView() : clientHome();
    else if (role === 'driver') body = driverView();
    else body = adminView();

    const withNav = role === 'client' && signedIn;
    root.innerHTML = `${header(role)}<main class="app-main${withNav ? ' has-nav' : ''}">${body}<p class="app-demo">${esc(t('app.demo'))}</p></main>${withNav ? bottomNav() : ''}`;

    Object.entries(keep).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bind) el.value = v;
    });
    if (focused) {
      const el = document.getElementById(focused);
      if (el) {
        el.focus({ preventScroll: true });
        try { if (caret) el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* ignore */ }
      }
    }
    TK.vehicles.centerTabs(root);
  }

  function go(name, patch) {
    Object.assign(view, { name, confirmCancel: false, reportOpen: false, reported: false }, patch);
    render();
    window.scrollTo({ top: 0 });
  }

  // ---------- événements ----------
  function setVehicle(id) {
    view.draft.vehicle = id;
    render();
  }

  root.addEventListener('click', e => {
    if (view.draft && ['home', 'wizard'].includes(view.name)) {
      const vt = e.target.closest('[data-veh-tab]');
      if (vt) { setVehicle(vt.dataset.vehTab); return; }
      const vs = e.target.closest('[data-veh-step]');
      if (vs) { setVehicle(TK.vehicles.step(view.draft.vehicle, vs.dataset.vehStep)); return; }
      const vo = e.target.closest('[data-veh-open]');
      if (vo) { TK.vehicles.openSheet(vo.dataset.vehOpen, { onChoose: setVehicle }); return; }
    }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || b.tagName === 'INPUT') return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'home': go('home'); break;
      case 'orders': go('orders'); break;
      case 'me': go('me', { meSub: '', confirmLogout: false, supportSent: false }); break;
      case 'me-sub': go('me', { meSub: b.dataset.sub, confirmLogout: false, supportSent: false }); break;
      case 'logout-ask': view.confirmLogout = true; render(); break;
      case 'logout-no': view.confirmLogout = false; render(); break;
      case 'logout-yes': store.logout(); view.auth = { mode: 'login', step: 'form' }; go('home', { confirmLogout: false, draft: null }); break;
      case 'set-lang': setLang(b.dataset.lang); break;
      case 'copy-code': {
        const c = b.dataset.code;
        try { navigator.clipboard.writeText(c).then(() => ui.toast(t('me.copied')), () => selectText('inviteCode')); } catch (err) { selectText('inviteCode'); }
        break;
      }
      case 'auth-mode': view.auth = { mode: b.dataset.mode, step: 'form', phone: view.auth.phone }; render(); break;
      case 'auth-edit': view.auth = { mode: view.auth.mode, step: 'form', phone: view.auth.phone, first: view.auth.first, last: view.auth.last }; render(); break;
      case 'auth-sms': case 'auth-resend': sendOtp(); render(); break;
      case 'auth-pass': view.auth.step = 'password'; view.auth.err = ''; render(); break;
      case 'auth-skip': finishAuth(); break;
      case 'star': view.rate.stars = +b.dataset.n; view.rate.tags = view.rate.tags.filter(k => (view.rate.stars >= 4 ? TAGS_GOOD : TAGS_BAD).includes(k)); render(); break;
      case 'rate-tag': {
        const k = b.dataset.tag, tags = view.rate.tags;
        view.rate.tags = tags.includes(k) ? tags.filter(x => x !== k) : tags.concat(k);
        render();
        break;
      }
      case 'rate-send': {
        const c = document.getElementById('rateComment');
        store.rate(id, view.rate.stars, view.rate.tags, c ? c.value.trim() : '');
        break;
      }
      case 'support-close': store.confirmDelivery(id, 'support'); break;
      case 'locate': view.draft.loc = 'busy'; render(); locate(); break;
      case 'item': {
        const q = view.draft.itemsQty, k = b.dataset.k;
        q[k] = Math.max(0, (q[k] || 0) + +b.dataset.d);
        if (!q[k]) delete q[k];
        render();
        break;
      }
      case 'more-items': view.moreItems = true; render(); break;
      case 'upsize': view.draft.vehicle = b.dataset.v; render(); break;
      case 'swap': {
        const d = view.draft;
        [d.from, d.to] = [d.to, d.from];
        [d.fromDetail, d.toDetail] = [d.toDetail, d.fromDetail];
        render();
        break;
      }
      case 'wiz-prev': if (view.step <= 3) go('home'); else go('wizard', { step: view.step - 1 }); break;
      case 'count': {
        const f = b.dataset.f;
        view.draft[f] = Math.min(+b.dataset.max, Math.max(+b.dataset.min, view.draft[f] + +b.dataset.d));
        render();
        break;
      }
      case 'price': {
        const q = draftQuote(view.draft);
        view.draft.price = Math.max(q.minimum, (view.draft.price || q.reference) + +b.dataset.d);
        render();
        break;
      }
      case 'open-order': go('order', { orderId: id }); break;
      case 'choose': {
        const of = store.chooseOffer(view.orderId, id);
        if (of) ui.toast(t('toast.assigned', { n: of.me ? t('o.you') : of.name }));
        view.confirmCancel = false;
        render();
        break;
      }
      case 'ask-cancel': view.confirmCancel = true; render(); break;
      case 'keep': view.confirmCancel = false; render(); break;
      case 'cancel': store.cancelOrder(id); view.confirmCancel = false; ui.toast(t('toast.cancelled')); render(); break;
      case 'demo-next': store.advance(id); break;
      case 'confirm': store.confirmDelivery(id); ui.toast(t('toast.delivered')); break;
      case 'report-open': view.reportOpen = true; render(); break;
      case 'again': {
        const o = store.getOrder(id);
        const keepKeys = ['need', 'from', 'to', 'fromDetail', 'toDetail', 'vehicle', 'service', 'notes', 'itemsQty', 'weightManual', 'floorsFrom', 'floorsTo', 'elevator', 'helpers', 'payment'];
        const patch = {};
        keepKeys.forEach(k => { if (o[k] !== undefined) patch[k] = JSON.parse(JSON.stringify(o[k])); });
        go('wizard', { step: 4, draft: newDraft(Object.assign(patch, { price: o.price })) });
        break;
      }
      case 'recharge': {
        const n = +b.dataset.n;
        store.recharge(n, document.getElementById('rcChannel').value);
        ui.toast(t('toast.recharged', { p: fcfa(n) }));
        break;
      }
      case 'd-accept': {
        const o = store.getOrder(id);
        const res = store.driverOffer(id, o.price);
        view.offerMsg[id] = res.ok ? '' : res.missing ? t('d.need', { m: fcfa(res.missing) }) : '';
        render();
        break;
      }
      case 'd-counter-open': view.counterFor = view.counterFor === id ? null : id; render(); break;
      case 'd-next': store.advance(id); break;
      case 'reset-ask': view.confirmReset = true; render(); break;
      case 'reset-no': view.confirmReset = false; render(); break;
      case 'reset-yes': view.confirmReset = false; store.reset(); go('home'); ui.toast(t('toast.reset')); break;
    }
  });

  function bindValue(el) {
    const f = el.dataset.bind;
    if (!f || !view.draft) return false;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = el.value === '' ? null : Number(el.value);
    view.draft[f] = v;
    return true;
  }

  // Glisser sur l'illustration pour changer de véhicule.
  TK.vehicles.swipe(root, dir => { if (view.draft && view.name === 'home') setVehicle(TK.vehicles.step(view.draft.vehicle, dir)); });

  root.addEventListener('input', e => {
    if (e.target.matches('input[type=text], input:not([type]), textarea, input[type=number], input[type=datetime-local]')) bindValue(e.target);
  });

  root.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'drvVehicle') { store.setDriver({ vehicle: el.value }); return; }
    if (el.id === 'me-photo-in') { if (el.files && el.files[0]) readPhoto(el.files[0]); return; }
    if (el.id === 'set-notif') { store.updateUser({ notif: el.checked }); return; }
    if (el.dataset.act === 'photos') {
      const n = el.files ? el.files.length : 0;
      if (n) store.addPhotos(el.dataset.id, el.dataset.which, n);
      return;
    }
    if (bindValue(el)) {
      // Choisir l'arrivée ouvre directement la page suivante.
      if (el.dataset.bind === 'to' && view.name === 'home') {
        if (el.value) go('wizard', { step: 3 });
        return;
      }
      if (el.dataset.bind === 'from' && view.name === 'home') view.draft.loc = 'manual';
      // Choisir un besoin propose le véhicule le plus adapté.
      if (el.dataset.bind === 'need') {
        view.draft.vehicle = NEED_VEHICLE[el.value];
        if (el.value === 'moving') view.draft.service = 'handling';
      }
      // Les champs texte ne redessinent pas l'écran ; le reste met à jour prix et options.
      if (!el.matches('textarea, input:not([type]), input[type=text], input[type=datetime-local]')) {
        if (el.dataset.bind === 'price') {
          const q = draftQuote(view.draft);
          if (view.draft.price == null || view.draft.price < q.minimum) {
            view.draft.price = q.minimum;
            ui.toast(t('w.belowMin', { min: fcfa(q.minimum) }));
          }
        }
        render();
      }
    }
  });

  root.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'authForm') { submitAuth(); return; }
    if (f.id === 'passForm') {
      const p = document.getElementById('set-pass').value;
      if (p.length < 6) { document.getElementById('set-pass-err').hidden = false; return; }
      store.updateUser({ passHash: await hashPass(store.user().phone, p) });
      ui.toast(t('me.passSaved'));
      return;
    }
    if (f.id === 'profileForm') {
      const first = document.getElementById('pf-first').value.trim(), last = document.getElementById('pf-last').value.trim();
      if (!first || !last) return;
      store.updateUser({ firstName: first, lastName: last });
      ui.toast(t('me.saved'));
      go('me', { meSub: '' });
      return;
    }
    if (f.id === 'supportForm') {
      const text = document.getElementById('supportText').value.trim();
      if (!text) return;
      store.report(null, text);
      view.supportSent = true;
      render();
      return;
    }
    if (f.id === 'homeForm') {
      if (view.draft.service === 'handling' && view.draft.helpers < 1) view.draft.helpers = 1;
      go('wizard', { step: 3 });
    } else if (f.id === 'wizForm') {
      if (view.step < 4) { go('wizard', { step: view.step + 1 }); return; }
      const q = draftQuote(view.draft);
      if (!view.draft.price || view.draft.price < q.minimum) {
        document.getElementById('w-price-err').hidden = false;
        return;
      }
      const d = view.draft;
      d.items = itemsSummary(d);
      const kg = loadKg(d);
      d.weight = kg ? `≈ ${fmt(kg)} kg` : '';
      if (d.service !== 'handling') Object.assign(d, { floorsFrom: 0, floorsTo: 0 });
      const o = store.createOrder(d);
      ui.toast(t('toast.published'));
      go('order', { orderId: o.id, draft: null, moreItems: false });
    } else if (f.id === 'reportForm') {
      const text = document.getElementById('reportText').value.trim();
      if (!text) return;
      store.report(f.dataset.id, text);
      view.reportOpen = false; view.reported = true;
      render();
    } else if (f.id === 'rateForm') {
      const v = f.querySelector('input[name=stars]:checked');
      store.rate(f.dataset.id, v ? +v.value : 5, document.getElementById('rateComment').value.trim());
    } else if (f.classList.contains('counter-form')) {
      const id = f.dataset.id;
      const input = document.getElementById('ctr-' + id);
      const o = store.getOrder(id);
      const price = Number(input.value);
      if (!price || price < o.minimum) { view.offerMsg[id] = t('w.belowMin', { min: fcfa(o.minimum) }); render(); return; }
      const res = store.driverOffer(id, price);
      view.offerMsg[id] = res.ok ? '' : res.missing ? t('d.need', { m: fcfa(res.missing) }) : '';
      if (res.ok) view.counterFor = null;
      render();
    }
  });

  // Langue (site + app)
  function setLang(next) {
    TK.setLang(next);
    store.set({ lang: next });
    TK.applyStatic();
    TKSite.refresh();
    render();
  }
  function selectText(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lang-toggle]')) return;
    setLang(TK.getLang() === 'fr' ? 'en' : 'fr');
  });

  window.addEventListener('hashchange', () => {
    const wasApp = !document.getElementById('app').hidden;
    render();
    if (currentRole() || wasApp) window.scrollTo({ top: 0 });
  });

  // Re-rendu sur changement d'état, sauf pendant la saisie du formulaire de commande.
  store.subscribe(() => { if (currentRole() && view.name !== 'wizard') render(); });

  // Simulation : offres, réponses et progression.
  setInterval(() => {
    const events = store.tick();
    events.forEach(ev => {
      if (ev.type === 'offer' && currentRole() === 'client') {
        const last = store.visibleOffers(ev.order).slice(-1)[0];
        if (!(view.name === 'order' && view.orderId === ev.order.id)) ui.toast(t('toast.newOffer', { n: last ? last.name : '' }));
      }
      if (ev.type === 'accepted' && currentRole() === 'driver') ui.toast(t('toast.accepted'));
      if (ev.type === 'declined' && currentRole() === 'driver') ui.toast(t('d.declined'));
    });
    // Comptes à rebours : clôture automatique, renvoi du code SMS.
    const role = currentRole();
    const o = view.name === 'order' && store.getOrder(view.orderId);
    if (role === 'client' && !store.user() && view.auth.step === 'otp') render();
    else if (role === 'client' && o && o.status === 'arrived' && o.autoConfirmAt) render();
    else if (role === 'driver' && store.state.orders.some(x => x.driver && x.driver.me && x.status === 'arrived')) render();
  }, 1000);

  window.TKApp = {
    prefill(q) {
      view.name = 'wizard'; view.step = 3;
      view.draft = newDraft({ from: q.from, to: q.to, vehicle: q.vehicle, need: q.vehicle === 'tricycle' ? 'parcel' : 'furniture' });
    }
  };

  // ---------- démarrage ----------
  TK.setLang(store.state.lang);
  TK.applyStatic();
  TKSite.init();
  render();

  // Service worker : hors ligne et installation (ignoré là où il n'est pas autorisé).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ }
  }
})();
