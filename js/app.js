// Application Takaata (PWA) : espaces Client, Chauffeur et Admin + routage.
(function () {
  const { t, VEHICLES, NEEDS, PAYMENTS, STATUSES, store, ui, quote, distanceKm, commission, commune, vehicle } = TK;
  const { fcfa, esc, fmt } = ui;

  const ROUTES = { app: 'client', chauffeur: 'driver', admin: 'admin' };
  const NEED_VEHICLE = { vivriers: 'truck10t', moving: 'truck3t', goods: 'van1t', parcel: 'tricycle', furniture: 'van1t', food: 'truck3t', shop: 'van1t' };
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
      floorsFrom: 0, floorsTo: 0, elevator: false, helpers: 1, packing: false, dismantle: false, passengers: 0, price: null, payment: 'cash'
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
        ${d.need === 'vivriers' ? vivriersPanel() : `<section class="home-veh">
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
        <p class="hint">${esc(t('h.hint'))}</p>`}
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
        ${myBookingsBlock()}
        ${past.length ? `<div class="stack">${past.map(orderRow).join('')}</div>` : active.length || store.myBookings().length ? '' : `<p class="empty">${esc(t('c.noHistory'))}</p>`}
      </section>`;
  }

  // Barre du bas (client) : Commander / Mes courses.
  function bottomNav() {
    const section = { home: 'home', wizard: 'home', orders: 'orders', order: 'orders', booking: 'orders', me: 'me' }[view.name] || 'home';
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
      const spec = V().SPECS[d.vehicle];
      const est = estimatedKg(d), kg = loadKg(d);
      const over = kg > spec.payloadKg;
      const bigger = VEHICLES.find(v => V().SPECS[v.id].payloadKg >= kg);
      const svc = kind => `
        <label class="svc-card${d.service === kind ? ' is-on' : ''}">
          <input type="radio" name="service" id="w-svc-${kind}" value="${kind}" data-bind="service"${d.service === kind ? ' checked' : ''}>
          <span class="svc-check" aria-hidden="true"></span>
          <span class="svc-txt"><b>${esc(t('svc.' + kind))}</b><small>${esc(t('svc.' + kind + 'D'))}</small></span>
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

        <fieldset class="chips"><legend class="app-h">${esc(t('w.passengers'))}</legend>
          ${[0, 1, 2].map(n => `<label class="chip-radio"><input type="radio" name="passengers" id="w-pass-${n}" value="${n}" data-bind="passengers"${+d.passengers === n ? ' checked' : ''}><span>${esc(t(n ? 'w.passN' : 'w.pass0', { n }))}</span></label>`).join('')}
        </fieldset>
        <p class="hint">${esc(t('w.passHint'))}</p>

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
              <div><dt>${esc(t('w.passengers'))}</dt><dd>${esc(t(+d.passengers ? 'w.passN' : 'w.pass0', { n: +d.passengers }))}</dd></div>
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
            <button class="btn btn-signal btn-block" type="submit">${esc(t(step === 4 ? 'w.publish' : 'w.next'))}${step === 4 ? ` · ${fcfa(d.price)}` : ''}</button>
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
        ${callBlock(o, 'client')}
        ${['assigned', 'pickup'].includes(o.status) && o.clientPhone ? `<div class="code-box"><span>${esc(t('cv.clientCodeT'))}</span><b class="mono">${esc(o.clientPhone.slice(-4))}</b><small>${esc(t('cv.clientCodeS'))}</small></div>` : ''}

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

        ${['delivered', 'cancelled'].includes(o.status) ? afterCall() : ''}
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
        ${callBlock(o, 'driver')}
        ${o.status === 'pickup' ? `<div class="code-box code-box-driver">
          <span>${esc(t('cv.verifyT'))}</span><b class="mono">${esc((o.clientPhone || '').slice(-4))}</b>
          <small>${esc(t('cv.verifyS'))}</small></div>` : ''}
        <p class="notice">${esc(o.payment === 'cash'
          ? t('d.cashHint', { p: fcfa(o.price), n: fcfa(o.price - o.commission) })
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

  // ---------- CHAUFFEUR ----------
  TK.addStrings({
    fr: {
      'dn.jobs': 'Courses', 'dn.gains': 'Gains', 'dn.me': 'Moi',
      'da.joinT': 'Devenir chauffeur Takaata', 'da.joinS': 'Inscription en 5 étapes. Gardez sous la main votre pièce d’identité, votre permis et les papiers du véhicule.',
      'da.loginT': 'Espace chauffeur', 'da.loginS': 'Connectez-vous avec le numéro de votre compte chauffeur.',
      'da.s.id': 'Identité', 'da.s.license': 'Pièce et permis', 'da.s.vehicle': 'Véhicule', 'da.s.payout': 'Paiement des gains', 'da.s.review': 'Vérification',
      'da.step': 'Étape {n} sur 5', 'da.birth': 'Date de naissance', 'da.age': '{n} ans', 'da.commune': 'Commune où vous travaillez le plus',
      'da.tooYoung': 'Il faut avoir au moins 18 ans pour conduire avec Takaata.', 'da.badBirth': 'Indiquez votre date de naissance.',
      'da.idType': 'Pièce d’identité', 'da.cni': 'Carte nationale d’identité', 'da.passport': 'Passeport', 'da.consular': 'Carte consulaire',
      'da.idNumber': 'Numéro de la pièce', 'da.idFront': 'Pièce · recto', 'da.idBack': 'Pièce · verso', 'da.selfie': 'Photo de vous (visage)',
      'da.licenseNumber': 'Numéro de permis de conduire', 'da.licenseCats': 'Catégories du permis', 'da.licenseExp': 'Date d’expiration du permis',
      'da.license': 'Photo du permis', 'da.vehType': 'Type de véhicule', 'da.plate': 'Immatriculation', 'da.platePh': 'ex. 1234 AB 01',
      'da.brand': 'Marque et modèle', 'da.brandPh': 'ex. Toyota Dyna, Hyundai H100', 'da.year': 'Année', 'da.owner': 'Vous êtes',
      'da.ownerYes': 'Propriétaire', 'da.ownerNo': 'Conducteur pour un propriétaire', 'da.regCard': 'Carte grise', 'da.insurance': 'Attestation d’assurance',
      'da.insuranceExp': 'Fin de l’assurance', 'da.inspectionExp': 'Fin de la visite technique', 'da.vehicleFront': 'Photo du véhicule (avant)', 'da.vehicleCargo': 'Photo de la caisse',
      'da.payOp': 'Recevoir mes gains sur', 'da.payPhone': 'Numéro Mobile Money', 'da.paySame': 'Même numéro que mon compte',
      'da.payNote': 'Vos gains des courses payées en Mobile Money sont reversés sur ce numéro.',
      'da.accept': 'J’atteste que les informations et documents sont exacts et j’accepte les conditions chauffeur Takaata.',
      'da.mustAccept': 'Cochez la case pour envoyer votre dossier.', 'da.submit': 'Envoyer mon dossier', 'da.next': 'Continuer', 'da.back': 'Retour',
      'da.add': 'Ajouter', 'da.added': 'Ajoutée', 'da.missingDocs': 'Ajoutez les photos manquantes : {d}.', 'da.short': 'Complétez : {f}.',
      'da.expired': '{f} : la date doit être dans le futur.', 'da.badPlate': 'Immatriculation au format 1234 AB 01.',
      'da.badYear': 'Année du véhicule invalide.', 'da.catMismatch': 'Votre permis ne couvre pas un {v} : catégorie {c} requise.',
      'da.exists': 'Un compte chauffeur existe déjà avec ce numéro. Connectez-vous.', 'da.unknown': 'Aucun compte chauffeur avec ce numéro. Inscrivez-vous.',
      'da.join': 'Pas encore inscrit ? Devenir chauffeur', 'da.haveAccount': 'Déjà inscrit ? Se connecter',
      'da.pendingT': 'Dossier en cours de vérification', 'da.pendingS': 'L’équipe Takaata vérifie vos documents sous 48 h. Vous serez prévenu par SMS.',
      'da.pendingDemo': 'Prototype : validation automatique au bout de quelques secondes.', 'da.rejectedT': 'Dossier refusé',
      'da.approved': 'Dossier validé : vous pouvez passer en ligne.',
      'dj.online': 'En ligne', 'dj.offline': 'Hors ligne', 'dj.goOnline': 'Passer en ligne', 'dj.goOffline': 'Passer hors ligne',
      'dj.offlineS': 'Vous êtes hors ligne. Passez en ligne pour recevoir les demandes près de vous.',
      'dj.onlineS': 'Vous recevez les demandes pour votre {v}.', 'dj.price': 'Prix de la course', 'dj.net': 'Votre gain net',
      'dj.lowGo': 'Recharger',
      'dg.today': 'Gains nets aujourd’hui', 'dg.week': '7 derniers jours', 'dg.trips': 'Courses', 'dg.history': 'Courses effectuées',
      'dg.noHistory': 'Vos courses terminées apparaîtront ici avec votre gain net.', 'dg.line': 'Prix {p} · net {n}',
      'dm.trips': '{n} courses', 'dm.trip1': '1 course', 'dm.docs': 'Mes documents', 'dm.vehicle': 'Mon véhicule', 'dm.payout': 'Paiement des gains',
      'dm.support': 'Aide chauffeur', 'dm.settings': 'Paramètres', 'dm.valid': 'Valide', 'dm.soon': 'Expire bientôt', 'dm.exp': 'Expiré',
      'dm.until': 'jusqu’au {d}', 'dm.inspection': 'Visite technique', 'dm.docsNote': 'Mettez vos documents à jour avant expiration pour rester en ligne.',
      'dm.supportS': 'Une question sur une course, un paiement ou votre dossier ?',
      'st.pending': 'En vérification', 'st.approved': 'Validé', 'st.rejected': 'Refusé',
      'l.reserve': 'Frais de service réservés', 'l.release': 'Frais de service libérés', 'l.debit': 'Frais de service',
      'd.cashHint': 'Encaissez {p} en espèces. Votre gain net : {n}.', 'd.mmHint': 'Paiement {m} : {n} vous sera reversé après la livraison.',
      'a.drivers': 'Chauffeurs', 'a.approve': 'Valider', 'a.reject': 'Refuser', 'a.noDrivers': 'Aucun chauffeur inscrit.', 'a.rejectWhy': 'Document illisible ou invalide'
    },
    en: {
      'dn.jobs': 'Trips', 'dn.gains': 'Earnings', 'dn.me': 'Me',
      'da.joinT': 'Drive with Takaata', 'da.joinS': 'Sign up in 5 steps. Keep your ID, driving licence and vehicle papers at hand.',
      'da.loginT': 'Driver space', 'da.loginS': 'Sign in with the number of your driver account.',
      'da.s.id': 'Identity', 'da.s.license': 'ID and licence', 'da.s.vehicle': 'Vehicle', 'da.s.payout': 'Earnings payout', 'da.s.review': 'Review',
      'da.step': 'Step {n} of 5', 'da.birth': 'Date of birth', 'da.age': '{n} years old', 'da.commune': 'District where you work most',
      'da.tooYoung': 'You must be at least 18 to drive with Takaata.', 'da.badBirth': 'Enter your date of birth.',
      'da.idType': 'ID document', 'da.cni': 'National ID card', 'da.passport': 'Passport', 'da.consular': 'Consular card',
      'da.idNumber': 'Document number', 'da.idFront': 'ID · front', 'da.idBack': 'ID · back', 'da.selfie': 'Photo of you (face)',
      'da.licenseNumber': 'Driving licence number', 'da.licenseCats': 'Licence categories', 'da.licenseExp': 'Licence expiry date',
      'da.license': 'Photo of the licence', 'da.vehType': 'Vehicle type', 'da.plate': 'Registration plate', 'da.platePh': 'e.g. 1234 AB 01',
      'da.brand': 'Make and model', 'da.brandPh': 'e.g. Toyota Dyna, Hyundai H100', 'da.year': 'Year', 'da.owner': 'You are',
      'da.ownerYes': 'The owner', 'da.ownerNo': 'Driving for an owner', 'da.regCard': 'Registration card', 'da.insurance': 'Insurance certificate',
      'da.insuranceExp': 'Insurance end date', 'da.inspectionExp': 'Roadworthiness test end date', 'da.vehicleFront': 'Vehicle photo (front)', 'da.vehicleCargo': 'Cargo area photo',
      'da.payOp': 'Receive my earnings on', 'da.payPhone': 'Mobile Money number', 'da.paySame': 'Same number as my account',
      'da.payNote': 'Earnings from trips paid by Mobile Money are paid out to this number.',
      'da.accept': 'I confirm the information and documents are accurate and I accept the Takaata driver terms.',
      'da.mustAccept': 'Tick the box to send your application.', 'da.submit': 'Send my application', 'da.next': 'Continue', 'da.back': 'Back',
      'da.add': 'Add', 'da.added': 'Added', 'da.missingDocs': 'Add the missing photos: {d}.', 'da.short': 'Complete: {f}.',
      'da.expired': '{f}: the date must be in the future.', 'da.badPlate': 'Plate in the format 1234 AB 01.',
      'da.badYear': 'Invalid vehicle year.', 'da.catMismatch': 'Your licence does not cover a {v}: category {c} required.',
      'da.exists': 'A driver account already uses this number. Please sign in.', 'da.unknown': 'No driver account with this number. Sign up.',
      'da.join': 'Not registered yet? Become a driver', 'da.haveAccount': 'Already registered? Sign in',
      'da.pendingT': 'Application under review', 'da.pendingS': 'The Takaata team checks your documents within 48 h. You will be notified by SMS.',
      'da.pendingDemo': 'Prototype: approved automatically after a few seconds.', 'da.rejectedT': 'Application refused',
      'da.approved': 'Application approved: you can go online.',
      'dj.online': 'Online', 'dj.offline': 'Offline', 'dj.goOnline': 'Go online', 'dj.goOffline': 'Go offline',
      'dj.offlineS': 'You are offline. Go online to receive requests near you.',
      'dj.onlineS': 'You receive requests for your {v}.', 'dj.price': 'Trip price', 'dj.net': 'Your net earnings',
      'dj.lowGo': 'Top up',
      'dg.today': 'Net earnings today', 'dg.week': 'Last 7 days', 'dg.trips': 'Trips', 'dg.history': 'Completed trips',
      'dg.noHistory': 'Your completed trips will appear here with your net earnings.', 'dg.line': 'Price {p} · net {n}',
      'dm.trips': '{n} trips', 'dm.trip1': '1 trip', 'dm.docs': 'My documents', 'dm.vehicle': 'My vehicle', 'dm.payout': 'Earnings payout',
      'dm.support': 'Driver help', 'dm.settings': 'Settings', 'dm.valid': 'Valid', 'dm.soon': 'Expires soon', 'dm.exp': 'Expired',
      'dm.until': 'until {d}', 'dm.inspection': 'Roadworthiness test', 'dm.docsNote': 'Update your documents before they expire to stay online.',
      'dm.supportS': 'A question about a trip, a payment or your application?',
      'st.pending': 'Under review', 'st.approved': 'Approved', 'st.rejected': 'Refused',
      'l.reserve': 'Service fee held', 'l.release': 'Service fee released', 'l.debit': 'Service fee',
      'd.cashHint': 'Collect {p} in cash. Your net earnings: {n}.', 'd.mmHint': '{m} payment: {n} will be paid to you after delivery.',
      'a.drivers': 'Drivers', 'a.approve': 'Approve', 'a.reject': 'Refuse', 'a.noDrivers': 'No registered drivers.', 'a.rejectWhy': 'Unreadable or invalid document'
    }
  });

  const LICENSE_FOR = { tricycle: ['A', 'B'], van1t: ['B', 'C'], truck3t: ['C'], truck10t: ['C'] };
  const LICENSE_CATS = ['A', 'B', 'C', 'D', 'E'];
  const DOCS_BY_STEP = { license: ['idFront', 'idBack', 'selfie', 'license'], vehicle: ['regCard', 'insurance', 'vehicleFront', 'vehicleCargo'] };
  const SIGNUP_STEPS = ['id', 'license', 'vehicle', 'payout', 'review'];
  const PLATE_RE = /^\d{1,4}\s?[A-Z]{2}\s?\d{2}$/i;
  const net = o => o.price - commission(o.price, o.optionsPrice);
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const ageOf = iso => { if (!iso) return null; const b = new Date(iso), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  const future = iso => iso && new Date(iso).getTime() > Date.now();

  function newDriverForm(phone) {
    return { firstName: '', lastName: '', birth: '', phone: phone || '', commune: 'yopougon', idType: 'cni', idNumber: '', licenseNumber: '',
      licenseCats: [], licenseExp: '', vehicle: 'van1t', plate: '', brand: '', year: '', owner: 'yes', insuranceExp: '', inspectionExp: '',
      payOp: 'orange', payPhone: '', paySame: true, accept: false, docs: {} };
  }
  if (!view.dauth) view.dauth = { mode: 'signup', step: 'id', f: newDriverForm(), err: '' };
  if (!view.dtab) view.dtab = 'jobs';

  // Champs liés au formulaire d'inscription chauffeur.
  const dIn = (key, label, opts = {}) => `<label class="field"><span>${esc(label)}</span>
    <input id="df-${key}" data-dbind="${key}" type="${opts.type || 'text'}" value="${esc(view.dauth.f[key] || '')}"${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ''}${opts.mode ? ` inputmode="${opts.mode}"` : ''}${opts.max ? ` maxlength="${opts.max}"` : ''}${opts.auto ? ` autocomplete="${opts.auto}"` : ''}></label>`;
  const dDoc = key => {
    const n = view.dauth.f.docs[key] || 0;
    return `<label class="doc-in${n ? ' is-done' : ''}">
      <input type="file" accept="image/*" capture="environment" id="dd-${key}" data-ddoc="${key}">
      <span class="doc-ic" aria-hidden="true">${n ? '✓' : '+'}</span><span>${esc(t('da.' + key))}</span><small>${esc(t(n ? 'da.added' : 'da.add'))}</small></label>`;
  };

  function driverAuthView() {
    const a = view.dauth, f = a.f;
    const err = a.err ? `<p class="field-error" role="alert">${esc(a.err)}</p>` : '';
    const head = (title, sub) => `<div class="auth-head"><span class="brand-mark auth-mark" aria-hidden="true"></span><h1 class="app-title">${esc(title)}</h1><p class="sub">${esc(sub)}</p></div>`;
    const phoneField = `<label class="field"><span>${esc(t('au.phone'))}</span>
      <span class="phone-in"><b class="mono">+225</b><input id="df-phone" data-dbind="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" value="${esc(f.phone)}" placeholder="07 00 00 00 00"></span></label>`;

    if (a.step === 'otp') {
      const wait = RESEND_S - Math.floor((Date.now() - a.otpAt) / 1000);
      return `<section class="app-sec auth">${head(t('au.otpT'), t('au.otpS', { p: fmtPhone(f.phone) }))}
        <p class="notice">${esc(t('au.demoCode', { c: a.otp }))}</p>
        <form class="auth-form" id="dAuthForm" novalidate>
          <input id="dauth-otp" class="otp-in mono" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="${esc(t('au.otpT'))}">
          ${err}<button class="btn btn-signal btn-block" type="submit">${esc(t('au.verify'))}</button>
        </form>
        <div class="auth-links">
          <button class="link-btn" type="button" data-act="da-resend"${wait > 0 ? ' disabled' : ''}>${esc(wait > 0 ? t('au.resendIn', { s: wait }) : t('au.resend'))}</button>
          <button class="link-btn" type="button" data-act="da-edit">${esc(t('au.editPhone'))}</button>
        </div></section>`;
    }
    if (a.mode === 'login') {
      return `<section class="app-sec auth">${head(t('da.loginT'), t('da.loginS'))}
        <form class="auth-form" id="dAuthForm" novalidate>${phoneField}${err}
          <button class="btn btn-signal btn-block" type="submit">${esc(t('au.getCode'))}</button></form>
        <button class="link-btn auth-switch" type="button" data-act="da-mode" data-mode="signup">${esc(t('da.join'))}</button></section>`;
    }

    const idx = SIGNUP_STEPS.indexOf(a.step);
    let body = '';
    if (a.step === 'id') {
      const age = ageOf(f.birth);
      body = `<div class="row-2">${dIn('firstName', t('au.first'), { auto: 'given-name' })}${dIn('lastName', t('au.last'), { auto: 'family-name' })}</div>
        <label class="field"><span>${esc(t('da.birth'))}${age != null && age > 0 ? ` · <b>${esc(t('da.age', { n: age }))}</b>` : ''}</span>
          <input id="df-birth" data-dbind="birth" type="date" value="${esc(f.birth)}" max="${new Date().toISOString().slice(0, 10)}"></label>
        ${phoneField}
        <label class="field"><span>${esc(t('da.commune'))}</span><select id="df-commune" data-dbind="commune">${ui.communeOptions(f.commune)}</select></label>`;
    } else if (a.step === 'license') {
      body = `<label class="field"><span>${esc(t('da.idType'))}</span><select id="df-idType" data-dbind="idType">
          ${['cni', 'passport', 'consular'].map(k => `<option value="${k}"${f.idType === k ? ' selected' : ''}>${esc(t('da.' + k))}</option>`).join('')}</select></label>
        ${dIn('idNumber', t('da.idNumber'))}
        <div class="doc-grid">${DOCS_BY_STEP.license.slice(0, 3).map(dDoc).join('')}</div>
        ${dIn('licenseNumber', t('da.licenseNumber'))}
        <fieldset class="chips"><legend>${esc(t('da.licenseCats'))}</legend>
          ${LICENSE_CATS.map(c => `<label class="chip-radio"><input type="checkbox" id="df-cat-${c}" data-dcat="${c}"${f.licenseCats.includes(c) ? ' checked' : ''}><span>${c}</span></label>`).join('')}
        </fieldset>
        ${dIn('licenseExp', t('da.licenseExp'), { type: 'date' })}
        <div class="doc-grid">${dDoc('license')}</div>`;
    } else if (a.step === 'vehicle') {
      body = `<fieldset class="chips"><legend>${esc(t('da.vehType'))}</legend>
          ${VEHICLES.map(v => `<label class="chip-radio"><input type="radio" name="df-vehicle" id="df-veh-${v.id}" value="${v.id}" data-dbind="vehicle"${f.vehicle === v.id ? ' checked' : ''}><span>${esc(t('veh.' + v.id))}</span></label>`).join('')}
        </fieldset>
        <p class="hint">${esc(t('da.licenseCats'))} : ${LICENSE_FOR[f.vehicle].join(' / ')}</p>
        <div class="row-2">${dIn('plate', t('da.plate'), { ph: t('da.platePh'), max: 12 })}${dIn('year', t('da.year'), { type: 'number', mode: 'numeric' })}</div>
        ${dIn('brand', t('da.brand'), { ph: t('da.brandPh') })}
        <fieldset class="chips"><legend>${esc(t('da.owner'))}</legend>
          <label class="chip-radio"><input type="radio" name="df-owner" id="df-owner-yes" value="yes" data-dbind="owner"${f.owner === 'yes' ? ' checked' : ''}><span>${esc(t('da.ownerYes'))}</span></label>
          <label class="chip-radio"><input type="radio" name="df-owner" id="df-owner-no" value="no" data-dbind="owner"${f.owner === 'no' ? ' checked' : ''}><span>${esc(t('da.ownerNo'))}</span></label>
        </fieldset>
        <div class="row-2">${dIn('insuranceExp', t('da.insuranceExp'), { type: 'date' })}${dIn('inspectionExp', t('da.inspectionExp'), { type: 'date' })}</div>
        <div class="doc-grid">${DOCS_BY_STEP.vehicle.map(dDoc).join('')}</div>`;
    } else if (a.step === 'payout') {
      body = `<fieldset class="chips"><legend>${esc(t('da.payOp'))}</legend>
          ${PAYMENTS.slice(1).map(p => `<label class="chip-radio"><input type="radio" name="df-payOp" id="df-pay-${p}" value="${p}" data-dbind="payOp"${f.payOp === p ? ' checked' : ''}><span>${esc(t('pay.' + p))}</span></label>`).join('')}
        </fieldset>
        <label class="check"><input type="checkbox" id="df-paySame" data-dbind="paySame"${f.paySame ? ' checked' : ''}><span>${esc(t('da.paySame'))} · <span class="mono">${esc(fmtPhone(f.phone))}</span></span></label>
        ${f.paySame ? '' : `<label class="field"><span>${esc(t('da.payPhone'))}</span><span class="phone-in"><b class="mono">+225</b><input id="df-payPhone" data-dbind="payPhone" type="tel" inputmode="numeric" maxlength="14" value="${esc(f.payPhone)}"></span></label>`}
        <p class="hint">${esc(t('da.payNote'))}</p>`;
    } else if (a.step === 'review') {
      const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
      body = `<dl class="kv">
          ${row(t('au.first') + ' / ' + t('au.last'), `${f.firstName} ${f.lastName}`)}
          ${row(t('da.birth'), t('da.age', { n: ageOf(f.birth) }))}
          ${row(t('au.phone'), fmtPhone(f.phone))}
          ${row(t('da.idType'), t('da.' + f.idType) + ' · ' + f.idNumber)}
          ${row(t('da.licenseNumber'), `${f.licenseNumber} · ${f.licenseCats.join(', ')}`)}
          ${row(t('da.vehType'), `${t('veh.' + f.vehicle)} · ${f.plate.toUpperCase()}`)}
          ${row(t('da.brand'), `${f.brand} · ${f.year}`)}
          ${row(t('da.payOp'), `${t('pay.' + f.payOp)} · ${fmtPhone(f.paySame ? f.phone : f.payPhone)}`)}
        </dl>
        <label class="check"><input type="checkbox" id="df-accept" data-dbind="accept"${f.accept ? ' checked' : ''}><span>${esc(t('da.accept'))}</span></label>`;
    }
    return `<section class="app-sec auth">
      ${idx === 0 ? head(t('da.joinT'), t('da.joinS')) : `<div class="wiz-head"><button class="link-btn" type="button" data-act="da-prev">← ${esc(t('da.back'))}</button><span class="mono">${esc(t('da.step', { n: idx + 1 }))}</span></div>`}
      <ol class="wiz-bar wiz-bar-5" aria-hidden="true">${SIGNUP_STEPS.map((s, i) => `<li class="${i <= idx ? 'is-done' : ''}"></li>`).join('')}</ol>
      <h2 class="app-h">${esc(t('da.step', { n: idx + 1 }))} · ${esc(t('da.s.' + a.step))}</h2>
      <form class="auth-form" id="dAuthForm" novalidate>${body}${err}
        <button class="btn btn-signal btn-block" type="submit">${esc(t(a.step === 'review' ? 'da.submit' : idx === 0 ? 'au.getCode' : 'da.next'))}</button>
      </form>
      ${idx === 0 ? `<button class="link-btn auth-switch" type="button" data-act="da-mode" data-mode="login">${esc(t('da.haveAccount'))}</button>` : ''}
    </section>`;
  }

  function validateDriverStep() {
    const a = view.dauth, f = a.f;
    const missing = fields => fields.filter(([k]) => !String(f[k] || '').trim()).map(([, l]) => l);
    const docsMissing = keys => keys.filter(k => !f.docs[k]).map(k => t('da.' + k));
    if (a.step === 'id') {
      f.phone = String(f.phone).replace(/\D/g, '').replace(/^225(?=\d{10}$)/, '');
      const m = missing([['firstName', t('au.first')], ['lastName', t('au.last')]]);
      if (m.length) return t('da.short', { f: m.join(', ') });
      const age = ageOf(f.birth);
      if (age == null || isNaN(age)) return t('da.badBirth');
      if (age < 18) return t('da.tooYoung');
      if (!PHONE_RE.test(f.phone)) return t('au.badPhone');
      if (store.driverAccount(f.phone)) { a.mode = 'login'; return t('da.exists'); }
    }
    if (a.step === 'license') {
      const m = missing([['idNumber', t('da.idNumber')], ['licenseNumber', t('da.licenseNumber')]]);
      if (!f.licenseCats.length) m.push(t('da.licenseCats'));
      if (m.length) return t('da.short', { f: m.join(', ') });
      if (!future(f.licenseExp)) return t('da.expired', { f: t('da.licenseExp') });
      const d = docsMissing(DOCS_BY_STEP.license);
      if (d.length) return t('da.missingDocs', { d: d.join(', ') });
    }
    if (a.step === 'vehicle') {
      const m = missing([['plate', t('da.plate')], ['brand', t('da.brand')], ['year', t('da.year')]]);
      if (m.length) return t('da.short', { f: m.join(', ') });
      if (!PLATE_RE.test(f.plate.trim())) return t('da.badPlate');
      const y = +f.year;
      if (!(y >= 1985 && y <= new Date().getFullYear() + 1)) return t('da.badYear');
      if (!future(f.insuranceExp)) return t('da.expired', { f: t('da.insuranceExp') });
      if (!future(f.inspectionExp)) return t('da.expired', { f: t('da.inspectionExp') });
      if (!LICENSE_FOR[f.vehicle].some(c => f.licenseCats.includes(c))) return t('da.catMismatch', { v: t('veh.' + f.vehicle), c: LICENSE_FOR[f.vehicle].join(' / ') });
      const d = docsMissing(DOCS_BY_STEP.vehicle);
      if (d.length) return t('da.missingDocs', { d: d.join(', ') });
    }
    if (a.step === 'payout' && !f.paySame) {
      f.payPhone = String(f.payPhone).replace(/\D/g, '');
      if (!PHONE_RE.test(f.payPhone)) return t('au.badPhone');
    }
    if (a.step === 'review' && !f.accept) return t('da.mustAccept');
    return '';
  }

  function sendDriverOtp() {
    const a = view.dauth;
    a.otp = String(Math.floor(100000 + Math.random() * 900000));
    a.otpAt = Date.now();
    a.err = '';
    a.step = 'otp';
  }

  function submitDriverAuth() {
    const a = view.dauth, f = a.f;
    if (a.step === 'otp') {
      const code = (document.getElementById('dauth-otp').value || '').replace(/\D/g, '');
      if (Date.now() - a.otpAt > OTP_TTL) { a.err = t('au.expired'); return render(); }
      if (code !== a.otp) { a.err = t('au.badOtp'); return render(); }
      if (a.mode === 'login') { store.driverLogin(f.phone); view.dauth = { mode: 'login', step: 'id', f: newDriverForm(), err: '' }; view.dtab = 'jobs'; return render(); }
      a.verified = true;
      a.step = 'license';
      a.err = '';
      return render();
    }
    if (a.mode === 'login') {
      f.phone = String(f.phone).replace(/\D/g, '').replace(/^225(?=\d{10}$)/, '');
      if (!PHONE_RE.test(f.phone)) { a.err = t('au.badPhone'); return render(); }
      if (!store.driverAccount(f.phone)) { a.mode = 'signup'; a.step = 'id'; a.err = t('da.unknown'); return render(); }
      sendDriverOtp();
      return render();
    }
    a.err = validateDriverStep();
    if (a.err) { render(); const e = root.querySelector('.field-error'); if (e) e.scrollIntoView({ block: 'center' }); return; }
    if (a.step === 'id') {
      if (a.verified && a.verifiedPhone === f.phone) { a.step = 'license'; return dgo(); }
      a.verifiedPhone = f.phone;
      sendDriverOtp();
      return render();
    }
    if (a.step === 'review') {
      const { accept, paySame, ...profile } = f;
      store.driverRegister(Object.assign(profile, { plate: f.plate.trim().toUpperCase(), payPhone: paySame ? f.phone : f.payPhone }));
      view.dauth = { mode: 'login', step: 'id', f: newDriverForm(), err: '' };
      view.dtab = 'jobs';
      return dgo();
    }
    a.step = SIGNUP_STEPS[SIGNUP_STEPS.indexOf(a.step) + 1];
    dgo();
  }

  function dgo() { render(); window.scrollTo({ top: 0 }); }

  function driverNav() {
    const item = (tab, key, path) => `<button type="button" class="bn-item${view.dtab === tab ? ' is-on' : ''}" data-act="dtab" data-tab="${tab}"${view.dtab === tab ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><span>${esc(t(key))}</span></button>`;
    return `<nav class="bottom-nav" aria-label="${esc(t('role.driver'))}">
      ${item('jobs', 'dn.jobs', 'M3 13h11V6H3zM14 9h4l3 4v3h-7zM6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z')}
      ${item('gains', 'dn.gains', 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2')}
      ${item('me', 'dn.me', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0')}
    </nav>`;
  }

  function driverApp() {
    const d = store.driver();
    if (view.dtab === 'gains') return driverGains(d);
    if (view.dtab === 'me') return driverMe(d);
    return driverJobs(d);
  }

  function walletCard(d) {
    const avail = store.available();
    return `<div class="wallet">
        <div class="wallet-head"><span>${esc(t('d.wallet'))}</span><span class="mono">${esc(t('d.balance'))} ${fmt(d.balance)}</span></div>
        <div class="wallet-main"><small>${esc(t('d.available'))}</small><b class="mono">${fmt(avail)} <small>FCFA</small></b></div>
        <div class="wallet-actions">
          <label class="field field-inline"><span class="sr-only">Mobile Money</span>
            <select id="rcChannel">${PAYMENTS.slice(1).map(p => `<option value="${p}"${p === d.payOp ? ' selected' : ''}>${esc(t('pay.' + p))}</option>`).join('')}</select>
          </label>
          ${[2000, 5000, 10000].map(n => `<button class="btn btn-light btn-sm" type="button" data-act="recharge" data-n="${n}">+${fmt(n)}</button>`).join('')}
        </div>
        ${avail < 2000 ? `<p class="wallet-alert">${esc(t('d.low'))}</p>` : ''}
      </div>`;
  }

  TK.addStrings({
    fr: {
      'dh.morning': 'Bonjour', 'dh.afternoon': 'Bon après-midi', 'dh.evening': 'Bonsoir', 'dh.today': 'Gagné aujourd’hui', 'dh.of': 'sur {g} FCFA',
      'dh.start': 'Prêt pour votre première course de la journée ?', 'dh.left': 'Plus que {n} pour atteindre votre objectif.',
      'dh.goalDone': 'Objectif du jour atteint. Bravo !', 'dh.onlineTime': 'En ligne', 'dh.goal': 'Objectif',
      'dh.go': 'Passer en ligne', 'dh.goS': 'Recevez les demandes près de vous', 'dh.searching': 'Recherche de courses pour votre {v}…',
      'dh.zones': 'Zones demandées en ce moment', 'dh.req1': '1 demande', 'dh.reqN': '{n} demandes', 'dh.badges': 'Mes réussites',
      'dh.done': 'Course terminée !',
      'bd.first': '1re course', 'bd.firstD': 'Terminer une première course', 'bd.ten': '10 courses', 'bd.tenD': 'Terminer 10 courses',
      'bd.fifty': '50 courses', 'bd.fiftyD': 'Terminer 50 courses', 'bd.star': 'Étoile', 'bd.starD': 'Note de 4,8 ou plus sur 5 notes',
      'bd.early': 'Lève-tôt', 'bd.earlyD': 'Une course terminée avant 8 h',
      'dd.decline': 'Refuser', 'dd.why': 'Pourquoi refusez-vous ? (aide à améliorer les demandes)', 'dd.far': 'Trop loin', 'dd.low': 'Prix trop bas',
      'dd.vehicle': 'Véhicule inadapté', 'dd.heavy': 'Chargement trop lourd', 'dd.other': 'Autre'
    },
    en: {
      'dh.morning': 'Good morning', 'dh.afternoon': 'Good afternoon', 'dh.evening': 'Good evening', 'dh.today': 'Earned today', 'dh.of': 'of {g} FCFA',
      'dh.start': 'Ready for your first trip of the day?', 'dh.left': 'Only {n} left to reach your goal.',
      'dh.goalDone': 'Daily goal reached. Well done!', 'dh.onlineTime': 'Online', 'dh.goal': 'Goal',
      'dh.go': 'Go online', 'dh.goS': 'Receive requests near you', 'dh.searching': 'Looking for trips for your {v}…',
      'dh.zones': 'Busy areas right now', 'dh.req1': '1 request', 'dh.reqN': '{n} requests', 'dh.badges': 'My achievements',
      'dh.done': 'Trip completed!',
      'bd.first': '1st trip', 'bd.firstD': 'Complete a first trip', 'bd.ten': '10 trips', 'bd.tenD': 'Complete 10 trips',
      'bd.fifty': '50 trips', 'bd.fiftyD': 'Complete 50 trips', 'bd.star': 'Star', 'bd.starD': 'Rating of 4.8 or more over 5 ratings',
      'bd.early': 'Early bird', 'bd.earlyD': 'A trip completed before 8 am',
      'dd.decline': 'Decline', 'dd.why': 'Why are you declining? (helps improve requests)', 'dd.far': 'Too far', 'dd.low': 'Price too low',
      'dd.vehicle': 'Wrong vehicle', 'dd.heavy': 'Load too heavy', 'dd.other': 'Other'
    }
  });
  // Accueil chauffeur : salutation, objectif du jour, mise en ligne, zones demandées, badges.
  const GOALS = [10000, 15000, 20000, 30000];
  const BADGES = [
    ['first', d => d.trips >= 1], ['ten', d => d.trips >= 10], ['fifty', d => d.trips >= 50],
    ['star', d => d.ratingCount >= 5 && store.driverRating(d) >= 4.8], ['early', d => (d.earnings || []).some(x => new Date(x.at).getHours() < 8)]
  ];
  function driverHero(d, open) {
    const e = d.earnings || [];
    const todays = e.filter(x => x.at >= today0());
    const todayNet = todays.reduce((a, x) => a + x.net, 0);
    const goal = d.goal || 15000;
    const pct = Math.min(1, todayNet / goal);
    const mins = Math.round(store.onlineMsSince(d, today0()) / 60000);
    const h = new Date().getHours();
    const R = 54, C = 2 * Math.PI * R;
    const zones = Object.entries(open.reduce((m, o) => (m[o.from] = (m[o.from] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const rating = store.driverRating(d);
    const left = Math.max(0, goal - todayNet);
    return `
      <section class="dhero${d.online ? ' is-on' : ''}">
        <div class="dhero-top">
          <div><small>${esc(t(h < 12 ? 'dh.morning' : h < 18 ? 'dh.afternoon' : 'dh.evening'))}</small><b>${esc(d.firstName)}</b></div>
          <span class="dhero-rating"><span aria-hidden="true">★</span> ${rating.toLocaleString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
        </div>
        <div class="dhero-ring">
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle class="ring-bg" cx="64" cy="64" r="${R}"/>
            <circle class="ring-fg" cx="64" cy="64" r="${R}" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 64 64)"/>
          </svg>
          <div class="ring-txt"><small>${esc(t('dh.today'))}</small><b class="mono">${fmt(todayNet)}</b><span>${esc(t('dh.of', { g: fmt(goal) }))}</span></div>
        </div>
        <p class="dhero-msg">${esc(pct >= 1 ? t('dh.goalDone') : todayNet ? t('dh.left', { n: fcfa(left) }) : t('dh.start'))}</p>
        <div class="dhero-stats">
          <div><b class="mono">${todays.length}</b><small>${esc(t('dg.trips'))}</small></div>
          <div><b class="mono">${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}</b><small>${esc(t('dh.onlineTime'))}</small></div>
          <button type="button" data-act="d-goal-edit"><b class="mono">${fmt(goal)}</b><small>${esc(t('dh.goal'))} ✎</small></button>
        </div>
        ${view.goalEdit ? `<div class="tag-row dhero-goals">${GOALS.map(g => `<button type="button" class="tag${g === goal ? ' is-on' : ''}" data-act="d-goal" data-n="${g}">${fmt(g)}</button>`).join('')}</div>` : ''}
        <button type="button" class="go-btn" data-act="d-online" aria-pressed="${!!d.online}">
          ${d.online ? `<span class="radar" aria-hidden="true"><i></i><i></i><i></i></span>` : ''}
          <b>${esc(t(d.online ? 'dj.online' : 'dh.go'))}</b>
          <small>${esc(d.online ? t('dh.searching', { v: t('veh.' + d.vehicle) }) : t('dh.goS'))}</small>
        </button>
        ${d.online ? `<button type="button" class="link-btn dhero-off" data-act="d-online">${esc(t('dj.goOffline'))}</button>` : ''}
      </section>
      ${zones.length ? `<section class="app-sec">
        <h2 class="app-h">${esc(t('dh.zones'))}</h2>
        <div class="zone-row">${zones.map(([c, n]) => `<span class="zone"><span class="zone-heat" style="--h:${Math.min(1, n / zones[0][1])}" aria-hidden="true"></span><b>${esc(commune(c).name)}</b><small>${esc(t(n > 1 ? 'dh.reqN' : 'dh.req1', { n }))}</small></span>`).join('')}</div>
      </section>` : ''}
      <section class="app-sec">
        <h2 class="app-h">${esc(t('dh.badges'))}</h2>
        <div class="badge-row">${BADGES.map(([k, ok]) => `<span class="badge${ok(d) ? ' is-on' : ''}" title="${esc(t('bd.' + k + 'D'))}"><i aria-hidden="true">${ok(d) ? '★' : '☆'}</i><b>${esc(t('bd.' + k))}</b><small>${esc(t('bd.' + k + 'D'))}</small></span>`).join('')}</div>
      </section>`;
  }

  function driverJobs(d) {
    if (d.status !== 'approved') {
      return `<section class="app-sec">
        <div class="review-card${d.status === 'rejected' ? ' is-ko' : ''}">
          <span class="pill pill-${d.status === 'rejected' ? 'cancelled' : 'open'}">${esc(t('st.' + d.status))}</span>
          <h1 class="app-title">${esc(t(d.status === 'rejected' ? 'da.rejectedT' : 'da.pendingT'))}</h1>
          <p>${esc(d.status === 'rejected' ? d.rejectReason || t('a.rejectWhy') : t('da.pendingS'))}</p>
          ${d.status === 'pending' ? `<p class="hint">${esc(t('da.pendingDemo'))}</p>` : ''}
        </div></section>`;
    }
    const mineActive = store.state.orders.filter(o => o.driver && o.driver.me && ['assigned', 'pickup', 'loading', 'transit', 'arrived'].includes(o.status));
    const open = store.state.orders.filter(o => o.status === 'open');
    const pending = open.filter(o => o.offers.some(of => of.me && !of.declined));
    // Seules les demandes pour le véhicule du chauffeur lui sont proposées.
    const requests = open.filter(o => o.vehicle === d.vehicle && !pending.includes(o) && !(d.declined && d.declined[o.id]));
    const avail = store.available();
    return `
      ${driverHero(d, open.filter(o => o.vehicle === d.vehicle))}
      ${driverTrips(d)}
      ${avail < BALANCE_ALERTS[0] ? `<p class="wallet-alert${avail < BALANCE_ALERTS[1] ? ' is-ko' : ''}">${esc(t(avail < BALANCE_ALERTS[1] ? 'nt.low2' : 'nt.low1', { p: fcfa(avail) }))} <button type="button" class="link-btn" data-act="dtab" data-tab="gains">${esc(t('dj.lowGo'))} ›</button></p>` : ''}
      ${d.online && notifState() === 'default' ? `<div class="notif-hint"><span>${esc(t('nt.enableS'))}</span><button class="btn btn-light btn-sm" type="button" data-act="nt-enable">${esc(t('nt.enable'))}</button></div>` : ''}
      ${view.celebrate ? `<div class="celebrate" role="status"><span class="celebrate-burst" aria-hidden="true"></span>
        <b>${esc(t('dh.done'))}</b><span class="mono">+ ${fcfa(view.celebrate.net)}</span><small>${esc(view.celebrate.msg)}</small></div>` : ''}
      ${mineActive.length ? `<section class="app-sec"><h2 class="app-h">${esc(t('d.myCourse'))}</h2>${mineActive.map(driverCourse).join('')}</section>` : ''}
      ${pending.length ? `<section class="app-sec"><div class="stack">${pending.map(o => {
        const mine = o.offers.find(of => of.me && !of.declined);
        return `<div class="notice">${route(o)} · ${esc(t('d.offerSent', { p: fcfa(mine.price) }))}</div>`;
      }).join('')}</div></section>` : ''}
      ${d.online ? `<section class="app-sec">
        <h2 class="app-h">${esc(t('d.requests'))}</h2>
        ${requests.length ? `<div class="stack">${requests.map(requestCard).join('')}</div>` : `<p class="empty">${esc(t('d.noRequests'))}</p>`}
      </section>` : ''}`;
  }

  function driverGains(d) {
    const e = d.earnings || [];
    const sum = since => e.filter(x => x.at >= since).reduce((a, x) => a + x.net, 0);
    const week = Date.now() - 7 * 864e5;
    return `
      <section class="app-sec">
        <div class="gain-hero">
          <small>${esc(t('dg.today'))}</small>
          <b class="mono">${fmt(sum(today0()))} <small>FCFA</small></b>
          <div class="gain-sub"><span>${esc(t('dg.week'))} <b class="mono">${fcfa(sum(week))}</b></span><span>${esc(t('dg.trips'))} <b class="mono">${e.filter(x => x.at >= week).length}</b></span></div>
        </div>
        ${walletCard(d)}
      </section>
      <section class="app-sec">
        <h2 class="app-h">${esc(t('dg.history'))}</h2>
        ${e.length ? `<ol class="ledger-list">${e.map(x => `<li><span><b>${esc(commune(x.route[0]).name)} → ${esc(commune(x.route[1]).name)}</b>
          <small>${date(x.at)} ${time(x.at)} · ${esc(t('pay.' + x.channel))} · ${esc(t('dg.line', { p: fmt(x.price), n: fmt(x.net) }))}</small></span><span class="mono pos">+ ${fmt(x.net)}</span></li>`).join('')}</ol>`
          : `<p class="empty">${esc(t('dg.noHistory'))}</p>`}
      </section>
      <section class="app-sec">
        <h2 class="app-h">${esc(t('d.ledger'))}</h2>
        ${d.ledger.some(l => !['reserve', 'release'].includes(l.type)) ? `<ol class="ledger-list">${d.ledger.filter(l => !['reserve', 'release'].includes(l.type)).slice(0, 30).map(l => `
          <li><span><b>${esc(t('l.' + l.type))}</b><small>${l.orderId ? esc(l.orderId) + ' · ' : ''}${l.channel ? esc(t('pay.' + l.channel)) + ' · ' : ''}${date(l.at)} ${time(l.at)}</small></span>
          <span class="mono ${['recharge', 'release'].includes(l.type) ? 'pos' : l.type === 'payout' ? 'neutral' : 'neg'}">${l.type === 'recharge' || l.type === 'release' ? '+' : l.type === 'payout' ? '' : '−'} ${fmt(l.amount)}</span></li>`).join('')}</ol>`
          : `<p class="empty">${esc(t('d.noLedger'))}</p>`}
      </section>`;
  }

  function docStatus(iso) {
    if (!iso) return ['', ''];
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return ['dm.exp', 'cancelled'];
    if (ms < 30 * 864e5) return ['dm.soon', 'open'];
    return ['dm.valid', 'delivered'];
  }

  function driverMe(d) {
    const sub = view.dmeSub || '';
    const back = `<button class="link-btn" type="button" data-act="dme-sub" data-sub="">← ${esc(t('dn.me'))}</button>`;
    const longDate = iso => new Date(iso).toLocaleDateString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (sub === 'docs') {
      const docRow = (label, iso) => { const [k, cls] = docStatus(iso); return `<li><span><b>${esc(label)}</b>${iso ? `<small>${esc(t('dm.until', { d: longDate(iso) }))}</small>` : ''}</span>${k ? `<span class="pill pill-${cls}">${esc(t(k))}</span>` : ''}</li>`; };
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('dm.docs'))}</h1>
        <ol class="ledger-list">
          ${docRow(`${t('da.' + d.idType)} · ${d.idNumber}`, '')}
          ${docRow(`${t('da.licenseNumber')} · ${d.licenseCats.join(', ')}`, d.licenseExp)}
          ${docRow(t('da.insurance'), d.insuranceExp)}
          ${docRow(t('dm.inspection'), d.inspectionExp)}
        </ol><p class="hint">${esc(t('dm.docsNote'))}</p></section>`;
    }
    if (sub === 'vehicle') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('dm.vehicle'))}</h1>
        <div class="home-veh">${TK.vehicles.stage(d.vehicle, 'data-none').replace(/<button type="button" class="veh-arrow[^>]*>.<\/button>/g, '')}</div>
        <dl class="kv">
          <div><dt>${esc(t('da.vehType'))}</dt><dd>${esc(t('veh.' + d.vehicle))}</dd></div>
          <div><dt>${esc(t('da.plate'))}</dt><dd><span class="plate mono">${esc(d.plate)}</span></dd></div>
          <div><dt>${esc(t('da.brand'))}</dt><dd>${esc(d.brand)} · ${esc(d.year)}</dd></div>
          <div><dt>${esc(t('da.owner'))}</dt><dd>${esc(t(d.owner === 'yes' ? 'da.ownerYes' : 'da.ownerNo'))}</dd></div>
        </dl></section>`;
    }
    if (sub === 'payout') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('dm.payout'))}</h1>
        <dl class="kv"><div><dt>${esc(t('da.payOp'))}</dt><dd>${esc(t('pay.' + d.payOp))}</dd></div>
          <div><dt>${esc(t('da.payPhone'))}</dt><dd class="mono">${esc(fmtPhone(d.payPhone))}</dd></div></dl>
        <p class="hint">${esc(t('da.payNote'))}</p></section>`;
    }
    if (sub === 'support') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('dm.support'))}</h1>
        <p class="sub">${esc(t('dm.supportS'))}</p>
        <dl class="kv"><div><dt>${esc(t('me.supportPhone'))}</dt><dd>${esc(t('me.tbd'))}</dd></div></dl>
        ${view.supportSent ? `<p class="notice">${esc(t('me.sent'))}</p>` : `<form class="report" id="dSupportForm">
          <label class="field"><span>${esc(t('me.write'))}</span><textarea id="dSupportText" rows="3" placeholder="${esc(t('me.writePh'))}"></textarea></label>
          <button class="btn btn-signal btn-sm" type="submit">${esc(t('t.send'))}</button></form>`}
      </section>`;
    }
    if (sub === 'settings') {
      return `<section class="app-sec">${back}<h1 class="app-title">${esc(t('dm.settings'))}</h1>
        <fieldset class="chips"><legend>${esc(t('me.lang'))}</legend>
          <button type="button" class="chip-btn${TK.getLang() === 'fr' ? ' is-on' : ''}" data-act="set-lang" data-lang="fr">Français</button>
          <button type="button" class="chip-btn${TK.getLang() === 'en' ? ' is-on' : ''}" data-act="set-lang" data-lang="en">English</button>
        </fieldset>
        ${notifSettings()}
        ${dLogoutBlock()}</section>`;
    }
    const rating = store.driverRating(d);
    const item = (key, label, icon, extra) => `<li><button type="button" class="me-item" data-act="dme-sub" data-sub="${key}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"/></svg><span>${esc(label)}</span>${extra || ''}<i aria-hidden="true">›</i></button></li>`;
    const docsWarn = [d.licenseExp, d.insuranceExp, d.inspectionExp].some(x => docStatus(x)[0] !== 'dm.valid');
    return `<section class="app-sec">
        <div class="me-head">
          <span class="me-avatar avatar-ini" aria-hidden="true">${initials(d.firstName + ' ' + d.lastName)}</span>
          <div class="me-id">
            <b>${esc(d.firstName)} ${esc(d.lastName)}</b>
            <span class="mono">${esc(fmtPhone(d.phone))}</span>
            <span><span class="stars">${stars(rating)}</span> ${rating.toLocaleString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${esc(t(d.trips === 1 ? 'dm.trip1' : 'dm.trips', { n: d.trips }))}</span>
          </div>
          <span class="pill pill-${d.status === 'approved' ? 'delivered' : d.status === 'rejected' ? 'cancelled' : 'open'}">${esc(t('st.' + d.status))}</span>
        </div>
        <div class="me-stats">
          <div><b class="plate mono">${esc(d.plate)}</b><small>${esc(t('veh.' + d.vehicle))}</small></div>
          <div><b class="mono">${d.trips}</b><small>${esc(t('dg.trips'))}</small></div>
          <div><b class="mono">${esc(t('da.age', { n: ageOf(d.birth) }))}</b><small>${esc(commune(d.commune).name)}</small></div>
        </div>
        <ul class="me-menu">
          ${item('docs', t('dm.docs'), MENU_ICONS.invoices, docsWarn ? `<span class="me-badge">!</span>` : '')}
          ${item('vehicle', t('dm.vehicle'), 'M3 13h11V6H3zM14 9h4l3 4v3h-7zM6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z')}
          ${item('payout', t('dm.payout'), 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2')}
          ${item('support', t('dm.support'), MENU_ICONS.support)}
          ${item('settings', t('dm.settings'), MENU_ICONS.settings)}
        </ul>
        ${dLogoutBlock()}
      </section>`;
  }

  function dLogoutBlock() {
    if (!view.confirmLogout) return `<button class="link-btn danger" type="button" data-act="logout-ask">${esc(t('me.logout'))}</button>`;
    return `<div class="confirm-inline"><p>${esc(t('me.logoutQ'))}</p><div class="btn-row">
      <button class="btn btn-danger btn-sm" type="button" data-act="d-logout">${esc(t('me.logout'))}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-act="logout-no">${esc(t('a.resetNo'))}</button></div></div>`;
  }

  function requestCard(o) {
    const d = store.driver();
    const c = commission(o.price, o.optionsPrice);
    const avail = store.available();
    const sameVehicle = o.vehicle === d.vehicle;
    const msg = view.offerMsg[o.id];
    const counterOpen = view.counterFor === o.id;
    return `
      <article class="request">
        <div class="request-top">
          <div><b>${route(o)}</b><small>${esc(t('need.' + o.need))} · <span class="mono">${ui.km(o.km)}</span> · ${esc(o.owner === 'me' ? t('role.client') : o.client || '')}</small></div>
        </div>
        <div class="earn-row">
          <div><small>${esc(t('dj.price'))}</small><b class="mono">${fcfa(o.price)}</b></div>
          <div class="earn-net"><small>${esc(t('dj.net'))}</small><b class="mono">${fcfa(net(o))}</b></div>
        </div>
        <p class="request-items">${esc(o.items || '—')}${o.weight ? ` · ${esc(o.weight)}` : ''}</p>
        <p class="request-meta">${esc(t(o.service === 'handling' ? 'svc.handling' : 'svc.transport'))}${o.service === 'handling' ? ` · ${esc(t('w.helpers'))} ${o.helpers}` : ''} · ${esc(t('pay.' + o.payment))} · ${esc(t(+o.passengers ? 'w.passN' : 'w.pass0', { n: +o.passengers || 0 }))} · ${esc(t('d.minPrice', { p: fcfa(o.minimum) }))}</p>
        ${!sameVehicle ? `<p class="hint">${esc(t('d.wrongVehicle', { v: t('veh.' + o.vehicle) }))}</p>` : `
          ${avail < c ? `<p class="field-error">${esc(t('d.need', { m: fcfa(c - avail) }))}</p>` : ''}
          ${msg ? `<p class="field-error">${esc(msg)}</p>` : ''}
          <div class="btn-row">
            <button class="btn btn-signal btn-sm" type="button" data-act="d-accept" data-id="${o.id}"${avail < c ? ' disabled' : ''}>${esc(t('d.accept', { p: fcfa(o.price) }))}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-act="d-counter-open" data-id="${o.id}">${esc(t('d.counter'))}</button>
            <button class="btn btn-ghost btn-sm btn-decline" type="button" data-act="d-decline-open" data-id="${o.id}">${esc(t('dd.decline'))}</button>
          </div>
          ${view.declineFor === o.id ? `<div class="decline-box"><small>${esc(t('dd.why'))}</small><div class="tag-row">
            ${['far', 'low', 'vehicle', 'heavy', 'other'].map(r => `<button type="button" class="tag" data-act="d-decline" data-id="${o.id}" data-r="${r}">${esc(t('dd.' + r))}</button>`).join('')}</div></div>` : ''}
          ${counterOpen ? `<form class="counter-form" data-id="${o.id}">
            <label class="price-input"><input type="number" id="ctr-${o.id}" step="100" min="${o.minimum}" value="${TK.roundUp100(o.price * 1.1)}" inputmode="numeric"><span>FCFA</span></label>
            <button class="btn btn-signal btn-sm" type="submit">${esc(t('d.send'))}</button>
          </form>` : ''}`}
      </article>`;
  }


  // ---------- ADMIN : console d'opérations (organisation type back-office Huolala) ----------
  TK.addStrings({
    fr: {
      'ad.brand': 'Opérations', 'ad.city': 'Ville', 'ad.dash': 'Tableau de bord', 'ad.orders': 'Commandes', 'ad.drivers': 'Chauffeurs',
      'ad.clients': 'Clients', 'ad.finance': 'Finance', 'ad.support': 'Litiges et support', 'ad.pricing': 'Tarifs',
      'ad.today': 'Commandes du jour', 'ad.active': 'En cours', 'ad.delivered': 'Livrées', 'ad.gmv': 'Montant des courses livrées',
      'ad.comm': 'Commissions Takaata', 'ad.online': 'Chauffeurs en ligne', 'ad.registered': 'Clients inscrits', 'ad.cancelled': 'Annulées',
      'ad.todo': 'À traiter', 'ad.todoDrivers': '{n} dossier(s) chauffeur à valider', 'ad.todoDisputes': '{n} litige(s) ouvert(s)',
      'ad.todoOpen': '{n} demande(s) sans chauffeur', 'ad.nothing': 'Rien à traiter pour le moment.', 'ad.recent': 'Dernières commandes',
      'ad.all': 'Toutes', 'ad.f.open': 'En attente', 'ad.f.active': 'En cours', 'ad.f.delivered': 'Livrées', 'ad.f.cancelled': 'Annulées', 'ad.f.dispute': 'Litiges',
      'ad.search': 'Rechercher : n°, commune, client, chauffeur', 'ad.none': 'Aucun résultat.',
      'ad.col.created': 'Créée', 'ad.col.client': 'Client', 'ad.col.driver': 'Chauffeur', 'ad.col.name': 'Nom', 'ad.col.phone': 'Téléphone',
      'ad.col.plate': 'Plaque', 'ad.col.rating': 'Note', 'ad.col.trips': 'Courses', 'ad.col.balance': 'Solde', 'ad.col.status': 'Statut',
      'ad.col.since': 'Inscrit le', 'ad.col.spent': 'Dépensé', 'ad.col.held': 'Réservé', 'ad.col.topups': 'Recharges', 'ad.col.fees': 'Frais débités',
      'ad.col.payouts': 'Reversements', 'ad.col.recon': 'Rapprochement',
      'ad.close': 'Fermer', 'ad.detail': 'Détail', 'ad.priceDetail': 'Détail du prix', 'ad.transport': 'Transport', 'ad.options': 'Options (aides, étages)',
      'ad.fee': 'Commission (15 % du transport)', 'ad.driverNet': 'Net chauffeur', 'ad.cancel': 'Annuler la commande', 'ad.validate': 'Valider la livraison',
      'ad.load': 'Chargement', 'ad.service': 'Service', 'ad.passengers': 'Personnes à bord', 'ad.timeline': 'Suivi',
      'ad.t.pending': 'À valider', 'ad.t.approved': 'Validés', 'ad.t.rejected': 'Refusés', 'ad.t.suspended': 'Suspendus',
      'ad.identity': 'Identité', 'ad.docs': 'Documents', 'ad.photos': '{n} photo(s)', 'ad.vehicle': 'Véhicule', 'ad.payout': 'Paiement des gains',
      'ad.approve': 'Valider le dossier', 'ad.reject': 'Refuser', 'ad.rejectReason': 'Motif du refus', 'ad.suspend': 'Suspendre', 'ad.unsuspend': 'Réactiver',
      'ad.r1': 'Document illisible', 'ad.r2': 'Permis non valable pour ce véhicule', 'ad.r3': 'Assurance ou visite technique expirée', 'ad.r4': 'Informations incohérentes',
      'ad.online1': 'En ligne', 'ad.offline1': 'Hors ligne', 'ad.suspended1': 'Suspendu',
      'ad.finComm': 'Commissions encaissées', 'ad.finOptions': 'Options reversées aux chauffeurs', 'ad.finTopups': 'Recharges des soldes',
      'ad.finBalances': 'Soldes prépayés des chauffeurs', 'ad.finBalancesNote': 'Argent des chauffeurs : ce n’est pas du chiffre d’affaires.',
      'ad.finPayouts': 'Reversements Mobile Money', 'ad.ok': 'Concordant', 'ad.ko': 'Écart',
      'ad.open1': 'Ouvert', 'ad.resolved1': 'Résolu', 'ad.resolve': 'Marquer comme résolu', 'ad.noReports': 'Aucun litige ni message.',
      'ad.priceNote': 'Les nouveaux tarifs s’appliquent aux prochaines commandes. La commission reste de 15 % sur la part transport.',
      'ad.base': 'Base', 'ad.perKm': 'Par km', 'ad.floor': 'Plancher', 'ad.helper': 'Prix par aide', 'ad.floorFee': 'Prix par étage sans ascenseur',
      'ad.save': 'Enregistrer les tarifs', 'ad.saved': 'Tarifs enregistrés', 'ad.defaults': 'Revenir à la grille du business plan',
      'ad.example': 'Exemple : {v}, 10 km → {p}', 'ad.reset': 'Réinitialiser la démo', 'ad.demo': 'Prototype : la console affiche les données de cet appareil.'
    },
    en: {
      'ad.brand': 'Operations', 'ad.city': 'City', 'ad.dash': 'Dashboard', 'ad.orders': 'Orders', 'ad.drivers': 'Drivers',
      'ad.clients': 'Customers', 'ad.finance': 'Finance', 'ad.support': 'Disputes & support', 'ad.pricing': 'Pricing',
      'ad.today': 'Orders today', 'ad.active': 'In progress', 'ad.delivered': 'Delivered', 'ad.gmv': 'Value of delivered trips',
      'ad.comm': 'Takaata commissions', 'ad.online': 'Drivers online', 'ad.registered': 'Registered customers', 'ad.cancelled': 'Cancelled',
      'ad.todo': 'To do', 'ad.todoDrivers': '{n} driver application(s) to review', 'ad.todoDisputes': '{n} open dispute(s)',
      'ad.todoOpen': '{n} request(s) without a driver', 'ad.nothing': 'Nothing to handle right now.', 'ad.recent': 'Latest orders',
      'ad.all': 'All', 'ad.f.open': 'Waiting', 'ad.f.active': 'In progress', 'ad.f.delivered': 'Delivered', 'ad.f.cancelled': 'Cancelled', 'ad.f.dispute': 'Disputes',
      'ad.search': 'Search: no., district, customer, driver', 'ad.none': 'No results.',
      'ad.col.created': 'Created', 'ad.col.client': 'Customer', 'ad.col.driver': 'Driver', 'ad.col.name': 'Name', 'ad.col.phone': 'Phone',
      'ad.col.plate': 'Plate', 'ad.col.rating': 'Rating', 'ad.col.trips': 'Trips', 'ad.col.balance': 'Balance', 'ad.col.status': 'Status',
      'ad.col.since': 'Joined', 'ad.col.spent': 'Spent', 'ad.col.held': 'Held', 'ad.col.topups': 'Top-ups', 'ad.col.fees': 'Fees debited',
      'ad.col.payouts': 'Payouts', 'ad.col.recon': 'Reconciliation',
      'ad.close': 'Close', 'ad.detail': 'Details', 'ad.priceDetail': 'Price breakdown', 'ad.transport': 'Transport', 'ad.options': 'Options (helpers, floors)',
      'ad.fee': 'Commission (15% of transport)', 'ad.driverNet': 'Driver net', 'ad.cancel': 'Cancel the order', 'ad.validate': 'Validate delivery',
      'ad.load': 'Load', 'ad.service': 'Service', 'ad.passengers': 'People on board', 'ad.timeline': 'Tracking',
      'ad.t.pending': 'To review', 'ad.t.approved': 'Approved', 'ad.t.rejected': 'Refused', 'ad.t.suspended': 'Suspended',
      'ad.identity': 'Identity', 'ad.docs': 'Documents', 'ad.photos': '{n} photo(s)', 'ad.vehicle': 'Vehicle', 'ad.payout': 'Earnings payout',
      'ad.approve': 'Approve application', 'ad.reject': 'Refuse', 'ad.rejectReason': 'Reason for refusal', 'ad.suspend': 'Suspend', 'ad.unsuspend': 'Reactivate',
      'ad.r1': 'Unreadable document', 'ad.r2': 'Licence not valid for this vehicle', 'ad.r3': 'Insurance or roadworthiness test expired', 'ad.r4': 'Inconsistent information',
      'ad.online1': 'Online', 'ad.offline1': 'Offline', 'ad.suspended1': 'Suspended',
      'ad.finComm': 'Commissions collected', 'ad.finOptions': 'Options paid to drivers', 'ad.finTopups': 'Balance top-ups',
      'ad.finBalances': 'Drivers’ prepaid balances', 'ad.finBalancesNote': 'Drivers’ money: this is not revenue.',
      'ad.finPayouts': 'Mobile Money payouts', 'ad.ok': 'Matches', 'ad.ko': 'Gap',
      'ad.open1': 'Open', 'ad.resolved1': 'Resolved', 'ad.resolve': 'Mark as resolved', 'ad.noReports': 'No disputes or messages.',
      'ad.priceNote': 'New rates apply to the next orders. The commission stays at 15% of the transport part.',
      'ad.base': 'Base', 'ad.perKm': 'Per km', 'ad.floor': 'Minimum', 'ad.helper': 'Price per helper', 'ad.floorFee': 'Price per floor without lift',
      'ad.save': 'Save rates', 'ad.saved': 'Rates saved', 'ad.defaults': 'Back to the business plan rates',
      'ad.example': 'Example: {v}, 10 km → {p}', 'ad.reset': 'Reset demo', 'ad.demo': 'Prototype: the console shows the data stored on this device.'
    }
  });

  const AD_MODULES = [
    ['dash', 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z'],
    ['analytics', 'M4 20V10M10 20V4M16 20v-7M22 20H2'],
    ['trips', 'M3 17h13V8H3zM16 11h3l2 3v3h-5zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
    ['live', 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
    ['orders', 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4'],
    ['drivers', 'M3 13h11V6H3zM14 9h4l3 4v3h-7zM6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
    ['clients', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6'],
    ['finance', 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2'],
    ['support', 'M4 13a8 8 0 0 1 16 0v4h-4v-5h4M4 12h4v5H4z'],
    ['pricing', 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01'],
    ['team', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4']
  ];
  if (!view.adm) view.adm = { period: 30, mod: 'dash', filter: 'all', q: '', order: null, driver: null, client: null, dtab: 'pending', reason: 'ad.r1' };

  const isDispute = o => o.disputed && o.status === 'arrived';
  const clientName = o => {
    if (o.owner !== 'me') return o.client || '—';
    const u = store.account(o.clientPhone);
    return u ? `${u.firstName} ${u.lastName}` : t('role.client');
  };
  const dt = ts => `${date(ts)} ${time(ts)}`;
  const statusPill = d => d.suspended ? `<span class="pill pill-cancelled">${esc(t('ad.suspended1'))}</span>`
    : `<span class="pill pill-${d.status === 'approved' ? 'delivered' : d.status === 'rejected' ? 'cancelled' : 'open'}">${esc(t('st.' + d.status))}</span>`;

  function adminView() {
    const sess = admSession();
    if (!sess) return adminGate();
    const a = view.adm;
    const s = store.state;
    const allowed = AD_MODULES.filter(([m]) => sess.perms.includes(m) && (m !== 'team' || sess.role === 'owner'));
    if (!allowed.some(([m]) => m === a.mod)) a.mod = allowed[0][0];
    const pendingDrivers = Object.values(s.driverAccounts).filter(d => d.status === 'pending').length;
    const openDisputes = s.reports.filter(r => !r.resolved).length;
    const badge = { drivers: pendingDrivers, support: openDisputes };
    const nav = allowed.map(([m, icon]) => `<button type="button" class="adm-nav${a.mod === m ? ' is-on' : ''}" data-act="adm-mod" data-mod="${m}"${a.mod === m ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"/></svg><span>${esc(t('ad.' + m))}</span>${badge[m] ? `<b class="adm-badge">${badge[m]}</b>` : ''}</button>`).join('');
    const body = { trips: admTrips, team: admTeam, live: admLive, analytics: admAnalytics, dash: admDash, orders: admOrders, drivers: admDrivers, clients: admClients, finance: admFinance, support: admSupport, pricing: admPricing }[a.mod]();
    return `<div class="adm">
      <aside class="adm-side">
        <div class="adm-brand"><span class="brand-mark" aria-hidden="true"></span><div><b>takaata</b><small>${esc(t('ad.brand'))}</small></div></div>
        <label class="adm-city"><span>${esc(t('ad.city'))}</span><select id="adm-city"><option>Abidjan</option></select></label>
        <nav class="adm-navs" aria-label="${esc(t('role.admin'))}">${nav}</nav>
        <div class="adm-foot">
          <div class="adm-user"><b>${esc(sess.name)}</b><button class="link-btn" type="button" data-act="adm-logout">${esc(t('ax.logout'))}</button></div>
          ${sess.role !== 'owner' ? '' : view.confirmReset ? `<div class="confirm-inline"><p>${esc(t('a.resetConfirm'))}</p><div class="btn-row">
            <button class="btn btn-danger btn-sm" type="button" data-act="reset-yes">${esc(t('a.resetYes'))}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-act="reset-no">${esc(t('a.resetNo'))}</button></div></div>`
            : `<button class="link-btn danger" type="button" data-act="reset-ask">${esc(t('ad.reset'))}</button>`}
          <small>${esc(t('ad.demo'))}</small>
        </div>
      </aside>
      <section class="adm-main">
        <header class="adm-top"><h1 class="adm-title">${esc(t('ad.' + a.mod))}</h1><span class="mono adm-date">${esc(new Date().toLocaleDateString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></header>
        ${body}
      </section>
      ${admDrawer()}
    </div>`;
  }

  function tile(label, value, sub, tone) {
    return `<div class="adm-tile${tone ? ' tone-' + tone : ''}"><small>${esc(label)}</small><b class="mono">${value}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  }

  function orderTable(list) {
    if (!list.length) return `<p class="empty">${esc(t('ad.none'))}</p>`;
    return `<div class="table-scroll"><table class="grid-table compact adm-table">
      <thead><tr><th>${esc(t('a.colId'))}</th><th>${esc(t('ad.col.created'))}</th><th>${esc(t('a.colRoute'))}</th><th>${esc(t('a.colVehicle'))}</th><th>${esc(t('ad.col.client'))}</th><th>${esc(t('ad.col.driver'))}</th><th>${esc(t('a.colPrice'))}</th><th>${esc(t('a.colStatus'))}</th></tr></thead>
      <tbody>${list.map(o => `<tr class="adm-row" data-act="adm-order" data-id="${o.id}" tabindex="0">
        <td class="mono">${esc(o.id)}</td><td>${dt(o.createdAt)}</td><td>${route(o)}</td><td>${esc(t('veh.' + o.vehicle))}</td>
        <td>${esc(clientName(o))}</td><td>${o.driver ? esc(o.driver.name) : '—'}</td><td class="mono">${fmt(o.price)}</td>
        <td>${isDispute(o) ? `<span class="pill pill-cancelled">${esc(t('ad.f.dispute'))}</span>` : pill(o.status)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function admDash() {
    const s = store.state, os = s.orders;
    const today = os.filter(o => o.createdAt >= today0());
    const delivered = os.filter(o => o.status === 'delivered');
    const drivers = Object.values(s.driverAccounts);
    const todo = [
      [drivers.filter(d => d.status === 'pending').length, 'ad.todoDrivers', 'drivers'],
      [s.reports.filter(r => !r.resolved).length, 'ad.todoDisputes', 'support'],
      [os.filter(o => o.status === 'open').length, 'ad.todoOpen', 'orders']
    ].filter(([n]) => n);
    return `
      <div class="adm-tiles">
        ${tile(t('ad.today'), fmt(today.length))}
        ${tile(t('ad.active'), fmt(os.filter(o => ['assigned', 'pickup', 'loading', 'transit', 'arrived'].includes(o.status)).length))}
        ${tile(t('ad.delivered'), fmt(delivered.length), '', 'ok')}
        ${tile(t('ad.cancelled'), fmt(os.filter(o => o.status === 'cancelled').length), '', 'ko')}
        ${tile(t('ad.gmv'), fcfa(delivered.reduce((x, o) => x + o.price, 0)))}
        ${tile(t('ad.comm'), fcfa(delivered.reduce((x, o) => x + (o.commission || 0), 0)), '', 'accent')}
        ${tile(t('ad.online'), `${drivers.filter(d => d.online).length} / ${drivers.filter(d => d.status === 'approved').length}`)}
        ${tile(t('ad.registered'), fmt(Object.keys(s.accounts).length))}
      </div>
      <div class="adm-grid2">
        <section class="adm-card"><h2 class="app-h">${esc(t('ad.todo'))}</h2>
          ${todo.length ? `<ul class="adm-todo">${todo.map(([n, k, m]) => `<li><button type="button" data-act="adm-mod" data-mod="${m}"><b class="mono">${n}</b><span>${esc(t(k, { n }))}</span><i aria-hidden="true">›</i></button></li>`).join('')}</ul>`
            : `<p class="empty">${esc(t('ad.nothing'))}</p>`}
        </section>
        <section class="adm-card"><h2 class="app-h">${esc(t('ad.recent'))}</h2>${orderTable(os.slice().sort((x, y) => y.createdAt - x.createdAt).slice(0, 6))}</section>
      </div>`;
  }

  function admOrders() {
    const a = view.adm;
    const q = a.q.trim().toLowerCase();
    const F = {
      all: () => true, open: o => o.status === 'open', active: o => ['assigned', 'pickup', 'loading', 'transit', 'arrived'].includes(o.status) && !isDispute(o),
      delivered: o => o.status === 'delivered', cancelled: o => o.status === 'cancelled', dispute: isDispute
    };
    const os = store.state.orders.slice().sort((x, y) => y.createdAt - x.createdAt);
    const list = os.filter(F[a.filter]).filter(o => !q || [o.id, commune(o.from).name, commune(o.to).name, clientName(o), o.driver && o.driver.name].join(' ').toLowerCase().includes(q));
    return `
      <div class="adm-filters">
        <div class="tag-row adm-chips">${Object.keys(F).map(k => `<button type="button" class="tag${a.filter === k ? ' is-on' : ''}" data-act="adm-filter" data-f="${k}">${esc(t(k === 'all' ? 'ad.all' : 'ad.f.' + k))} <span class="mono">${os.filter(F[k]).length}</span></button>`).join('')}</div>
        <label class="field adm-search"><span class="sr-only">${esc(t('ad.search'))}</span><input id="adm-q" type="search" value="${esc(a.q)}" placeholder="${esc(t('ad.search'))}"></label>
      </div>
      ${orderTable(list)}`;
  }

  function admDrivers() {
    const a = view.adm;
    const all = Object.values(store.state.driverAccounts);
    const T = { pending: d => d.status === 'pending', approved: d => d.status === 'approved' && !d.suspended, rejected: d => d.status === 'rejected', suspended: d => d.suspended };
    const list = all.filter(T[a.dtab]);
    return `
      <div class="tag-row adm-chips">${Object.keys(T).map(k => `<button type="button" class="tag${a.dtab === k ? ' is-on' : ''}" data-act="adm-dtab" data-t="${k}">${esc(t('ad.t.' + k))} <span class="mono">${all.filter(T[k]).length}</span></button>`).join('')}</div>
      ${list.length ? `<div class="table-scroll"><table class="grid-table compact adm-table">
        <thead><tr><th>${esc(t('ad.col.name'))}</th><th>${esc(t('ad.col.phone'))}</th><th>${esc(t('a.colVehicle'))}</th><th>${esc(t('ad.col.plate'))}</th><th>${esc(t('ad.col.rating'))}</th><th>${esc(t('ad.col.trips'))}</th><th>${esc(t('ad.col.balance'))}</th><th>${esc(t('ad.col.status'))}</th></tr></thead>
        <tbody>${list.map(d => `<tr class="adm-row" data-act="adm-driver" data-phone="${d.phone}" tabindex="0">
          <td><b>${esc(d.firstName)} ${esc(d.lastName)}</b></td><td class="mono">${esc(fmtPhone(d.phone))}</td><td>${esc(t('veh.' + d.vehicle))}</td>
          <td class="mono">${esc(d.plate)}</td><td>${store.driverRating(d).toFixed(1)}</td><td class="mono">${d.trips}</td><td class="mono">${fmt(d.balance)}</td>
          <td>${statusPill(d)} ${d.online ? `<span class="pill pill-delivered">${esc(t('ad.online1'))}</span>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>` : `<p class="empty">${esc(t('ad.none'))}</p>`}`;
  }

  function admClients() {
    const s = store.state;
    const list = Object.values(s.accounts);
    if (!list.length) return `<p class="empty">${esc(t('ad.none'))}</p>`;
    return `<div class="table-scroll"><table class="grid-table compact adm-table">
      <thead><tr><th>${esc(t('ad.col.name'))}</th><th>${esc(t('ad.col.phone'))}</th><th>${esc(t('ad.col.since'))}</th><th>${esc(t('ad.col.trips'))}</th><th>${esc(t('ad.col.spent'))}</th><th>${esc(t('ad.col.rating'))}</th></tr></thead>
      <tbody>${list.map(u => {
        const os = s.orders.filter(o => o.clientPhone === u.phone);
        const done = os.filter(o => o.status === 'delivered');
        return `<tr class="adm-row" data-act="adm-client" data-phone="${u.phone}" tabindex="0"><td><b>${esc(u.firstName)} ${esc(u.lastName)}</b></td><td class="mono">${esc(fmtPhone(u.phone))}</td>
          <td>${date(u.createdAt)}</td><td class="mono">${done.length} / ${os.length}</td><td class="mono">${fmt(done.reduce((x, o) => x + o.price, 0))}</td>
          <td>${u.ratingCount ? (u.rating || 5).toFixed(1) : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function admFinance() {
    const s = store.state;
    const delivered = s.orders.filter(o => o.status === 'delivered');
    const drivers = Object.values(s.driverAccounts);
    const sumL = (d, type) => d.ledger.filter(l => l.type === type).reduce((x, l) => x + l.amount, 0);
    const rows = drivers.map(d => {
      const topups = sumL(d, 'recharge'), fees = sumL(d, 'debit');
      const held = Object.values(d.holds || {}).reduce((x, n) => x + n, 0);
      return { d, topups, fees, held, payouts: sumL(d, 'payout'), ok: topups - fees === d.balance };
    });
    return `
      <div class="adm-tiles">
        ${tile(t('ad.finComm'), fcfa(delivered.reduce((x, o) => x + (o.commission || 0), 0)), '', 'accent')}
        ${tile(t('ad.finOptions'), fcfa(delivered.reduce((x, o) => x + Math.min(o.optionsPrice || 0, o.price), 0)))}
        ${tile(t('ad.finTopups'), fcfa(rows.reduce((x, r) => x + r.topups, 0)))}
        ${tile(t('ad.finBalances'), fcfa(drivers.reduce((x, d) => x + d.balance, 0)), t('ad.finBalancesNote'))}
        ${tile(t('ad.finPayouts'), fcfa(rows.reduce((x, r) => x + r.payouts, 0)))}
      </div>
      ${rows.length ? `<div class="table-scroll"><table class="grid-table compact adm-table">
        <thead><tr><th>${esc(t('ad.col.driver'))}</th><th>${esc(t('ad.col.topups'))}</th><th>${esc(t('ad.col.fees'))}</th><th>${esc(t('ad.col.balance'))}</th><th>${esc(t('ad.col.held'))}</th><th>${esc(t('ad.col.payouts'))}</th><th>${esc(t('ad.col.recon'))}</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td><b>${esc(r.d.firstName)} ${esc(r.d.lastName)}</b></td><td class="mono">${fmt(r.topups)}</td><td class="mono">${fmt(r.fees)}</td>
          <td class="mono">${fmt(r.d.balance)}</td><td class="mono">${fmt(r.held)}</td><td class="mono">${fmt(r.payouts)}</td>
          <td><span class="pill pill-${r.ok ? 'delivered' : 'cancelled'}">${esc(t(r.ok ? 'ad.ok' : 'ad.ko'))}</span></td></tr>`).join('')}</tbody>
      </table></div>` : `<p class="empty">${esc(t('ad.none'))}</p>`}`;
  }

  function admSupport() {
    const s = store.state;
    if (!s.reports.length) return `<p class="empty">${esc(t('ad.noReports'))}</p>`;
    return `<ol class="adm-list">${s.reports.map(r => {
      const o = r.orderId && store.getOrder(r.orderId);
      return `<li class="adm-card adm-report${r.resolved ? ' is-done' : ''}${r.urgent ? ' is-urgent' : ''}">
        <div class="adm-report-top"><span class="pill pill-${r.resolved ? 'delivered' : 'open'}">${esc(t(r.resolved ? 'ad.resolved1' : 'ad.open1'))}</span>
          ${o ? `<button type="button" class="link-btn mono" data-act="adm-order" data-id="${o.id}">${esc(o.id)} · ${route(o)}</button>` : ''}<span class="mono adm-date">${dt(r.at)}</span></div>
        <p>${esc(r.text)}</p>
        <div class="btn-row">
          ${o && o.status === 'arrived' ? `<button class="btn btn-signal btn-sm" type="button" data-act="support-close" data-id="${o.id}">${esc(t('ad.validate'))}</button>` : ''}
          ${r.resolved ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="adm-resolve" data-at="${r.at}">${esc(t('ad.resolve'))}</button>`}
        </div></li>`;
    }).join('')}</ol>`;
  }

  function admPricing() {
    const ex = TK.quote('van1t', 10, null).reference;
    return `<form class="adm-card" id="pricingForm">
      <div class="table-scroll"><table class="grid-table compact adm-table">
        <thead><tr><th>${esc(t('a.colVehicle'))}</th><th>${esc(t('ad.base'))}</th><th>${esc(t('ad.perKm'))}</th><th>${esc(t('ad.floor'))}</th></tr></thead>
        <tbody>${VEHICLES.map(v => `<tr><th scope="row">${esc(t('veh.' + v.id))}</th>
          ${['base', 'perKm', 'floor'].map(k => `<td><input class="adm-num mono" type="number" min="0" step="50" id="pr-${v.id}-${k}" value="${v[k]}" aria-label="${esc(t('veh.' + v.id))} · ${esc(t('ad.' + k))}"></td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <div class="row-2">
        <label class="field"><span>${esc(t('ad.helper'))}</span><input class="mono" type="number" min="0" step="50" id="pr-helper" value="${TK.OPTIONS.helper}"></label>
        <label class="field"><span>${esc(t('ad.floorFee'))}</span><input class="mono" type="number" min="0" step="50" id="pr-floor" value="${TK.OPTIONS.floor}"></label>
      </div>
      <p class="hint">${esc(t('ad.priceNote'))} ${esc(t('ad.example', { v: t('veh.van1t'), p: fcfa(ex) }))}</p>
      <label class="field"><span>${esc(t('ad.wa'))}</span><span class="phone-in"><b class="mono">+225</b><input id="pr-wa" type="tel" inputmode="numeric" maxlength="14" value="${esc((store.state.settings || {}).whatsapp || '')}" placeholder="${esc(t('ad.waPh'))}"></span></label>
      <div class="btn-row">
        <button class="btn btn-signal" type="submit">${esc(t('ad.save'))}</button>
        <button class="btn btn-ghost" type="button" data-act="adm-defaults">${esc(t('ad.defaults'))}</button>
      </div>
    </form>`;
  }

  // Fiche latérale : commande, chauffeur ou client.
  function admDrawer() {
    const a = view.adm;
    let title = '', body = '';
    const kv = rows => `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
    if (a.order) {
      const o = store.getOrder(a.order);
      if (!o) { a.order = null; return ''; }
      const fee = o.commission != null ? o.commission : commission(o.price, o.optionsPrice);
      title = `${o.id}`;
      body = `<p class="adm-drawer-route"><b>${route(o)}</b> ${isDispute(o) ? `<span class="pill pill-cancelled">${esc(t('ad.f.dispute'))}</span>` : pill(o.status)}</p>
        ${kv([[t('ad.col.created'), dt(o.createdAt)], [t('ad.col.client'), `${esc(clientName(o))}${o.clientPhone ? ` · <span class="mono">${esc(fmtPhone(o.clientPhone))}</span>` : ''}`],
          [t('ad.col.driver'), o.driver ? `${esc(o.driver.name)} · <span class="mono">${esc(o.driver.plate)}</span>` : '—'], [t('a.colVehicle'), esc(t('veh.' + o.vehicle))],
          [t('ad.service'), esc(t(o.service === 'handling' ? 'svc.handling' : 'svc.transport')) + (o.service === 'handling' ? ` · ${o.helpers}` : '')],
          [t('ad.passengers'), String(+o.passengers || 0)], [t('ad.load'), esc(o.items || '—') + (o.weight ? ` · ${esc(o.weight)}` : '')],
          [t('w.payment'), esc(t('pay.' + o.payment))]])}
        <h3 class="app-h">${esc(t('ad.priceDetail'))}</h3>
        ${kv([[t('ad.transport'), `<span class="mono">${fcfa(Math.max(0, o.price - (o.optionsPrice || 0)))}</span>`], [t('ad.options'), `<span class="mono">${fcfa(Math.min(o.optionsPrice || 0, o.price))}</span>`],
          [t('t.agreed'), `<b class="mono">${fcfa(o.price)}</b>`], [t('ad.fee'), `<span class="mono">${fcfa(fee)}</span>`], [t('ad.driverNet'), `<b class="mono pos">${fcfa(o.price - fee)}</b>`]])}
        ${Object.keys(o.timeline).length ? `<h3 class="app-h">${esc(t('ad.timeline'))}</h3>
        ${kv(Object.entries(o.timeline).map(([k, v]) => [t('status.' + k), `<span class="mono">${dt(v)}</span>`]))}` : ''}
        <div class="btn-row">
          ${o.status === 'arrived' ? `<button class="btn btn-signal btn-sm" type="button" data-act="support-close" data-id="${o.id}">${esc(t('ad.validate'))}</button>` : ''}
          ${['open', 'assigned', 'pickup', 'loading', 'transit'].includes(o.status) ? `<button class="btn btn-danger btn-sm" type="button" data-act="adm-cancel" data-id="${o.id}">${esc(t('ad.cancel'))}</button>` : ''}
        </div>`;
    } else if (a.driver) {
      const d = store.driverAccount(a.driver);
      if (!d) { a.driver = null; return ''; }
      const docRow = (label, n, iso) => { const [k, cls] = docStatus(iso); return [label, `${esc(t('ad.photos', { n: n || 0 }))}${iso ? ` · ${date(new Date(iso).getTime())} <span class="pill pill-${cls}">${esc(t(k))}</span>` : ''}`]; };
      title = `${d.firstName} ${d.lastName}`;
      body = `<p class="adm-drawer-route">${statusPill(d)} <span class="pill">${esc(t(d.online ? 'ad.online1' : 'ad.offline1'))}</span></p>
        <h3 class="app-h">${esc(t('ad.identity'))}</h3>
        ${kv([[t('ad.col.phone'), `<span class="mono">${esc(fmtPhone(d.phone))}</span>`], [t('da.birth'), esc(t('da.age', { n: ageOf(d.birth) }))],
          [t('da.idType'), `${esc(t('da.' + d.idType))} · <span class="mono">${esc(d.idNumber)}</span>`], [t('da.commune'), esc(commune(d.commune).name)]])}
        <h3 class="app-h">${esc(t('ad.docs'))}</h3>
        ${kv([docRow(t('da.idFront') + ' / ' + t('da.idBack'), (d.docs.idFront || 0) + (d.docs.idBack || 0)), docRow(t('da.selfie'), d.docs.selfie),
          docRow(`${t('da.license')} · ${d.licenseCats.join(', ')}`, d.docs.license, d.licenseExp), docRow(t('da.regCard'), d.docs.regCard),
          docRow(t('da.insurance'), d.docs.insurance, d.insuranceExp), docRow(t('dm.inspection'), 0, d.inspectionExp),
          docRow(t('da.vehicleFront') + ' / ' + t('da.vehicleCargo'), (d.docs.vehicleFront || 0) + (d.docs.vehicleCargo || 0))])}
        <h3 class="app-h">${esc(t('ad.vehicle'))}</h3>
        ${kv([[t('da.vehType'), esc(t('veh.' + d.vehicle))], [t('da.plate'), `<span class="plate mono">${esc(d.plate)}</span>`], [t('da.brand'), `${esc(d.brand)} · ${esc(d.year)}`],
          [t('ad.payout'), `${esc(t('pay.' + d.payOp))} · <span class="mono">${esc(fmtPhone(d.payPhone))}</span>`]])}
        ${d.status === 'pending' ? `<div class="adm-actions">
          <button class="btn btn-signal btn-sm" type="button" data-act="adm-approve" data-phone="${d.phone}">${esc(t('ad.approve'))}</button>
          <label class="field field-inline"><span>${esc(t('ad.rejectReason'))}</span><select id="adm-reason">${['ad.r1', 'ad.r2', 'ad.r3', 'ad.r4'].map(k => `<option value="${k}"${a.reason === k ? ' selected' : ''}>${esc(t(k))}</option>`).join('')}</select></label>
          <button class="btn btn-ghost btn-sm" type="button" data-act="adm-reject" data-phone="${d.phone}">${esc(t('ad.reject'))}</button></div>` : ''}
        ${d.status === 'approved' ? `<div class="btn-row"><button class="btn ${d.suspended ? 'btn-signal' : 'btn-danger'} btn-sm" type="button" data-act="adm-suspend" data-phone="${d.phone}">${esc(t(d.suspended ? 'ad.unsuspend' : 'ad.suspend'))}</button></div>` : ''}`;
    } else if (a.client) {
      const u = store.account(a.client);
      if (!u) { a.client = null; return ''; }
      title = `${u.firstName} ${u.lastName}`;
      body = `${kv([[t('ad.col.phone'), `<span class="mono">${esc(fmtPhone(u.phone))}</span>`], [t('ad.col.since'), date(u.createdAt)], [t('ad.col.rating'), u.ratingCount ? (u.rating || 5).toFixed(1) : '—']])}
        <h3 class="app-h">${esc(t('ad.orders'))}</h3>${orderTable(store.state.orders.filter(o => o.clientPhone === u.phone))}`;
    } else return '';
    return `<div class="adm-drawer-bg" data-act="adm-close"></div>
      <aside class="adm-drawer" role="dialog" aria-label="${esc(title)}">
        <header><h2>${esc(title)}</h2><button type="button" class="sheet-x" data-act="adm-close" aria-label="${esc(t('ad.close'))}">✕</button></header>
        <div class="adm-drawer-body">${body}</div>
      </aside>`;
  }


  // ---------- ADMIN · Analyses : données collectées pour améliorer le service ----------
  TK.addStrings({
    fr: {
      'ad.analytics': 'Analyses', 'an.period': 'Période', 'an.d7': '7 jours', 'an.d30': '30 jours', 'an.all': 'Tout',
      'an.created': 'Demandes publiées', 'an.assignRate': 'Taux d’attribution', 'an.assignDelay': 'Délai moyen d’attribution',
      'an.cancelRate': 'Taux d’annulation', 'an.counterRate': 'Contre-offres', 'an.priceGap': 'Prix accepté vs référence',
      'an.declines': 'Refus des chauffeurs', 'an.avgRating': 'Note moyenne des chauffeurs',
      'an.byHour': 'Demandes par heure de la journée', 'an.from': 'Communes de départ', 'an.to': 'Communes d’arrivée',
      'an.routes': 'Trajets les plus demandés', 'an.vehicles': 'Véhicules demandés', 'an.reasons': 'Motifs de refus des chauffeurs',
      'an.cancelStage': 'Annulations : à quel moment ?', 'an.drivers': 'Comportement des chauffeurs',
      'an.c.offers': 'Offres', 'an.c.counter': 'Contre-offres', 'an.c.declines': 'Refus', 'an.c.declineRate': 'Taux de refus',
      'an.c.response': 'Réponse moy.', 'an.c.done': 'Livrées', 'an.c.cancel': 'Annul.', 'an.c.rating': 'Note',
      'an.empty': 'Pas encore assez de données. Les événements s’enregistrent à chaque demande, offre, refus et livraison.',
      'an.seed': 'Générer des données de démonstration', 'an.clear': 'Effacer les données de démonstration', 'an.export': 'Exporter (CSV)',
      'an.demoNote': 'Données de démonstration incluses (simulées sur 30 jours).', 'an.min': '{n} min', 'an.events': '{n} événements enregistrés',
      'an.st.open': 'Avant attribution', 'an.st.assigned': 'Après attribution', 'an.st.pickup': 'Chauffeur en route', 'an.st.loading': 'Au chargement', 'an.st.transit': 'En livraison',
      'an.what': 'Ce qui est collecté : demandes (trajet, véhicule, heure, prix), offres et contre-offres, refus avec motif, attributions et délais, annulations (par qui, à quel moment), livraisons, notes et temps en ligne des chauffeurs.'
    },
    en: {
      'ad.analytics': 'Analytics', 'an.period': 'Period', 'an.d7': '7 days', 'an.d30': '30 days', 'an.all': 'All',
      'an.created': 'Requests posted', 'an.assignRate': 'Assignment rate', 'an.assignDelay': 'Average time to assign',
      'an.cancelRate': 'Cancellation rate', 'an.counterRate': 'Counter-offers', 'an.priceGap': 'Accepted price vs reference',
      'an.declines': 'Driver declines', 'an.avgRating': 'Average driver rating',
      'an.byHour': 'Requests by hour of day', 'an.from': 'Pickup districts', 'an.to': 'Drop-off districts',
      'an.routes': 'Most requested routes', 'an.vehicles': 'Vehicles requested', 'an.reasons': 'Why drivers decline',
      'an.cancelStage': 'Cancellations: at which stage?', 'an.drivers': 'Driver behaviour',
      'an.c.offers': 'Offers', 'an.c.counter': 'Counters', 'an.c.declines': 'Declines', 'an.c.declineRate': 'Decline rate',
      'an.c.response': 'Avg response', 'an.c.done': 'Delivered', 'an.c.cancel': 'Cancel.', 'an.c.rating': 'Rating',
      'an.empty': 'Not enough data yet. Events are recorded at each request, offer, decline and delivery.',
      'an.seed': 'Generate demo data', 'an.clear': 'Clear demo data', 'an.export': 'Export (CSV)',
      'an.demoNote': 'Demo data included (simulated over 30 days).', 'an.min': '{n} min', 'an.events': '{n} events recorded',
      'an.st.open': 'Before assignment', 'an.st.assigned': 'After assignment', 'an.st.pickup': 'Driver on the way', 'an.st.loading': 'At loading', 'an.st.transit': 'In delivery',
      'an.what': 'What is collected: requests (route, vehicle, time, price), offers and counter-offers, declines with reason, assignments and delays, cancellations (by whom, at which stage), deliveries, ratings and drivers’ online time.'
    }
  });

  const pctStr = x => `${Math.round(x * 100)} %`;
  const countBy = (list, key) => Object.entries(list.reduce((m, e) => { const k = typeof key === 'function' ? key(e) : e[key]; if (k != null) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

  // Barres horizontales, une seule série : valeur écrite à côté de chaque barre, info-bulle au survol.
  function hbars(rows, max = 8) {
    if (!rows.length) return `<p class="empty">—</p>`;
    const top = rows.slice(0, max), m = top[0][1] || 1;
    return `<ul class="hbars">${top.map(([label, n]) => `<li tabindex="0" data-tip="${esc(label)} : ${fmt(n)}">
      <span class="hb-label">${esc(label)}</span><span class="hb-track"><i style="width:${Math.max(2, n / m * 100).toFixed(1)}%"></i></span><b class="mono">${fmt(n)}</b></li>`).join('')}</ul>`;
  }
  function vbars(counts) {
    const m = Math.max(1, ...counts);
    return `<div class="vbars" role="img" aria-label="${esc(t('an.byHour'))}">${counts.map((n, h) => `<div class="vb" tabindex="0" data-tip="${h} h – ${h + 1} h : ${fmt(n)}">
      <i style="height:${(n / m * 100).toFixed(1)}%"></i>${h % 3 === 0 ? `<span>${h} h</span>` : ''}</div>`).join('')}</div>`;
  }

  function driverLabel(key) {
    const d = store.driverAccount(key);
    return d ? `${d.firstName} ${d.lastName}` : key;
  }

  function admAnalytics() {
    const a = view.adm;
    const since = a.period ? Date.now() - a.period * 864e5 : 0;
    const ev = store.state.events.filter(e => e.at >= since);
    const by = type => ev.filter(e => e.type === type);
    const created = by('created'), assigned = by('assigned'), cancelled = by('cancelled'), delivered = by('delivered');
    const offers = by('offer'), declined = by('declined'), rated = by('rated');
    const hasDemo = store.state.events.some(e => e.demo);
    const avg = (list, f) => list.length ? list.reduce((x, e) => x + f(e), 0) / list.length : 0;
    const head = `<div class="adm-filters">
        <div class="tag-row adm-chips" role="group" aria-label="${esc(t('an.period'))}">${[[7, 'an.d7'], [30, 'an.d30'], [0, 'an.all']].map(([n, k]) => `<button type="button" class="tag${a.period === n ? ' is-on' : ''}" data-act="an-period" data-n="${n}">${esc(t(k))}</button>`).join('')}</div>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" type="button" data-act="${hasDemo ? 'an-clear' : 'an-seed'}">${esc(t(hasDemo ? 'an.clear' : 'an.seed'))}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="an-export"${ev.length ? '' : ' disabled'}>${esc(t('an.export'))}</button>
        </div>
      </div>
      <p class="hint">${esc(t('an.events', { n: fmt(ev.length) }))}${hasDemo ? ' · ' + esc(t('an.demoNote')) : ''}</p>`;
    if (!created.length) return `${head}<p class="empty">${esc(t('an.empty'))}</p><p class="hint">${esc(t('an.what'))}</p>`;

    const hours = Array(24).fill(0);
    created.forEach(e => { hours[new Date(e.at).getHours()]++; });
    const gap = avg(assigned.filter(e => e.reference), e => e.price / e.reference - 1);
    const drivers = {};
    const D = k => (drivers[k] = drivers[k] || { offers: 0, counter: 0, declines: 0, resp: [], done: 0, cancel: 0, stars: [] });
    offers.forEach(e => { const x = D(e.driver); x.offers++; if (e.kind === 'counter') x.counter++; if (e.delayMs) x.resp.push(e.delayMs); });
    declined.forEach(e => { D(e.driver).declines++; });
    delivered.forEach(e => { if (e.driver) D(e.driver).done++; });
    cancelled.filter(e => e.driver && e.by === 'driver').forEach(e => { D(e.driver).cancel++; });
    rated.forEach(e => { if (e.driver) D(e.driver).stars.push(e.stars); });
    const drows = Object.entries(drivers).map(([k, x]) => Object.assign({ k, rate: x.declines / Math.max(1, x.declines + x.offers) }, x)).sort((p, q) => q.rate - p.rate);
    const mean = arr => arr.length ? arr.reduce((p, q) => p + q, 0) / arr.length : 0;

    return `${head}
      <div class="adm-tiles">
        ${tile(t('an.created'), fmt(created.length))}
        ${tile(t('an.assignRate'), pctStr(assigned.length / created.length), '', 'ok')}
        ${tile(t('an.assignDelay'), esc(t('an.min', { n: (avg(assigned, e => e.delayMs) / 60000).toFixed(1).replace('.', TK.getLang() === 'fr' ? ',' : '.') })))}
        ${tile(t('an.cancelRate'), pctStr(cancelled.length / created.length), '', 'ko')}
        ${tile(t('an.counterRate'), pctStr(offers.filter(e => e.kind === 'counter').length / Math.max(1, offers.length)))}
        ${tile(t('an.priceGap'), `${gap >= 0 ? '+' : ''}${Math.round(gap * 100)} %`, '', 'accent')}
        ${tile(t('an.declines'), fmt(declined.length))}
        ${tile(t('an.avgRating'), rated.length ? avg(rated, e => e.stars).toFixed(2).replace('.', TK.getLang() === 'fr' ? ',' : '.') : '—')}
      </div>
      ${insightsBlock(ev)}
      <section class="adm-card"><h2 class="app-h">${esc(t('an.byHour'))}</h2>${vbars(hours)}</section>
      <div class="adm-grid2 adm-grid2-even">
        <section class="adm-card"><h2 class="app-h">${esc(t('an.from'))}</h2>${hbars(countBy(created, e => commune(e.from).name))}</section>
        <section class="adm-card"><h2 class="app-h">${esc(t('an.to'))}</h2>${hbars(countBy(created, e => commune(e.to).name))}</section>
        <section class="adm-card"><h2 class="app-h">${esc(t('an.routes'))}</h2>${hbars(countBy(created, e => `${commune(e.from).name} → ${commune(e.to).name}`), 6)}</section>
        <section class="adm-card"><h2 class="app-h">${esc(t('an.vehicles'))}</h2>${hbars(countBy(created, e => t('veh.' + e.vehicle)))}</section>
        <section class="adm-card"><h2 class="app-h">${esc(t('an.reasons'))}</h2>${hbars(countBy(declined, e => t('dd.' + (e.reason || 'other'))))}</section>
        <section class="adm-card"><h2 class="app-h">${esc(t('an.cancelStage'))}</h2>${hbars(countBy(cancelled, e => t('an.st.' + (e.stage || 'open'))))}</section>
      </div>
      <section class="adm-card"><h2 class="app-h">${esc(t('an.drivers'))}</h2>
        <div class="table-scroll"><table class="grid-table compact adm-table">
          <thead><tr><th>${esc(t('ad.col.driver'))}</th><th>${esc(t('an.c.offers'))}</th><th>${esc(t('an.c.counter'))}</th><th>${esc(t('an.c.declines'))}</th><th>${esc(t('an.c.declineRate'))}</th><th>${esc(t('an.c.response'))}</th><th>${esc(t('an.c.done'))}</th><th>${esc(t('an.c.cancel'))}</th><th>${esc(t('an.c.rating'))}</th></tr></thead>
          <tbody>${drows.map(x => `<tr><td><b>${esc(driverLabel(x.k))}</b></td><td class="mono">${x.offers}</td><td class="mono">${x.counter}</td><td class="mono">${x.declines}</td>
            <td><span class="pill pill-${x.rate > .5 ? 'cancelled' : x.rate > .25 ? 'open' : 'delivered'}">${pctStr(x.rate)}</span></td>
            <td class="mono">${x.resp.length ? esc(t('an.min', { n: (mean(x.resp) / 60000).toFixed(1).replace('.', TK.getLang() === 'fr' ? ',' : '.') })) : '—'}</td>
            <td class="mono">${x.done}</td><td class="mono">${x.cancel}</td><td class="mono">${x.stars.length ? mean(x.stars).toFixed(1) : '—'}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
      <p class="hint">${esc(t('an.what'))}</p>`;
  }

  function exportEvents() {
    const ev = store.state.events;
    const cols = ['at', 'type', 'orderId', 'from', 'to', 'vehicle', 'need', 'km', 'price', 'asked', 'reference', 'kind', 'driver', 'reason', 'stage', 'by', 'stars', 'delayMs', 'durationMs', 'demo'];
    const cell = v => v == null ? '' : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const csv = [cols.join(';')].concat(ev.map(e => cols.map(c => cell(c === 'at' ? new Date(e.at).toISOString() : e[c])).join(';'))).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `takaata-evenements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------- ADMIN · accès, équipe, alertes intelligentes, carte en direct ----------
  TK.addStrings({
    fr: {
      'ad.live': 'Carte en direct', 'ad.team': 'Équipe et accès',
      'ax.setupT': 'Créer le mot de passe administrateur', 'ax.setupS': 'Ce mot de passe principal donne accès à toute la console. Gardez-le pour vous.',
      'ax.loginT': 'Console Takaata', 'ax.loginS': 'Entrez votre mot de passe administrateur ou le mot de passe que l’on vous a confié.',
      'ax.pass': 'Mot de passe', 'ax.pass2': 'Confirmer le mot de passe', 'ax.create': 'Créer et entrer', 'ax.enter': 'Entrer',
      'ax.short': 'Au moins 8 caractères.', 'ax.mismatch': 'Les deux mots de passe ne sont pas identiques.', 'ax.bad': 'Mot de passe incorrect ou accès expiré.',
      'ax.owner': 'Administrateur principal', 'ax.logout': 'Se déconnecter',
      'ax.demo': 'Prototype : la vérification se fait dans le navigateur. Au lancement, les accès seront contrôlés par le serveur.',
      'tm.members': 'Collaborateurs', 'tm.none': 'Aucun collaborateur pour le moment.', 'tm.new': 'Nouvel accès collaborateur', 'tm.name': 'Nom du collaborateur',
      'tm.namePh': 'ex. Koffi (support)', 'tm.gen': 'Mot de passe généré', 'tm.regen': 'Générer un autre', 'tm.duration': 'Durée de l’accès',
      'tm.d1': '24 heures', 'tm.d7': '7 jours', 'tm.d30': '30 jours', 'tm.dinf': 'Sans expiration', 'tm.perms': 'Rubriques autorisées',
      'tm.add': 'Créer l’accès', 'tm.created': 'Accès créé. Communiquez ce mot de passe à {n} : {p} (il ne sera plus affiché).',
      'tm.until': 'Expire le {d}', 'tm.forever': 'Sans expiration', 'tm.expired': 'Expiré', 'tm.last': 'Dernière connexion : {d}', 'tm.never': 'Jamais connecté',
      'tm.delete': 'Supprimer', 'tm.deleteQ': 'Supprimer l’accès de {n} ?', 'tm.ownerPass': 'Changer mon mot de passe principal', 'tm.saved': 'Mot de passe enregistré',
      'tm.ownerOnly': 'Réservé à l’administrateur principal', 'tm.needName': 'Indiquez le nom du collaborateur.', 'tm.needPerm': 'Cochez au moins une rubrique.',
      'ai.title': 'Alertes et recommandations', 'ai.sub': 'Analyse automatique des données de la période', 'ai.ok': 'Rien d’anormal sur la période.',
      'ai.critical': 'Critique', 'ai.warn': 'À surveiller', 'ai.info': 'Opportunité',
      'ai.lowPriceT': 'Prix jugés trop bas par les chauffeurs', 'ai.lowPrice': '{p} des refus sont pour « prix trop bas ». Piste : relever le prix au km de 5 à 10 % pour {v}, puis comparer le taux de refus sur 2 semaines.',
      'ai.farT': 'Courses jugées trop loin', 'ai.far': '{p} des refus sont pour « trop loin ». Piste : proposer d’abord les demandes aux chauffeurs de la même commune, ou ajouter un forfait d’approche.',
      'ai.declinerT': 'Chauffeurs qui refusent beaucoup', 'ai.decliner': '{n} : {r} de refus sur {k} demandes. Piste : appeler pour comprendre (zone, véhicule, prix) avant toute sanction.',
      'ai.peakT': 'Attente plus longue aux heures de pointe', 'ai.peak': 'Entre {h} h et {h2} h, l’attribution prend {x} fois plus de temps que la moyenne. Piste : inciter des chauffeurs à être en ligne sur ce créneau.',
      'ai.zoneT': 'Zone où les clients abandonnent', 'ai.zone': 'Au départ de {c}, {p} des demandes sont annulées avant l’attribution. Piste : recruter des chauffeurs basés à {c}.',
      'ai.gapT': 'Grille tarifaire peut-être trop basse', 'ai.gap': 'Les prix acceptés dépassent la référence de {p} en moyenne. Piste : relever légèrement la grille pour que le prix proposé corresponde mieux au marché.',
      'ai.cancelT': 'Taux d’annulation élevé', 'ai.cancel': '{p} des demandes sont annulées. Piste : rappeler les clients concernés et vérifier les délais d’attribution.',
      'ai.recruitT': 'Priorité de recrutement', 'ai.recruit': '{v} représente {p} des demandes. Concentrez le recrutement des chauffeurs sur ce véhicule.',
      'ai.llmT': 'Aller plus loin avec une IA', 'ai.llmS': 'Préparez un résumé chiffré de la période et collez-le dans Claude pour obtenir une analyse détaillée et des idées d’amélioration.',
      'ai.prepare': 'Préparer le résumé pour l’IA', 'ai.copy': 'Copier le résumé', 'ai.copied': 'Résumé copié', 'ai.open': 'Ouvrir Claude ›',
      'ai.llmNote': 'Au lancement, cette analyse pourra se faire automatiquement chaque matin via l’API de Claude, depuis le serveur.',
      'lv.busy': 'En course', 'lv.free': 'En ligne, disponible', 'lv.req': 'Demande en attente', 'lv.offline': 'Hors ligne',
      'lv.drivers': 'Chauffeurs', 'lv.refresh': 'Mise à jour toutes les 2 secondes',
      'lv.note': 'Prototype : positions simulées autour des communes. Au lancement, l’app chauffeur enverra sa position GPS et la carte utilisera Google Maps.'
    },
    en: {
      'ad.live': 'Live map', 'ad.team': 'Team & access',
      'ax.setupT': 'Create the admin password', 'ax.setupS': 'This main password unlocks the whole console. Keep it to yourself.',
      'ax.loginT': 'Takaata console', 'ax.loginS': 'Enter your admin password or the password you were given.',
      'ax.pass': 'Password', 'ax.pass2': 'Confirm password', 'ax.create': 'Create and enter', 'ax.enter': 'Enter',
      'ax.short': 'At least 8 characters.', 'ax.mismatch': 'The two passwords do not match.', 'ax.bad': 'Wrong password or expired access.',
      'ax.owner': 'Main administrator', 'ax.logout': 'Sign out',
      'ax.demo': 'Prototype: the check runs in the browser. At launch, access will be checked by the server.',
      'tm.members': 'Team members', 'tm.none': 'No team members yet.', 'tm.new': 'New team member access', 'tm.name': 'Team member name',
      'tm.namePh': 'e.g. Koffi (support)', 'tm.gen': 'Generated password', 'tm.regen': 'Generate another', 'tm.duration': 'Access duration',
      'tm.d1': '24 hours', 'tm.d7': '7 days', 'tm.d30': '30 days', 'tm.dinf': 'No expiry', 'tm.perms': 'Allowed sections',
      'tm.add': 'Create access', 'tm.created': 'Access created. Give this password to {n}: {p} (it will not be shown again).',
      'tm.until': 'Expires {d}', 'tm.forever': 'No expiry', 'tm.expired': 'Expired', 'tm.last': 'Last sign-in: {d}', 'tm.never': 'Never signed in',
      'tm.delete': 'Delete', 'tm.deleteQ': 'Delete {n}’s access?', 'tm.ownerPass': 'Change my main password', 'tm.saved': 'Password saved',
      'tm.ownerOnly': 'Main administrator only', 'tm.needName': 'Enter the team member’s name.', 'tm.needPerm': 'Tick at least one section.',
      'ai.title': 'Alerts and recommendations', 'ai.sub': 'Automatic analysis of the period’s data', 'ai.ok': 'Nothing unusual in this period.',
      'ai.critical': 'Critical', 'ai.warn': 'Watch', 'ai.info': 'Opportunity',
      'ai.lowPriceT': 'Drivers find prices too low', 'ai.lowPrice': '{p} of declines are “price too low”. Idea: raise the per-km rate by 5–10% for {v}, then compare the decline rate over 2 weeks.',
      'ai.farT': 'Trips judged too far', 'ai.far': '{p} of declines are “too far”. Idea: offer requests first to drivers in the same district, or add an approach fee.',
      'ai.declinerT': 'Drivers who decline a lot', 'ai.decliner': '{n}: {r} declines out of {k} requests. Idea: call them to understand (area, vehicle, price) before any sanction.',
      'ai.peakT': 'Longer waits at peak hours', 'ai.peak': 'Between {h}:00 and {h2}:00, assignment takes {x} times longer than average. Idea: encourage drivers to be online at that time.',
      'ai.zoneT': 'Area where customers give up', 'ai.zone': 'From {c}, {p} of requests are cancelled before assignment. Idea: recruit drivers based in {c}.',
      'ai.gapT': 'Rates may be too low', 'ai.gap': 'Accepted prices exceed the reference by {p} on average. Idea: raise the rates slightly so the suggested price matches the market.',
      'ai.cancelT': 'High cancellation rate', 'ai.cancel': '{p} of requests are cancelled. Idea: call the customers concerned and check assignment times.',
      'ai.recruitT': 'Recruitment priority', 'ai.recruit': '{v} accounts for {p} of requests. Focus driver recruitment on this vehicle.',
      'ai.llmT': 'Go further with AI', 'ai.llmS': 'Prepare a figure-based summary of the period and paste it into Claude for a detailed analysis and improvement ideas.',
      'ai.prepare': 'Prepare the summary for AI', 'ai.copy': 'Copy summary', 'ai.copied': 'Summary copied', 'ai.open': 'Open Claude ›',
      'ai.llmNote': 'At launch, this analysis can run automatically every morning through the Claude API, from the server.',
      'lv.busy': 'On a trip', 'lv.free': 'Online, available', 'lv.req': 'Waiting request', 'lv.offline': 'Offline',
      'lv.drivers': 'Drivers', 'lv.refresh': 'Updated every 2 seconds',
      'lv.note': 'Prototype: simulated positions around districts. At launch, the driver app will send its GPS position and the map will use Google Maps.'
    }
  });

  const ALL_MODS = ['dash', 'analytics', 'trips', 'live', 'orders', 'drivers', 'clients', 'finance', 'support', 'pricing', 'team'];
  const STAFF_DEFAULT = ['dash', 'analytics', 'trips', 'live', 'orders', 'drivers', 'clients', 'support'];
  const DURATIONS = [['tm.d1', 864e5], ['tm.d7', 7 * 864e5], ['tm.d30', 30 * 864e5], ['tm.dinf', 0]];
  const genPass = () => { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = () => a[Math.floor(Math.random() * a.length)]; return `${r()}${r()}${r()}${r()}-${r()}${r()}${r()}${r()}`; };
  const admHash = pass => hashPass('admin', pass);

  // Session de la console (onglet courant).
  function admSession() {
    let sess = null;
    try { sess = JSON.parse(sessionStorage.getItem('takaata.adm') || 'null'); } catch (e) { sess = view.admSess || null; }
    if (!sess) sess = view.admSess || null;
    if (sess && sess.role === 'staff') {
      const m = store.adminState().staff.find(x => x.id === sess.id);
      if (!m || (m.expiresAt && m.expiresAt < Date.now())) return null;
      return { role: 'staff', id: m.id, name: m.name, perms: m.perms };
    }
    return sess && sess.role === 'owner' && store.adminState().ownerHash ? { role: 'owner', name: t('ax.owner'), perms: ALL_MODS } : null;
  }
  function setAdmSession(sess) {
    view.admSess = sess;
    try { if (sess) sessionStorage.setItem('takaata.adm', JSON.stringify(sess)); else sessionStorage.removeItem('takaata.adm'); } catch (e) { /* stockage indisponible */ }
  }

  function adminGate() {
    const A = store.adminState();
    const err = view.admErr ? `<p class="field-error" role="alert">${esc(view.admErr)}</p>` : '';
    const setup = !A.ownerHash;
    return `<section class="app-sec auth adm-gate">
      <div class="auth-head"><span class="brand-mark auth-mark" aria-hidden="true"></span>
        <h1 class="app-title">${esc(t(setup ? 'ax.setupT' : 'ax.loginT'))}</h1><p class="sub">${esc(t(setup ? 'ax.setupS' : 'ax.loginS'))}</p></div>
      <form class="auth-form" id="admGateForm" novalidate>
        <label class="field"><span>${esc(t('ax.pass'))}</span><input id="adm-pass" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}"></label>
        ${setup ? `<label class="field"><span>${esc(t('ax.pass2'))}</span><input id="adm-pass2" type="password" autocomplete="new-password"></label><p class="hint">${esc(t('ax.short'))}</p>` : ''}
        ${err}
        <button class="btn btn-signal btn-block" type="submit">${esc(t(setup ? 'ax.create' : 'ax.enter'))}</button>
      </form>
      <p class="hint">${esc(t('ax.demo'))}</p>
    </section>`;
  }

  async function submitAdmGate() {
    const A = store.adminState();
    const p = document.getElementById('adm-pass').value;
    view.admErr = '';
    if (!A.ownerHash) {
      if (p.length < 8) { view.admErr = t('ax.short'); return render(); }
      if (p !== document.getElementById('adm-pass2').value) { view.admErr = t('ax.mismatch'); return render(); }
      store.setOwnerHash(await admHash(p));
      setAdmSession({ role: 'owner' });
      return dgo();
    }
    const h = await admHash(p);
    if (h === A.ownerHash) { setAdmSession({ role: 'owner' }); return dgo(); }
    const m = A.staff.find(x => x.hash === h && (!x.expiresAt || x.expiresAt > Date.now()));
    if (m) { setAdmSession({ role: 'staff', id: m.id }); store.touchStaff(m.id); return dgo(); }
    view.admErr = t('ax.bad');
    render();
  }

  function admTeam() {
    const A = store.adminState();
    const f = view.teamForm || (view.teamForm = { name: '', pass: genPass(), dur: 7 * 864e5, perms: STAFF_DEFAULT.slice() });
    const longDt = ts => new Date(ts).toLocaleString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      ${view.teamCreated ? `<p class="notice notice-ok" role="status">${esc(t('tm.created', view.teamCreated))}</p>` : ''}
      <section class="adm-card"><h2 class="app-h">${esc(t('tm.members'))}</h2>
        ${A.staff.length ? `<ul class="adm-list team-list">${A.staff.map(m => {
          const expired = m.expiresAt && m.expiresAt < Date.now();
          return `<li class="team-row">
            <div class="team-main"><b>${esc(m.name)}</b>
              <small>${esc(expired ? t('tm.expired') : m.expiresAt ? t('tm.until', { d: longDt(m.expiresAt) }) : t('tm.forever'))} · ${esc(m.lastLogin ? t('tm.last', { d: longDt(m.lastLogin) }) : t('tm.never'))}</small>
              <div class="tag-row team-perms">${m.perms.map(k => `<span class="tag is-on">${esc(t('ad.' + k))}</span>`).join('')}</div></div>
            ${view.teamDelete === m.id ? `<div class="confirm-inline"><p>${esc(t('tm.deleteQ', { n: m.name }))}</p><div class="btn-row">
              <button class="btn btn-danger btn-sm" type="button" data-act="tm-del-yes" data-id="${m.id}">${esc(t('tm.delete'))}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-act="tm-del-no">${esc(t('a.resetNo'))}</button></div></div>`
              : `<button class="btn btn-ghost btn-sm btn-decline" type="button" data-act="tm-del" data-id="${m.id}">${esc(t('tm.delete'))}</button>`}
            ${expired ? `<span class="pill pill-cancelled">${esc(t('tm.expired'))}</span>` : ''}
          </li>`;
        }).join('')}</ul>` : `<p class="empty">${esc(t('tm.none'))}</p>`}
      </section>
      <form class="adm-card" id="teamForm" novalidate>
        <h2 class="app-h">${esc(t('tm.new'))}</h2>
        <div class="row-2">
          <label class="field"><span>${esc(t('tm.name'))}</span><input id="tm-name" value="${esc(f.name)}" placeholder="${esc(t('tm.namePh'))}"></label>
          <div class="field"><span>${esc(t('tm.gen'))}</span><div class="gen-pass"><b class="mono select-all">${esc(f.pass)}</b><button class="btn btn-ghost btn-sm" type="button" data-act="tm-regen">${esc(t('tm.regen'))}</button></div></div>
        </div>
        <fieldset class="chips"><legend>${esc(t('tm.duration'))}</legend>
          ${DURATIONS.map(([k, ms]) => `<label class="chip-radio"><input type="radio" name="tm-dur" id="tm-dur-${ms}" value="${ms}"${f.dur === ms ? ' checked' : ''}><span>${esc(t(k))}</span></label>`).join('')}
        </fieldset>
        <fieldset class="chips"><legend>${esc(t('tm.perms'))}</legend>
          ${ALL_MODS.filter(k => k !== 'team').map(k => `<label class="chip-radio"><input type="checkbox" id="tm-perm-${k}" data-perm="${k}"${f.perms.includes(k) ? ' checked' : ''}><span>${esc(t('ad.' + k))}</span></label>`).join('')}
        </fieldset>
        <p class="field-error" id="tm-err" hidden></p>
        <button class="btn btn-signal" type="submit">${esc(t('tm.add'))}</button>
      </form>
      <form class="adm-card" id="ownerPassForm" novalidate>
        <h2 class="app-h">${esc(t('tm.ownerPass'))}</h2>
        <div class="row-2">
          <label class="field"><span>${esc(t('ax.pass'))}</span><input id="op-pass" type="password" autocomplete="new-password"></label>
          <label class="field"><span>${esc(t('ax.pass2'))}</span><input id="op-pass2" type="password" autocomplete="new-password"></label>
        </div>
        <p class="field-error" id="op-err" hidden></p>
        <button class="btn btn-ghost" type="submit">${esc(t('au.save'))}</button>
      </form>`;
  }

  // Alertes « intelligentes » : règles simples calculées sur les données de la période.
  function insights(ev) {
    const by = type => ev.filter(e => e.type === type);
    const created = by('created'), assigned = by('assigned'), cancelled = by('cancelled'), declined = by('declined'), offers = by('offer');
    const out = [];
    const pct = (a, b) => b ? a / b : 0;
    if (declined.length >= 10) {
      const low = pct(declined.filter(e => e.reason === 'low').length, declined.length);
      const far = pct(declined.filter(e => e.reason === 'far').length, declined.length);
      if (low >= .3) {
        const topV = countBy(declined.filter(e => e.reason === 'low'), 'vehicle')[0];
        out.push(['warn', 'ai.lowPriceT', t('ai.lowPrice', { p: pctStr(low), v: t('veh.' + topV[0]) })]);
      }
      if (far >= .3) out.push(['warn', 'ai.farT', t('ai.far', { p: pctStr(far) })]);
    }
    const per = {};
    declined.forEach(e => { (per[e.driver] = per[e.driver] || { d: 0, o: 0 }).d++; });
    offers.forEach(e => { (per[e.driver] = per[e.driver] || { d: 0, o: 0 }).o++; });
    const decliners = Object.entries(per).filter(([, x]) => x.d + x.o >= 10 && x.d / (x.d + x.o) > .5).sort((a, b) => b[1].d - a[1].d).slice(0, 3);
    if (decliners.length) out.push(['critical', 'ai.declinerT', decliners.map(([k, x]) => t('ai.decliner', { n: driverLabel(k), r: pctStr(x.d / (x.d + x.o)), k: x.d + x.o })).join(' ')]);
    if (assigned.length >= 20) {
      const all = assigned.reduce((a, e) => a + e.delayMs, 0) / assigned.length;
      const hrs = Array.from({ length: 24 }, (_, h) => assigned.filter(e => new Date(e.at).getHours() === h));
      const worst = hrs.map((l, h) => [h, l.length >= 5 ? l.reduce((a, e) => a + e.delayMs, 0) / l.length : 0]).sort((a, b) => b[1] - a[1])[0];
      if (worst[1] > all * 1.3) out.push(['warn', 'ai.peakT', t('ai.peak', { h: worst[0], h2: worst[0] + 1, x: (worst[1] / all).toFixed(1).replace('.', TK.getLang() === 'fr' ? ',' : '.') })]);
    }
    if (created.length >= 20) {
      const zones = countBy(created, 'from').filter(([, n]) => n >= 8).map(([c, n]) => [c, cancelled.filter(e => e.from === c && e.stage === 'open').length / n]).sort((a, b) => b[1] - a[1]);
      if (zones[0] && zones[0][1] >= .12) out.push(['warn', 'ai.zoneT', t('ai.zone', { c: commune(zones[0][0]).name, p: pctStr(zones[0][1]) })]);
      const cr = cancelled.length / created.length;
      if (cr >= .15) out.push(['critical', 'ai.cancelT', t('ai.cancel', { p: pctStr(cr) })]);
      const topV = countBy(created, 'vehicle')[0];
      if (topV && topV[1] / created.length >= .35) out.push(['info', 'ai.recruitT', t('ai.recruit', { v: t('veh.' + topV[0]), p: pctStr(topV[1] / created.length) })]);
    }
    const withRef = assigned.filter(e => e.reference);
    const gap = withRef.length ? withRef.reduce((a, e) => a + e.price / e.reference - 1, 0) / withRef.length : 0;
    if (withRef.length >= 20 && gap >= .05) out.push(['info', 'ai.gapT', t('ai.gap', { p: `${Math.round(gap * 100)} %` })]);
    const rank = { critical: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a[0]] - rank[b[0]]);
  }

  function insightsBlock(ev) {
    const list = insights(ev);
    const icon = { critical: '!', warn: '▲', info: '★' };
    return `<section class="adm-card ai-card">
      <div class="ai-head"><div><h2 class="app-h">${esc(t('ai.title'))}</h2><small class="hint">${esc(t('ai.sub'))}</small></div></div>
      ${list.length ? `<ul class="ai-list">${list.map(([lvl, tk, txt]) => `<li class="ai-item ai-${lvl}">
        <span class="ai-ic" aria-hidden="true">${icon[lvl]}</span>
        <div><span class="ai-lvl">${esc(t('ai.' + lvl))}</span><b>${esc(t(tk))}</b><p>${esc(txt)}</p></div></li>`).join('')}</ul>`
        : `<p class="empty">${esc(t('ai.ok'))}</p>`}
      <div class="ai-llm">
        <b>${esc(t('ai.llmT'))}</b><p class="hint">${esc(t('ai.llmS'))}</p>
        ${view.aiSummary ? `<textarea id="ai-summary" class="ai-summary mono" rows="8" readonly>${esc(view.aiSummary)}</textarea>
          <div class="btn-row"><button class="btn btn-signal btn-sm" type="button" data-act="ai-copy">${esc(t('ai.copy'))}</button>
          <a class="btn btn-ghost btn-sm" href="https://claude.ai/new" target="_blank" rel="noopener">${esc(t('ai.open'))}</a></div>`
          : `<button class="btn btn-ghost btn-sm" type="button" data-act="ai-prepare">${esc(t('ai.prepare'))}</button>`}
        <p class="hint">${esc(t('ai.llmNote'))}</p>
      </div>
    </section>`;
  }

  function aiSummary(ev, period) {
    const by = type => ev.filter(e => e.type === type);
    const created = by('created'), assigned = by('assigned'), cancelled = by('cancelled'), declined = by('declined');
    const top = (rows, n = 5) => rows.slice(0, n).map(([k, v]) => `${k} (${v})`).join(', ');
    return [
      `Takaata — transport de marchandises à la demande à Abidjan. Données de la période : ${period ? period + ' derniers jours' : 'tout l’historique'}.`,
      `Demandes : ${created.length} ; attribuées : ${assigned.length} ; annulées : ${cancelled.length} ; refus de chauffeurs : ${declined.length}.`,
      `Délai moyen d’attribution : ${assigned.length ? (assigned.reduce((a, e) => a + e.delayMs, 0) / assigned.length / 60000).toFixed(1) : '—'} min.`,
      `Communes de départ : ${top(countBy(created, e => commune(e.from).name))}.`,
      `Trajets fréquents : ${top(countBy(created, e => commune(e.from).name + ' → ' + commune(e.to).name))}.`,
      `Véhicules demandés : ${top(countBy(created, e => t('veh.' + e.vehicle)))}.`,
      `Motifs de refus : ${top(countBy(declined, e => t('dd.' + (e.reason || 'other'))))}.`,
      `Annulations par étape : ${top(countBy(cancelled, e => t('an.st.' + (e.stage || 'open'))))}.`,
      `Alertes détectées : ${insights(ev).map(x => t(x[1])).join(' ; ') || 'aucune'}.`,
      '',
      'Question : quelles sont les 5 actions prioritaires pour augmenter le nombre de courses livrées et la satisfaction des clients et des chauffeurs ? Donne des chiffres cibles et un plan sur 30 jours.'
    ].join('\n');
  }

  // Carte en direct : chauffeurs en course, disponibles, et demandes en attente.
  const LB = { minLon: -4.29, maxLon: -3.86, minLat: 5.235, maxLat: 5.515 }, LW = 1000, LH = 620;
  const lp = (lat, lon) => [30 + (lon - LB.minLon) / (LB.maxLon - LB.minLon) * (LW - 60), 30 + (LB.maxLat - lat) / (LB.maxLat - LB.minLat) * (LH - 60)];
  const cp = id => { const c = commune(id); return lp(c.lat, c.lon); };
  const PROG = { assigned: .02, pickup: .05, loading: .1, transit: .55, arrived: .98 };
  function fleet() {
    const now = Date.now(), s = store.state;
    const list = [];
    const active = s.orders.filter(o => o.driver && PROG[o.status] != null);
    const along = o => { const [x1, y1] = cp(o.from), [x2, y2] = cp(o.to); const k = PROG[o.status]; return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]; };
    store.DRIVER_POOL.forEach((d, i) => {
      const o = active.find(x => !x.driver.me && x.driver.name === d.name);
      if (o) return list.push({ name: d.name, status: 'busy', pos: along(o), route: o });
      const slot = Math.floor(now / 120000 + i * 0.37) % 5;           // tour à tour en ligne / hors ligne
      if (slot === 4) return list.push({ name: d.name, status: 'offline' });
      const home = TK.COMMUNES[(i * 3) % TK.COMMUNES.length];
      const a = now / 40000 + i * 1.7, [hx, hy] = lp(home.lat, home.lon);
      list.push({ name: d.name, status: 'free', pos: [hx + Math.cos(a) * 18, hy + Math.sin(a) * 12] });
    });
    Object.values(s.driverAccounts).filter(d => d.status === 'approved').forEach(d => {
      const name = `${d.firstName} ${d.lastName}`;
      const o = active.find(x => x.driver.me);
      if (o && d.phone === s.driverSession) return list.push({ name, status: 'busy', pos: along(o), route: o, real: true });
      if (!d.online) return list.push({ name, status: 'offline', real: true });
      const [x, y] = cp(d.commune);
      list.push({ name, status: 'free', pos: [x + 10, y - 8], real: true });
    });
    return list;
  }

  function admLive() {
    const f = fleet();
    const open = store.state.orders.filter(o => o.status === 'open');
    const count = st => f.filter(x => x.status === st).length;
    const dots = f.filter(x => x.pos);
    return `
      <div class="live-legend">
        <span><i class="lg lg-busy" aria-hidden="true"></i>${esc(t('lv.busy'))} <b class="mono">${count('busy')}</b></span>
        <span><i class="lg lg-free" aria-hidden="true"></i>${esc(t('lv.free'))} <b class="mono">${count('free')}</b></span>
        <span><i class="lg lg-req" aria-hidden="true"></i>${esc(t('lv.req'))} <b class="mono">${open.length}</b></span>
        <span class="hint">${esc(t('lv.offline'))} : <b class="mono">${count('offline')}</b> · ${esc(t('lv.refresh'))}</span>
      </div>
      <div class="adm-grid2 live-grid">
        <section class="adm-card live-map-card">
          <svg class="live-map" viewBox="0 0 ${LW} ${LH}" role="img" aria-label="${esc(t('ad.live'))} · Abidjan">
            <rect class="lv-bg" x="0" y="0" width="${LW}" height="${LH}" rx="14"/>
            <path class="lv-lagoon" d="M60 ${LH * .62} C 250 ${LH * .55}, 420 ${LH * .66}, 560 ${LH * .6} S 820 ${LH * .54}, 960 ${LH * .6}"/>
            ${TK.COMMUNES.map(c => { const [x, y] = lp(c.lat, c.lon); return `<g class="lv-commune"><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="30"/><text x="${x.toFixed(0)}" y="${(y + 48).toFixed(0)}" text-anchor="middle">${esc(c.name)}</text></g>`; }).join('')}
            ${f.filter(x => x.route).map(x => { const [x1, y1] = cp(x.route.from), [x2, y2] = cp(x.route.to); return `<line class="lv-route" x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}"/>`; }).join('')}
            ${open.map((o, i) => { const [x, y] = cp(o.from); return `<g class="lv-req" transform="translate(${(x - 14 + (i % 3) * 10).toFixed(0)},${(y - 20 - Math.floor(i / 3) * 10).toFixed(0)})"><circle class="lv-req-pulse" r="10"/><path d="M0 -12 C 7 -12 10 -6 10 -2 C 10 5 0 12 0 12 C 0 12 -10 5 -10 -2 C -10 -6 -7 -12 0 -12 Z"/><circle class="lv-req-dot" cy="-2" r="3.5"/><title>${esc(route(o))} · ${esc(t('veh.' + o.vehicle))}</title></g>`; }).join('')}
            ${dots.map(x => `<g class="lv-driver lv-${x.status}${x.real ? ' is-real' : ''}" transform="translate(${x.pos[0].toFixed(1)},${x.pos[1].toFixed(1)})"><circle r="${x.real ? 11 : 9}"/><title>${esc(x.name)} · ${esc(t('lv.' + x.status))}</title></g>`).join('')}
          </svg>
          <p class="hint">${esc(t('lv.note'))}</p>
        </section>
        <section class="adm-card"><h2 class="app-h">${esc(t('lv.drivers'))}</h2>
          <ul class="live-list">${f.sort((a, b) => ['busy', 'free', 'offline'].indexOf(a.status) - ['busy', 'free', 'offline'].indexOf(b.status)).map(x => `<li>
            <i class="lg lg-${x.status === 'offline' ? 'off' : x.status}" aria-hidden="true"></i><b>${esc(x.name)}</b>
            <small>${esc(t('lv.' + x.status))}${x.route ? ' · ' + route(x.route) : ''}</small></li>`).join('')}</ul>
        </section>
      </div>`;
  }

  // ---------- NOTIFICATIONS CHAUFFEUR : nouvelles demandes, solde bas ----------
  TK.addStrings({
    fr: {
      'nt.newReq': 'Nouvelle demande', 'nt.reqBody': '{r} · {v} · gain net {n}', 'nt.accept': 'Accepter', 'nt.view': 'Voir', 'nt.close': 'Fermer',
      'nt.sent': 'Offre envoyée au client', 'nt.enable': 'Activer les notifications', 'nt.enableS': 'Recevez les demandes même quand l’application est en arrière-plan.',
      'nt.on': 'Notifications activées', 'nt.blocked': 'Notifications bloquées : autorisez-les dans les réglages du navigateur.', 'nt.unsupported': 'Notifications non disponibles sur cet écran.',
      'nt.low1T': 'Solde bas', 'nt.low1': 'Il vous reste {p} disponibles. Pensez à recharger pour continuer à recevoir des courses.',
      'nt.low2T': 'Solde presque épuisé', 'nt.low2': 'Il ne vous reste que {p}. Rechargez maintenant pour pouvoir accepter de nouvelles courses.',
      'nt.recharge': 'Recharger', 'nt.title': 'Notifications',
      'nt.note': 'Prototype : les notifications marchent quand l’application est ouverte ou en arrière-plan. Pour les recevoir application fermée, il faudra le serveur (notifications push).'
    },
    en: {
      'nt.newReq': 'New request', 'nt.reqBody': '{r} · {v} · net earnings {n}', 'nt.accept': 'Accept', 'nt.view': 'View', 'nt.close': 'Close',
      'nt.sent': 'Offer sent to the customer', 'nt.enable': 'Turn on notifications', 'nt.enableS': 'Get requests even when the app is in the background.',
      'nt.on': 'Notifications on', 'nt.blocked': 'Notifications blocked: allow them in your browser settings.', 'nt.unsupported': 'Notifications are not available on this screen.',
      'nt.low1T': 'Low balance', 'nt.low1': 'You have {p} available. Top up to keep receiving trips.',
      'nt.low2T': 'Balance almost empty', 'nt.low2': 'Only {p} left. Top up now to accept new trips.',
      'nt.recharge': 'Top up', 'nt.title': 'Notifications',
      'nt.note': 'Prototype: notifications work while the app is open or in the background. Receiving them with the app closed will need the server (push notifications).'
    }
  });

  const BALANCE_ALERTS = [10000, 5000];   // alerte à moins de 10 000 FCFA disponibles, puis à moins de 5 000
  const notifState = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  function beep() {
    try {
      const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      [880, 1320].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; g.gain.setValueAtTime(.0001, ctx.currentTime + i * .18);
        g.gain.exponentialRampToValueAtTime(.2, ctx.currentTime + i * .18 + .02); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + i * .18 + .16);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * .18); o.stop(ctx.currentTime + i * .18 + .17);
      });
    } catch (e) { /* son indisponible */ }
  }

  // Notification système (si autorisée et l'app pas au premier plan), sinon bandeau dans l'app.
  function notifyDriver(kind, title, body, data) {
    const outside = document.hidden || currentRole() !== 'driver';
    if (outside && notifState() === 'granted') {
      const opts = { body, tag: kind + (data.orderId || ''), data, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
        actions: kind === 'request' ? [{ action: 'accept', title: t('nt.accept') }, { action: 'open', title: t('nt.view') }] : [{ action: 'open', title: t('nt.recharge') }] };
      const fallback = () => { try { new Notification(title, opts); } catch (e) { /* ignore */ } };
      if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(fallback);
      else fallback();
    }
    view.dnotif = Object.assign({ kind, title, body, at: Date.now() }, data);
    clearTimeout(view.dnotifTimer);
    view.dnotifTimer = setTimeout(() => { view.dnotif = null; render(); }, 25000);
    if (currentRole() === 'driver') beep();
    render();
  }

  function notifBanner() {
    const n = view.dnotif;
    if (!n) return '';
    const o = n.orderId && store.getOrder(n.orderId);
    if (n.kind === 'request' && (!o || o.status !== 'open')) { view.dnotif = null; return ''; }
    return `<div class="notif notif-${n.kind}${n.level === 2 ? ' is-ko' : ''}" role="alert">
      <span class="notif-ic" aria-hidden="true">${n.kind === 'request' ? '●' : '!'}</span>
      <div class="notif-txt"><b>${esc(n.title)}</b><span>${esc(n.body)}</span></div>
      <div class="notif-acts">
        ${n.kind === 'request' ? `<button class="btn btn-signal btn-sm" type="button" data-act="nt-accept" data-id="${n.orderId}">${esc(t('nt.accept'))}</button>
          <button class="btn btn-light btn-sm" type="button" data-act="nt-view">${esc(t('nt.view'))}</button>`
          : `<button class="btn btn-signal btn-sm" type="button" data-act="nt-recharge">${esc(t('nt.recharge'))}</button>`}
        <button class="notif-x" type="button" data-act="nt-close" aria-label="${esc(t('nt.close'))}">✕</button>
      </div></div>`;
  }

  function notifSettings() {
    const st = notifState();
    return `<div class="notif-set"><b>${esc(t('nt.title'))}</b>
      ${st === 'granted' ? `<span class="pill pill-delivered">${esc(t('nt.on'))}</span>`
        : st === 'denied' ? `<p class="hint">${esc(t('nt.blocked'))}</p>`
        : st === 'unsupported' ? `<p class="hint">${esc(t('nt.unsupported'))}</p>`
        : `<p class="hint">${esc(t('nt.enableS'))}</p><button class="btn btn-signal btn-sm" type="button" data-act="nt-enable">${esc(t('nt.enable'))}</button>`}
      <p class="hint">${esc(t('nt.note'))}</p></div>`;
  }

  function requestNotif(o) {
    notifyDriver('request', t('nt.newReq'), t('nt.reqBody', { r: `${commune(o.from).name} → ${commune(o.to).name}`, v: t('veh.' + o.vehicle), n: fcfa(net(o)) }), { orderId: o.id });
  }

  function balanceCheck(d) {
    if (d.status !== 'approved') return;
    const avail = store.available();
    const lvl = avail < BALANCE_ALERTS[1] ? 2 : avail < BALANCE_ALERTS[0] ? 1 : 0;
    const prev = d.balAlert || 0;
    if (lvl === prev) return;
    store.setDriver({ balAlert: lvl });
    if (lvl > prev) notifyDriver('balance', t(lvl === 2 ? 'nt.low2T' : 'nt.low1T'), t(lvl === 2 ? 'nt.low2' : 'nt.low1', { p: fcfa(avail) }), { level: lvl });
  }

  // ---------- VIVRIERS VERS ABIDJAN ----------
  TK.addStrings({
    fr: {
      'need.vivriers': 'Vivriers vers Abidjan', 'needd.vivriers': 'Camions qui descendent de Bouaké, réservation au sac',
      'vv.title': 'Vivriers vers Abidjan', 'vv.lead': 'Réservez votre place dans un camion qui descend de Bouaké. Plus besoin d’attendre au bord de la route : vous savez à quelle heure il passe.',
      'vv.axis': 'Axe Bouaké → Abidjan', 'vv.stop': 'Où montez-vous ?', 'vv.when': 'Quand ?', 'vv.tonight': 'Cette nuit', 'vv.tomorrow': 'Demain soir',
      'vv.load': 'Votre marchandise', 'vv.sac': 'Sacs de 50 kg', 'vv.carton': 'Cartons', 'vv.cageot': 'Cageots', 'vv.qty': 'Quantité',
      'vv.people': 'Personnes qui voyagent avec la marchandise', 'vv.lastMile': 'Continuer jusqu’au marché d’Adjamé à l’arrivée',
      'vv.lastMileS': 'Un tricycle ou une camionnette Takaata vous attend à Gesco.', 'vv.results': 'Camions qui passent', 'vv.none': 'Aucun camion avec assez de place pour cette demande. Essayez un autre point de montée ou demain soir.',
      'vv.passes': 'Passe à {s} vers {h}', 'vv.arrives': 'Arrivée à Gesco vers {h}', 'vv.before5': 'Arrive avant 5 h', 'vv.left': 'Reste {u} places marchandise · {s} place(s) cabine',
      'vv.perUnit': '{p} / unité', 'vv.perSeat': '{p} / personne', 'vv.total': 'Total', 'vv.reserve': 'Réserver · acompte {p}',
      'vv.confirmT': 'Confirmer la réservation', 'vv.deposit': 'Acompte à payer maintenant', 'vv.rest': 'Reste à payer au chauffeur, à la montée', 'vv.payWith': 'Payer l’acompte avec',
      'vv.pay': 'Payer l’acompte {p}', 'vv.depositNote': 'L’acompte bloque votre place. Annulation gratuite jusqu’à {h} h avant le départ ; après, l’acompte revient au chauffeur.',
      'vv.booked': 'Réservation confirmée', 'vv.full': 'Ce camion n’a plus assez de place. Choisissez-en un autre.', 'vv.my': 'Vivriers vers Abidjan',
      'vv.code': 'Code à donner au chauffeur à la montée', 'vv.st.booked': 'Réservé', 'vv.st.boarded': 'À bord', 'vv.st.arrived': 'Arrivé à Abidjan', 'vv.st.completed': 'Terminé', 'vv.st.cancelled': 'Annulé',
      'vv.tl.booked': 'Place réservée', 'vv.tl.departed': 'Le camion a quitté Bouaké', 'vv.tl.arrived': 'Arrivée à Gesco', 'vv.tl.done': 'Trajet terminé',
      'vv.cancel': 'Annuler la réservation', 'vv.refund': 'Acompte remboursé.', 'vv.noRefund': 'Annulation moins de {h} h avant le départ : l’acompte revient au chauffeur.',
      'vv.lastMileOrder': 'Votre course vers Adjamé est commandée : les chauffeurs proches font leurs offres.', 'vv.see': 'Voir la course ›',
      'vv.demoNext': 'Avancer le trajet (démo)', 'vv.example': 'Trajets et prix d’exemple : ils seront remplacés par les vrais trajets des chauffeurs.',
      'vv.dTitle': 'Trajet retour vers Abidjan', 'vv.dLead': 'Vous revenez de Bouaké ? Remplissez votre camion avec les vivriers des commerçantes.',
      'vv.publish': 'Publier un trajet retour', 'vv.dDepart': 'Départ de Bouaké', 'vv.dStops': 'Arrêts où vous prenez des marchandises', 'vv.dCap': 'Capacité (sacs de 50 kg ou équivalent)',
      'vv.dSeats': 'Places en cabine', 'vv.dPrice': 'Votre prix par sac (FCFA)', 'vv.dSeatPrice': 'Votre prix par personne (FCFA)', 'vv.dSend': 'Publier le trajet',
      'vv.dPublished': 'Trajet publié : les commerçantes de l’axe peuvent réserver.', 'vv.dMine': 'Mes trajets vers Abidjan', 'vv.dFill': 'Rempli à {p}',
      'vv.dGross': 'Total réservé {p} · votre gain net {n}', 'vv.dNext.scheduled': 'Je pars de Bouaké', 'vv.dNext.departed': 'Arrivé à Gesco', 'vv.dNext.arrived': 'Clôturer le trajet',
      'vv.dBookings': 'Réservations', 'vv.dNoBook': 'Pas encore de réservation.', 'vv.dCheck': 'code {c}',
      'vv.dBadTime': 'Choisissez une heure de départ à venir.', 'vv.dBadCap': 'Indiquez une capacité et un prix par sac.',
      'ad.trips': 'Trajets vivriers', 'vt.trips': 'Trajets à venir', 'vt.fill': 'Remplissage moyen', 'vt.units': 'Unités réservées', 'vt.onTime': 'Arrivées prévues avant 5 h',
      'vt.col.depart': 'Départ', 'vt.col.arrive': 'Arrivée', 'vt.col.cap': 'Réservé / capacité', 'vt.col.price': 'Prix / sac', 'vt.col.amount': 'Montant',
      'vv.propose': 'Proposer un prix', 'vv.yourPrice': 'Votre prix par sac', 'vv.sendProp': 'Envoyer ma proposition', 'vv.propNote': 'Le chauffeur accepte ou refuse. Vous payez l’acompte seulement s’il accepte.',
      'vv.st.proposed': 'Prix proposé', 'vv.st.accepted': 'Prix accepté', 'vv.st.refused': 'Refusé',
      'vv.waitAnswer': 'Votre proposition de {p} par sac est envoyée. Le chauffeur répond en général en quelques minutes.',
      'vv.acceptedS': 'Le chauffeur accepte {p} par sac. Payez l’acompte pour confirmer votre place.', 'vv.refusedS': 'Le chauffeur a refusé {p} par sac.',
      'vv.atDriverPrice': 'Réserver au prix du chauffeur ({p})', 'vv.propAccepted': 'Votre prix a été accepté', 'vv.propRefused': 'Votre prix a été refusé',
      'vv.waT': 'Pas d’application ? Réservez par WhatsApp', 'vv.waS': 'Envoyez votre demande à Takaata : un agent réserve pour vous et vous confirme par message.',
      'vv.waBtn': 'Réserver par WhatsApp', 'vv.waNone': 'Numéro WhatsApp Takaata à définir par l’administrateur.',
      'vv.waMsg': 'Bonjour Takaata, je veux réserver un camion vers Abidjan. Montée : {s}. Nuit : {n}. Marchandise : {u} {k}. Personnes : {p}.{x}',
      'vv.waLast': ' Continuer jusqu’au marché d’Adjamé.',
      'sf.title': 'Votre sécurité', 'sf.share': 'Partager mon trajet avec un proche', 'sf.shareMsg': 'Je voyage avec Takaata : {d} ({pl}), départ de {s} vers {h}, arrivée prévue à Gesco vers {a}. Code de montée {c}.',
      'sf.sos': 'Urgence', 'sf.sosQ': 'Alerter Takaata maintenant ? Le support vous rappelle immédiatement.', 'sf.sosYes': 'Alerter Takaata', 'sf.sent': 'Alerte envoyée au support Takaata.',
      'sf.numbers': 'Numéros d’urgence (à vérifier) : police 110 ou 111 · pompiers 180 · SAMU 185', 'sf.verified': 'Chauffeur vérifié : pièce d’identité, permis et véhicule contrôlés.',
      'vv.dProps': 'Prix proposés', 'vv.depDue': 'acompte {p} FCFA à encaisser', 'vv.dAccept': 'Accepter', 'vv.dRefuse': 'Refuser', 'vv.dProp': 'propose {p} / sac (votre prix {q})',
      'vv.dNet': 'Total réservé {p} · votre gain net {n} (places passagers sans commission)',
      'ag.title': 'Réservation par WhatsApp ou téléphone', 'ag.sub': 'Un agent saisit la réservation pour une commerçante qui n’a pas l’application.',
      'ag.trip': 'Camion', 'ag.name': 'Nom de la commerçante', 'ag.phone': 'Son numéro', 'ag.paid': 'Acompte', 'ag.paidYes': 'Payé', 'ag.paidNo': 'À payer à la montée',
      'ag.save': 'Enregistrer la réservation', 'ag.done': 'Réservation enregistrée pour {n}.', 'ag.confirm': 'Envoyer la confirmation par WhatsApp',
      'ag.confirmMsg': 'Takaata : votre place est réservée. Camion de {d} ({pl}), passage à {s} vers {h}, arrivée à Gesco vers {a}. {u} {k}, {p} personne(s). Total {t}. Code de montée : {c}.',
      'ag.err': 'Choisissez un camion avec assez de place et un numéro ivoirien valide.',
      'ad.wa': 'Numéro WhatsApp Takaata (réservations des commerçantes)', 'ad.waPh': 'ex. 07 00 00 00 00', 'ad.waSaved': 'Numéro WhatsApp enregistré'
    },
    en: {
      'need.vivriers': 'Produce to Abidjan', 'needd.vivriers': 'Trucks coming down from Bouaké, book per sack',
      'vv.title': 'Produce to Abidjan', 'vv.lead': 'Book your space in a truck coming down from Bouaké. No more waiting by the road: you know when it passes.',
      'vv.axis': 'Bouaké → Abidjan route', 'vv.stop': 'Where do you get on?', 'vv.when': 'When?', 'vv.tonight': 'Tonight', 'vv.tomorrow': 'Tomorrow night',
      'vv.load': 'Your goods', 'vv.sac': '50 kg sacks', 'vv.carton': 'Boxes', 'vv.cageot': 'Crates', 'vv.qty': 'Quantity',
      'vv.people': 'People travelling with the goods', 'vv.lastMile': 'Continue to Adjamé market on arrival',
      'vv.lastMileS': 'A Takaata tricycle or van waits for you at Gesco.', 'vv.results': 'Trucks passing by', 'vv.none': 'No truck with enough space for this request. Try another pickup point or tomorrow night.',
      'vv.passes': 'Passes {s} around {h}', 'vv.arrives': 'Arrives at Gesco around {h}', 'vv.before5': 'Arrives before 5 am', 'vv.left': '{u} goods spaces left · {s} cab seat(s)',
      'vv.perUnit': '{p} / unit', 'vv.perSeat': '{p} / person', 'vv.total': 'Total', 'vv.reserve': 'Book · deposit {p}',
      'vv.confirmT': 'Confirm booking', 'vv.deposit': 'Deposit to pay now', 'vv.rest': 'Balance to pay the driver when boarding', 'vv.payWith': 'Pay the deposit with',
      'vv.pay': 'Pay deposit {p}', 'vv.depositNote': 'The deposit holds your space. Free cancellation up to {h} h before departure; after that, the deposit goes to the driver.',
      'vv.booked': 'Booking confirmed', 'vv.full': 'This truck no longer has enough space. Choose another one.', 'vv.my': 'Produce to Abidjan',
      'vv.code': 'Code to give the driver when boarding', 'vv.st.booked': 'Booked', 'vv.st.boarded': 'On board', 'vv.st.arrived': 'Arrived in Abidjan', 'vv.st.completed': 'Completed', 'vv.st.cancelled': 'Cancelled',
      'vv.tl.booked': 'Space booked', 'vv.tl.departed': 'The truck left Bouaké', 'vv.tl.arrived': 'Arrival at Gesco', 'vv.tl.done': 'Trip completed',
      'vv.cancel': 'Cancel booking', 'vv.refund': 'Deposit refunded.', 'vv.noRefund': 'Cancelled less than {h} h before departure: the deposit goes to the driver.',
      'vv.lastMileOrder': 'Your trip to Adjamé is booked: nearby drivers are sending offers.', 'vv.see': 'See the trip ›',
      'vv.demoNext': 'Advance the trip (demo)', 'vv.example': 'Example trips and prices: they will be replaced by drivers’ real trips.',
      'vv.dTitle': 'Return trip to Abidjan', 'vv.dLead': 'Coming back from Bouaké? Fill your truck with the traders’ produce.',
      'vv.publish': 'Publish a return trip', 'vv.dDepart': 'Departure from Bouaké', 'vv.dStops': 'Stops where you pick up goods', 'vv.dCap': 'Capacity (50 kg sacks or equivalent)',
      'vv.dSeats': 'Cab seats', 'vv.dPrice': 'Your price per sack (FCFA)', 'vv.dSeatPrice': 'Your price per person (FCFA)', 'vv.dSend': 'Publish trip',
      'vv.dPublished': 'Trip published: traders along the route can book.', 'vv.dMine': 'My trips to Abidjan', 'vv.dFill': '{p} full',
      'vv.dGross': 'Total booked {p} · your net {n}', 'vv.dNext.scheduled': 'Leaving Bouaké', 'vv.dNext.departed': 'Arrived at Gesco', 'vv.dNext.arrived': 'Close the trip',
      'vv.dBookings': 'Bookings', 'vv.dNoBook': 'No bookings yet.', 'vv.dCheck': 'code {c}',
      'vv.dBadTime': 'Choose a future departure time.', 'vv.dBadCap': 'Enter a capacity and a price per sack.',
      'ad.trips': 'Produce trips', 'vt.trips': 'Upcoming trips', 'vt.fill': 'Average fill rate', 'vt.units': 'Units booked', 'vt.onTime': 'Planned arrivals before 5 am',
      'vt.col.depart': 'Departure', 'vt.col.arrive': 'Arrival', 'vt.col.cap': 'Booked / capacity', 'vt.col.price': 'Price / sack', 'vt.col.amount': 'Amount',
      'vv.propose': 'Propose a price', 'vv.yourPrice': 'Your price per sack', 'vv.sendProp': 'Send my offer', 'vv.propNote': 'The driver accepts or refuses. You pay the deposit only if they accept.',
      'vv.st.proposed': 'Price proposed', 'vv.st.accepted': 'Price accepted', 'vv.st.refused': 'Refused',
      'vv.waitAnswer': 'Your offer of {p} per sack has been sent. Drivers usually answer within minutes.',
      'vv.acceptedS': 'The driver accepts {p} per sack. Pay the deposit to confirm your space.', 'vv.refusedS': 'The driver refused {p} per sack.',
      'vv.atDriverPrice': 'Book at the driver’s price ({p})', 'vv.propAccepted': 'Your price was accepted', 'vv.propRefused': 'Your price was refused',
      'vv.waT': 'No app? Book on WhatsApp', 'vv.waS': 'Send your request to Takaata: an agent books for you and confirms by message.',
      'vv.waBtn': 'Book on WhatsApp', 'vv.waNone': 'Takaata WhatsApp number to be set by the administrator.',
      'vv.waMsg': 'Hello Takaata, I want to book a truck to Abidjan. Pickup: {s}. Night: {n}. Goods: {u} {k}. People: {p}.{x}',
      'vv.waLast': ' Continue to Adjamé market.',
      'sf.title': 'Your safety', 'sf.share': 'Share my trip with someone', 'sf.shareMsg': 'I am travelling with Takaata: {d} ({pl}), leaving {s} around {h}, expected at Gesco around {a}. Boarding code {c}.',
      'sf.sos': 'Emergency', 'sf.sosQ': 'Alert Takaata now? Support will call you back immediately.', 'sf.sosYes': 'Alert Takaata', 'sf.sent': 'Alert sent to Takaata support.',
      'sf.numbers': 'Emergency numbers (to be checked): police 110 or 111 · fire 180 · ambulance 185', 'sf.verified': 'Verified driver: ID, licence and vehicle checked.',
      'vv.dProps': 'Price offers', 'vv.depDue': 'deposit {p} FCFA to collect', 'vv.dAccept': 'Accept', 'vv.dRefuse': 'Refuse', 'vv.dProp': 'offers {p} / sack (your price {q})',
      'vv.dNet': 'Total booked {p} · your net {n} (passenger seats without commission)',
      'ag.title': 'Booking by WhatsApp or phone', 'ag.sub': 'An agent enters the booking for a trader who does not use the app.',
      'ag.trip': 'Truck', 'ag.name': 'Trader’s name', 'ag.phone': 'Her number', 'ag.paid': 'Deposit', 'ag.paidYes': 'Paid', 'ag.paidNo': 'To pay when boarding',
      'ag.save': 'Save booking', 'ag.done': 'Booking saved for {n}.', 'ag.confirm': 'Send confirmation on WhatsApp',
      'ag.confirmMsg': 'Takaata: your space is booked. Truck of {d} ({pl}), passing {s} around {h}, arriving at Gesco around {a}. {u} {k}, {p} person(s). Total {t}. Boarding code: {c}.',
      'ag.err': 'Choose a truck with enough space and a valid Ivorian number.',
      'ad.wa': 'Takaata WhatsApp number (traders’ bookings)', 'ad.waPh': 'e.g. 07 00 00 00 00', 'ad.waSaved': 'WhatsApp number saved'
    }
  });

  const waLink = (phone, text) => `https://wa.me/${phone ? '225' + phone : ''}?text=${encodeURIComponent(text)}`;
  const pillFor = st => ({ cancelled: 'cancelled', refused: 'cancelled', booked: 'open', proposed: 'open', accepted: 'open' }[st] || 'delivered');
  const hm = ts => new Date(ts).toLocaleTimeString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const dayLabel = ts => new Date(ts).toLocaleDateString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const STOPS = () => store.CORRIDOR.stops;
  // « Cette nuit » = départs entre 18 h aujourd'hui et 6 h demain ; « Demain soir » = la nuit suivante.
  function nightRange(which) {
    const d = new Date(); d.setHours(18, 0, 0, 0);
    if (new Date().getHours() < 6) d.setDate(d.getDate() - 1);
    if (which === 'tomorrow') d.setDate(d.getDate() + 1);
    return [d.getTime(), d.getTime() + 12 * 36e5];
  }
  const vivState = () => view.viv || (view.viv = { stop: 'yamoussoukro', night: 'tonight', kind: 'sac', units: 6, seats: 1, lastMile: true, pay: 'orange', confirm: null });

  function vivriersPanel() {
    const v = vivState();
    const [a, b] = nightRange(v.night);
    const trips = store.tripsState().filter(tr => tr.status === 'scheduled' && tr.depart >= a && tr.depart < b && (tr.from === v.stop || tr.stops.includes(v.stop)) && v.stop !== 'gesco')
      .map(tr => ({ tr, at: store.stopTime(tr, v.stop), load: store.tripLoad(tr) }))
      .filter(x => x.at > Date.now() && x.load.units + v.units <= x.tr.capacity && x.load.seats + v.seats <= x.tr.seats)
      .sort((x, y) => store.arrivalTime(x.tr) - store.arrivalTime(y.tr));
    if (v.confirm) return vivConfirm(v);
    return `
      <section class="viv-intro"><b>${esc(t('vv.title'))}</b><p>${esc(t('vv.lead'))}</p><span class="pill">${esc(t('vv.axis'))}</span></section>
      <section class="viv-form">
        <label class="field"><span>${esc(t('vv.stop'))}</span><select id="vv-stop">${STOPS().filter(s => s.id !== 'gesco').map(s => `<option value="${s.id}"${s.id === v.stop ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <fieldset class="chips"><legend>${esc(t('vv.when'))}</legend>
          ${['tonight', 'tomorrow'].map(k => `<label class="chip-radio"><input type="radio" name="vv-night" value="${k}" data-viv="night"${v.night === k ? ' checked' : ''}><span>${esc(t('vv.' + k))}</span></label>`).join('')}
        </fieldset>
        <fieldset class="chips"><legend>${esc(t('vv.load'))}</legend>
          ${['sac', 'carton', 'cageot'].map(k => `<label class="chip-radio"><input type="radio" name="vv-kind" value="${k}" data-viv="kind"${v.kind === k ? ' checked' : ''}><span>${esc(t('vv.' + k))}</span></label>`).join('')}
        </fieldset>
        <div class="row-2">
          <div class="counter"><span>${esc(t('vv.qty'))}</span><div class="counter-in">
            <button type="button" data-act="vv-count" data-f="units" data-d="-1"${v.units <= 1 ? ' disabled' : ''} aria-label="−">−</button><b class="mono">${v.units}</b>
            <button type="button" data-act="vv-count" data-f="units" data-d="1" aria-label="+">+</button></div></div>
          <div class="counter"><span>${esc(t('vv.people'))}</span><div class="counter-in">
            <button type="button" data-act="vv-count" data-f="seats" data-d="-1"${v.seats <= 0 ? ' disabled' : ''} aria-label="−">−</button><b class="mono">${v.seats}</b>
            <button type="button" data-act="vv-count" data-f="seats" data-d="1"${v.seats >= 2 ? ' disabled' : ''} aria-label="+">+</button></div></div>
        </div>
        <label class="check"><input type="checkbox" id="vv-lastMile"${v.lastMile ? ' checked' : ''}><span>${esc(t('vv.lastMile'))}<small class="hint"> · ${esc(t('vv.lastMileS'))}</small></span></label>
      </section>
      <section class="app-sec">
        <h2 class="app-h">${esc(t('vv.results'))}</h2>
        ${trips.length ? `<div class="stack">${trips.map(({ tr, at, load }) => {
          const q = store.quoteBooking(tr, v.units, v.seats), arr = store.arrivalTime(tr);
          return `<article class="truck-card">
            <div class="truck-top"><div><b>${esc(tr.driverName)}</b><small><span class="stars">★</span> ${tr.rating.toFixed(1)} · ${esc(t('veh.' + tr.vehicle))} · <span class="mono">${esc(tr.plate)}</span></small></div>
              ${new Date(arr).getHours() < 5 || new Date(arr).getHours() >= 18 ? `<span class="pill pill-delivered">${esc(t('vv.before5'))}</span>` : ''}</div>
            <ol class="truck-times">
              <li><b class="mono">${hm(at)}</b><span>${esc(t('vv.passes', { s: store.stopOf(v.stop).name, h: hm(at) }))}</span></li>
              <li><b class="mono">${hm(arr)}</b><span>${esc(t('vv.arrives', { h: hm(arr) }))}</span></li>
            </ol>
            <p class="hint">${esc(t('vv.left', { u: tr.capacity - load.units, s: tr.seats - load.seats }))} · ${esc(t('vv.perUnit', { p: fcfa(tr.pricePerUnit) }))} · ${esc(t('vv.perSeat', { p: fcfa(tr.pricePerSeat) }))}</p>
            <div class="truck-foot"><span>${esc(t('vv.total'))} <b class="mono">${fcfa(q.total)}</b></span>
              <div class="btn-row">
                <button class="btn btn-ghost btn-sm" type="button" data-act="vv-prop-open" data-id="${tr.id}">${esc(t('vv.propose'))}</button>
                <button class="btn btn-signal btn-sm" type="button" data-act="vv-pick" data-id="${tr.id}">${esc(t('vv.reserve', { p: fcfa(q.deposit) }))}</button>
              </div></div>
            ${v.propFor === tr.id ? `<form class="prop-form" data-id="${tr.id}">
              <label class="price-input"><span class="sr-only">${esc(t('vv.yourPrice'))}</span><input type="number" id="vp-${tr.id}" step="50" min="100" value="${TK.roundUp100(tr.pricePerUnit * 0.9)}" inputmode="numeric"><span>FCFA</span></label>
              <button class="btn btn-signal btn-sm" type="submit">${esc(t('vv.sendProp'))}</button>
              <p class="hint">${esc(t('vv.yourPrice'))} · ${esc(t('vv.propNote'))}</p></form>` : ''}
          </article>`;
        }).join('')}</div>` : `<p class="empty">${esc(t('vv.none'))}</p>`}
        <p class="hint">${esc(t('vv.example'))}</p>
      </section>
      ${waCard(v)}`;
  }

  function waCard(v) {
    const num = (store.state.settings || {}).whatsapp;
    const msg = t('vv.waMsg', { s: store.stopOf(v.stop).name, n: t('vv.' + v.night), u: v.units, k: t('vv.' + v.kind).toLowerCase(), p: v.seats, x: v.lastMile ? t('vv.waLast') : '' });
    return `<section class="wa-card">
      <span class="wa-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 1.8 2.6 4.2 4.5 4.6l1-1.2 2 .9c-.3 1.3-1.4 2-2.7 1.7-2.9-.7-5.6-3.4-6.2-6.2-.3-1.3.4-2.4 1.7-2.7l.9 2z"/></svg></span>
      <div><b>${esc(t('vv.waT'))}</b><p class="hint">${esc(t('vv.waS'))}</p>
        ${num ? `<a class="btn btn-wa btn-sm" href="${waLink(num, msg)}" target="_blank" rel="noopener">${esc(t('vv.waBtn'))} · +225 ${esc(num.replace(/(\d{2})(?=\d)/g, '$1 '))}</a>` : `<p class="hint">${esc(t('vv.waNone'))}</p>`}</div>
    </section>`;
  }

  function vivConfirm(v) {
    const tr = store.tripsState().find(x => x.id === v.confirm);
    if (!tr) { v.confirm = null; return vivriersPanel(); }
    const q = store.quoteBooking(tr, v.units, v.seats), at = store.stopTime(tr, v.stop);
    return `<section class="app-sec">
      <button class="link-btn" type="button" data-act="vv-back">← ${esc(t('w.prev'))}</button>
      <h1 class="app-title">${esc(t('vv.confirmT'))}</h1>
      <article class="ticket">
        <div class="ticket-band"><span class="brand-name">takaata</span><span class="mono">${esc(t('vv.title'))}</span></div>
        <div class="ticket-main">
          <div class="ticket-route">
            <div><small>${esc(t('quote.from'))}</small><b class="ticket-code">${esc(store.stopOf(v.stop).name.slice(0, 3).toUpperCase())}</b><span>${esc(store.stopOf(v.stop).name)} · ${hm(at)}</span></div>
            <div class="ticket-line" aria-hidden="true"><i></i><span class="mono">${dayLabel(tr.depart)}</span></div>
            <div class="ta-r"><small>${esc(t('quote.to'))}</small><b class="ticket-code">GES</b><span>Gesco · ${hm(store.arrivalTime(tr))}</span></div>
          </div>
          <dl class="ticket-meta">
            <div><dt>${esc(t('vv.load'))}</dt><dd>${v.units} × ${esc(t('vv.' + v.kind))}</dd></div>
            <div><dt>${esc(t('w.passengers'))}</dt><dd>${v.seats}</dd></div>
            <div><dt>${esc(t('ad.col.driver'))}</dt><dd>${esc(tr.driverName)}</dd></div>
            <div><dt>${esc(t('ad.vehicle'))}</dt><dd>${esc(t('veh.' + tr.vehicle))}</dd></div>
          </dl>
        </div>
        <div class="ticket-tear" aria-hidden="true"></div>
        <dl class="ticket-prices">
          <div><dt>${v.units} × ${fcfa(tr.pricePerUnit)}</dt><dd class="mono">${fcfa(v.units * tr.pricePerUnit)}</dd></div>
          <div><dt>${v.seats} × ${fcfa(tr.pricePerSeat)}</dt><dd class="mono">${fcfa(v.seats * tr.pricePerSeat)}</dd></div>
          <div class="total"><dt>${esc(t('vv.total'))}</dt><dd class="mono">${fcfa(q.total)}</dd></div>
          <div class="min"><dt>${esc(t('vv.deposit'))}</dt><dd class="mono">${fcfa(q.deposit)}</dd></div>
          <div><dt>${esc(t('vv.rest'))}</dt><dd class="mono">${fcfa(q.total - q.deposit)}</dd></div>
        </dl>
      </article>
      ${v.lastMile ? `<p class="notice">${esc(t('vv.lastMile'))} · ${esc(t('vv.lastMileS'))}</p>` : ''}
      <fieldset class="chips"><legend>${esc(t('vv.payWith'))}</legend>
        ${PAYMENTS.slice(1).map(p => `<label class="chip-radio"><input type="radio" name="vv-pay" value="${p}" data-viv="pay"${v.pay === p ? ' checked' : ''}><span>${esc(t('pay.' + p))}</span></label>`).join('')}
      </fieldset>
      <p class="hint">${esc(t('vv.depositNote', { h: store.FREE_CANCEL_H }))}</p>
      ${view.vivErr ? `<p class="field-error">${esc(view.vivErr)}</p>` : ''}
      <button class="btn btn-signal btn-block" type="button" data-act="vv-book" data-id="${tr.id}">${esc(t('vv.pay', { p: fcfa(q.deposit) }))}</button>
    </section>`;
  }

  function bookingView() {
    const found = store.myBookings().find(x => x.b.id === view.bookingId);
    if (!found) { view.name = 'orders'; return ordersView(); }
    const { trip, b } = found;
    const steps = ['booked', 'departed', 'arrived', 'done'];
    const idx = Math.max(0, steps.indexOf(trip.status === 'scheduled' ? 'booked' : trip.status));
    const lm = b.lastMileOrder && store.getOrder(b.lastMileOrder);
    return `<section class="app-sec">
      <div class="wiz-head"><button class="link-btn" type="button" data-act="orders">← ${esc(t('c.history'))}</button><span class="mono">${esc(b.id)}</span></div>
      <div class="order-top"><h1 class="app-title">${esc(store.stopOf(b.stop).name)} → Gesco</h1><span class="pill pill-${pillFor(b.status)}">${esc(t('vv.st.' + b.status))}</span></div>
      <p class="sub">${dayLabel(trip.depart)} · ${esc(t('vv.passes', { s: store.stopOf(b.stop).name, h: hm(store.stopTime(trip, b.stop)) }))} · ${esc(t('vv.arrives', { h: hm(store.arrivalTime(trip)) }))}</p>
      ${b.status !== 'cancelled' ? `<div class="code-box"><span>${esc(t('vv.code'))}</span><b class="mono">${esc((b.phone || '').slice(-4))}</b><small>${esc(t('cv.clientCodeS'))}</small></div>` : ''}
      <article class="driver-card"><span class="avatar avatar-lg" aria-hidden="true">${initials(trip.driverName)}</span>
        <div class="driver-info"><small>${esc(t('t.driver'))}</small><b>${esc(trip.driverName)}</b><span><span class="stars">★</span> ${trip.rating.toFixed(1)} · ${esc(t('veh.' + trip.vehicle))}</span></div>
        <div class="plate mono">${esc(trip.plate)}</div></article>
      ${b.status === 'cancelled' ? '' : `<ol class="timeline">${steps.map((s, i) => `<li class="${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}"><span>${esc(t('vv.tl.' + s))}</span><small class="mono">${s === 'booked' ? hm(b.at) : trip[s + 'At'] ? hm(trip[s + 'At']) : ''}</small></li>`).join('')}</ol>`}
      <dl class="kv">
        <div><dt>${esc(t('vv.load'))}</dt><dd>${b.units} × ${esc(t('vv.' + b.unitKind))} · ${b.seats} pers.</dd></div>
        <div><dt>${esc(t('vv.total'))}</dt><dd class="mono">${fcfa(b.total)}</dd></div>
        <div><dt>${esc(t('vv.yourPrice'))}</dt><dd class="mono">${fcfa(b.unitPrice || trip.pricePerUnit)}</dd></div>
        <div><dt>${esc(t('vv.deposit'))}</dt><dd class="mono">${fcfa(b.deposit)}${b.status === 'booked' || b.paidAt ? ' · ' + esc(t('pay.' + (b.payment || 'orange'))) : ''}</dd></div>
        <div><dt>${esc(t('vv.rest'))}</dt><dd class="mono">${fcfa(b.total - b.deposit)}</dd></div>
      </dl>
      ${b.status === 'cancelled' ? `<p class="notice">${esc(b.refund ? t('vv.refund') : t('vv.noRefund', { h: store.FREE_CANCEL_H }))}</p>` : ''}
      ${b.status === 'proposed' ? `<p class="notice pulse">${esc(t('vv.waitAnswer', { p: fcfa(b.unitPrice) }))}</p>` : ''}
      ${b.status === 'accepted' ? `<div class="confirm-box"><p><b>${esc(t('vv.acceptedS', { p: fcfa(b.unitPrice) }))}</b></p>
        <fieldset class="chips"><legend>${esc(t('vv.payWith'))}</legend>${PAYMENTS.slice(1).map(p => `<label class="chip-radio"><input type="radio" name="vv-pay" value="${p}" data-viv="pay"${vivState().pay === p ? ' checked' : ''}><span>${esc(t('pay.' + p))}</span></label>`).join('')}</fieldset>
        <button class="btn btn-signal btn-block" type="button" data-act="vv-paydep" data-trip="${trip.id}" data-id="${b.id}">${esc(t('vv.pay', { p: fcfa(b.deposit) }))}</button></div>` : ''}
      ${b.status === 'refused' ? `<div class="confirm-inline"><p>${esc(t('vv.refusedS', { p: fcfa(b.unitPrice) }))}</p>
        <button class="btn btn-signal btn-sm" type="button" data-act="vv-pick" data-id="${trip.id}">${esc(t('vv.atDriverPrice', { p: fcfa(trip.pricePerUnit) }))}</button></div>` : ''}
      ${['booked', 'boarded'].includes(b.status) ? safetyBlock(trip, b) : ''}
      ${lm ? `<div class="confirm-box"><p>${esc(t('vv.lastMileOrder'))}</p><button class="btn btn-signal btn-sm" type="button" data-act="open-order" data-id="${lm.id}">${esc(t('vv.see'))}</button></div>` : ''}
      ${trip.status !== 'done' && b.status !== 'cancelled' && trip.sim ? `<button class="link-btn demo-btn" type="button" data-act="vv-advance" data-id="${trip.id}">${esc(t('vv.demoNext'))} →</button>` : ''}
      ${trip.status === 'scheduled' && ['booked', 'proposed', 'accepted'].includes(b.status) ? `<button class="link-btn danger" type="button" data-act="vv-cancel" data-trip="${trip.id}" data-id="${b.id}">${esc(t('vv.cancel'))}</button>` : ''}
    </section>`;
  }

  function safetyBlock(trip, b) {
    const msg = t('sf.shareMsg', { d: trip.driverName, pl: trip.plate, s: store.stopOf(b.stop).name, h: hm(store.stopTime(trip, b.stop)), a: hm(store.arrivalTime(trip)), c: (b.phone || '').slice(-4) });
    return `<section class="safety">
      <h2 class="app-h">${esc(t('sf.title'))}</h2>
      <p class="hint">✓ ${esc(t('sf.verified'))}</p>
      <div class="btn-row">
        <a class="btn btn-wa btn-sm" href="${waLink('', msg)}" target="_blank" rel="noopener">${esc(t('sf.share'))}</a>
        <button class="btn btn-danger btn-sm" type="button" data-act="sf-sos">${esc(t('sf.sos'))}</button>
      </div>
      ${view.sosAsk ? `<div class="confirm-inline"><p>${esc(t('sf.sosQ'))}</p><div class="btn-row">
        <button class="btn btn-danger btn-sm" type="button" data-act="sf-sos-yes" data-trip="${trip.id}" data-id="${b.id}">${esc(t('sf.sosYes'))}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="sf-sos-no">${esc(t('a.resetNo'))}</button></div></div>` : ''}
      <p class="hint">${esc(t('sf.numbers'))}</p>
    </section>`;
  }

  function myBookingsBlock() {
    const list = store.myBookings();
    if (!list.length) return '';
    return `<h2 class="app-h">${esc(t('vv.my'))}</h2><div class="stack">${list.map(({ trip, b }) => `<button class="order-row" type="button" data-act="vv-open" data-id="${b.id}">
      <span class="order-row-main"><b>${esc(store.stopOf(b.stop).name)} → Gesco</b><small>${dayLabel(trip.depart)} · ${hm(store.stopTime(trip, b.stop))} · ${b.units} × ${esc(t('vv.' + b.unitKind))}</small></span>
      <span class="order-row-side"><span class="mono">${fcfa(b.total)}</span><span class="pill pill-${pillFor(b.status)}">${esc(t('vv.st.' + b.status))}</span></span></button>`).join('')}</div>`;
  }

  // Côté chauffeur : publier un trajet retour et suivre ses réservations.
  function driverTrips(d) {
    const mine = store.tripsState().filter(tr => tr.driver === d.phone && tr.status !== 'done');
    const f = view.dtripForm;
    const nextHour = () => { const x = new Date(Date.now() + 36e5); x.setMinutes(0, 0, 0); if (x.getHours() < 18 && x.getHours() > 6) x.setHours(21); const p = n => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:00`; };
    return `<section class="app-sec viv-driver">
      <div class="viv-intro"><b>${esc(t('vv.dTitle'))}</b><p>${esc(t('vv.dLead'))}</p><span class="pill">${esc(t('vv.axis'))}</span></div>
      ${f ? `<form class="auth-form" id="dTripForm" novalidate>
          <label class="field"><span>${esc(t('vv.dDepart'))}</span><input id="tf-depart" type="datetime-local" value="${esc(f.depart || nextHour())}"></label>
          <fieldset class="chips"><legend>${esc(t('vv.dStops'))}</legend>
            ${STOPS().filter(s => !['bouake', 'gesco'].includes(s.id)).map(s => `<label class="chip-radio"><input type="checkbox" data-tstop="${s.id}"${(f.stops || ['yamoussoukro', 'toumodi']).includes(s.id) ? ' checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}
          </fieldset>
          <div class="row-2">
            <label class="field"><span>${esc(t('vv.dCap'))}</span><input id="tf-cap" type="number" inputmode="numeric" min="1" value="${esc(f.capacity || 40)}"></label>
            <label class="field"><span>${esc(t('vv.dSeats'))}</span><select id="tf-seats">${[0, 1, 2].map(n => `<option${n === (f.seats ?? 2) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="field"><span>${esc(t('vv.dPrice'))}</span><input id="tf-price" type="number" inputmode="numeric" min="100" step="100" value="${esc(f.pricePerUnit || 1500)}"></label>
            <label class="field"><span>${esc(t('vv.dSeatPrice'))}</span><input id="tf-seatPrice" type="number" inputmode="numeric" min="0" step="100" value="${esc(f.pricePerSeat || 2000)}"></label>
          </div>
          <p class="field-error" id="tf-err" hidden></p>
          <div class="btn-row"><button class="btn btn-signal" type="submit">${esc(t('vv.dSend'))}</button><button class="btn btn-ghost" type="button" data-act="dtrip-close">${esc(t('a.resetNo'))}</button></div>
        </form>`
        : `<button class="btn btn-signal btn-block" type="button" data-act="dtrip-open">${esc(t('vv.publish'))}</button>`}
      ${mine.length ? `<h2 class="app-h">${esc(t('vv.dMine'))}</h2>${mine.map(tr => {
        const paid = tr.bookings.filter(b => ['booked', 'boarded', 'arrived', 'completed'].includes(b.status) && !b.other);
        const load = store.tripLoad(tr), gross = paid.reduce((a, b) => a + b.total, 0), fees = paid.reduce((a, b) => a + (b.fee || 0), 0);
        const props = tr.bookings.filter(b => b.status === 'proposed');
        return `<article class="request request-active">
          <div class="request-top"><div><b>${dayLabel(tr.depart)} · ${hm(tr.depart)} → ${hm(store.arrivalTime(tr))}</b><small>${tr.stops.map(id => esc(store.stopOf(id).name)).join(' · ')}</small></div>
            <span class="pill pill-${tr.status === 'scheduled' ? 'open' : 'delivered'}">${esc(t('vv.tl.' + (tr.status === 'scheduled' ? 'booked' : tr.status)))}</span></div>
          <div class="weight-bar" aria-hidden="true"><i style="width:${Math.round(load.units / tr.capacity * 100)}%"></i></div>
          <p class="hint">${esc(t('vv.dFill', { p: pctStr(load.units / tr.capacity) }))} · ${load.units}/${tr.capacity} · ${load.seats}/${tr.seats} pers. · ${esc(t('vv.dNet', { p: fcfa(gross), n: fcfa(gross - fees) }))}</p>
          ${props.length ? `<h3 class="app-h">${esc(t('vv.dProps'))}</h3><ul class="ledger-list">${props.map(b => `<li><span><b>${esc(b.client)}</b><small>${esc(store.stopOf(b.stop).name)} · ${b.units} × ${esc(t('vv.' + b.unitKind))} · ${esc(t('vv.dProp', { p: fcfa(b.unitPrice), q: fcfa(tr.pricePerUnit) }))}</small></span>
            <span class="btn-row"><button class="btn btn-signal btn-sm" type="button" data-act="dprop" data-ok="1" data-trip="${tr.id}" data-id="${b.id}">${esc(t('vv.dAccept'))}</button><button class="btn btn-ghost btn-sm" type="button" data-act="dprop" data-ok="0" data-trip="${tr.id}" data-id="${b.id}">${esc(t('vv.dRefuse'))}</button></span></li>`).join('')}</ul>` : ''}
          <h3 class="app-h">${esc(t('vv.dBookings'))}</h3>
          ${paid.length ? `<ul class="ledger-list">${paid.map(b => `<li><span><b>${esc(b.client)}${b.channel === 'whatsapp' ? ' · WhatsApp' + (b.depositPaid ? '' : ' · ' + esc(t('vv.depDue', { p: fmt(b.deposit) }))) : ''}</b><small>${esc(store.stopOf(b.stop).name)} · ${hm(store.stopTime(tr, b.stop))} · ${b.units} × ${esc(t('vv.' + b.unitKind))} · ${b.seats} pers. · ${esc(t('vv.dCheck', { c: (b.phone || '').slice(-4) }))}</small></span><span class="mono">${fmt(b.total)}</span></li>`).join('')}</ul>` : `<p class="empty">${esc(t('vv.dNoBook'))}</p>`}
          ${tr.status !== 'done' ? `<button class="btn btn-signal btn-block" type="button" data-act="dtrip-next" data-id="${tr.id}">${esc(t('vv.dNext.' + tr.status))}</button>` : ''}
        </article>`;
      }).join('')}` : ''}
    </section>`;
  }

  function admTrips() {
    const trips = store.tripsState();
    const upcoming = trips.filter(tr => tr.status === 'scheduled');
    const fills = trips.map(tr => store.tripLoad(tr).units / tr.capacity);
    const arrivals = store.state.events.filter(e => e.type === 'trip_arrived');
    return `<div class="adm-tiles">
        ${tile(t('vt.trips'), fmt(upcoming.length))}
        ${tile(t('vt.fill'), trips.length ? pctStr(fills.reduce((a, x) => a + x, 0) / trips.length) : '—', '', 'accent')}
        ${tile(t('vt.units'), fmt(trips.reduce((a, tr) => a + store.tripLoad(tr).units, 0)))}
        ${tile(t('vt.onTime'), arrivals.length ? pctStr(arrivals.filter(e => e.onTime).length / arrivals.length) : '—', '', 'ok')}
      </div>
      ${trips.length ? `<div class="table-scroll"><table class="grid-table compact adm-table">
        <thead><tr><th>${esc(t('vt.col.depart'))}</th><th>${esc(t('vt.col.arrive'))}</th><th>${esc(t('ad.col.driver'))}</th><th>${esc(t('a.colVehicle'))}</th><th>${esc(t('vt.col.cap'))}</th><th>${esc(t('vt.col.price'))}</th><th>${esc(t('vt.col.amount'))}</th><th>${esc(t('a.colStatus'))}</th></tr></thead>
        <tbody>${trips.slice().sort((a, b) => a.depart - b.depart).map(tr => { const l = store.tripLoad(tr); const amt = tr.bookings.filter(b => b.status !== 'cancelled' && !b.other).reduce((a, b) => a + b.total, 0);
          return `<tr><td>${dayLabel(tr.depart)} ${hm(tr.depart)}</td><td>${hm(store.arrivalTime(tr))}</td><td>${esc(tr.driverName)}</td><td>${esc(t('veh.' + tr.vehicle))}</td>
            <td class="mono">${l.units} / ${tr.capacity} (${pctStr(l.units / tr.capacity)})</td><td class="mono">${fmt(tr.pricePerUnit)}</td><td class="mono">${fmt(amt)}</td>
            <td><span class="pill pill-${tr.status === 'scheduled' ? 'open' : 'delivered'}">${esc(t('vv.tl.' + (tr.status === 'scheduled' ? 'booked' : tr.status)))}</span></td></tr>`; }).join('')}</tbody>
      </table></div>` : `<p class="empty">${esc(t('ad.none'))}</p>`}
      ${agentForm()}
      <p class="hint">${esc(t('vv.example'))}</p>`;
  }

  // Réservation saisie par un agent (WhatsApp / téléphone), puis confirmation envoyée sur WhatsApp.
  function agentForm() {
    const trips = store.tripsState().filter(tr => tr.status === 'scheduled').sort((a, b) => a.depart - b.depart);
    const g = view.agent || (view.agent = { trip: trips[0] && trips[0].id, stop: 'yamoussoukro', kind: 'sac', units: 6, seats: 1, paid: 'no', name: '', phone: '' });
    const done = view.agentDone;
    return `<form class="adm-card" id="agentForm" novalidate>
      <h2 class="app-h">${esc(t('ag.title'))}</h2><p class="hint">${esc(t('ag.sub'))}</p>
      ${done ? `<div class="notice notice-ok">${esc(t('ag.done', { n: done.name }))} <a class="btn btn-wa btn-sm" href="${waLink(done.phone, done.msg)}" target="_blank" rel="noopener">${esc(t('ag.confirm'))}</a></div>` : ''}
      <label class="field"><span>${esc(t('ag.trip'))}</span><select id="ag-trip">${trips.map(tr => { const l = store.tripLoad(tr); return `<option value="${tr.id}"${tr.id === g.trip ? ' selected' : ''}>${dayLabel(tr.depart)} ${hm(tr.depart)} · ${esc(tr.driverName)} · ${tr.capacity - l.units} ${esc(t('vv.sac').toLowerCase())} · ${fmt(tr.pricePerUnit)} FCFA</option>`; }).join('')}</select></label>
      <div class="row-2">
        <label class="field"><span>${esc(t('ag.name'))}</span><input id="ag-name" value="${esc(g.name)}"></label>
        <label class="field"><span>${esc(t('ag.phone'))}</span><span class="phone-in"><b class="mono">+225</b><input id="ag-phone" type="tel" inputmode="numeric" maxlength="14" value="${esc(g.phone)}"></span></label>
        <label class="field"><span>${esc(t('vv.stop'))}</span><select id="ag-stop">${STOPS().filter(x => x.id !== 'gesco').map(x => `<option value="${x.id}"${x.id === g.stop ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label class="field"><span>${esc(t('vv.load'))}</span><select id="ag-kind">${['sac', 'carton', 'cageot'].map(k => `<option value="${k}"${k === g.kind ? ' selected' : ''}>${esc(t('vv.' + k))}</option>`).join('')}</select></label>
        <label class="field"><span>${esc(t('vv.qty'))}</span><input id="ag-units" type="number" min="1" value="${g.units}"></label>
        <label class="field"><span>${esc(t('w.passengers'))}</span><select id="ag-seats">${[0, 1, 2].map(n => `<option${n === g.seats ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>${esc(t('ag.paid'))}</span><select id="ag-paid"><option value="no"${g.paid === 'no' ? ' selected' : ''}>${esc(t('ag.paidNo'))}</option><option value="orange"${g.paid === 'orange' ? ' selected' : ''}>${esc(t('ag.paidYes'))} · Orange Money</option><option value="wave"${g.paid === 'wave' ? ' selected' : ''}>${esc(t('ag.paidYes'))} · Wave</option><option value="mtn"${g.paid === 'mtn' ? ' selected' : ''}>${esc(t('ag.paidYes'))} · MTN MoMo</option></select></label>
      </div>
      <p class="field-error" id="ag-err" hidden>${esc(t('ag.err'))}</p>
      <button class="btn btn-signal" type="submit">${esc(t('ag.save'))}</button>
    </form>`;
  }

  // ---------- APPELS MASQUÉS ----------
  TK.addStrings({
    fr: {
      'cv.call': 'Appeler', 'cv.callDriver': 'Appeler le chauffeur', 'cv.callClient': 'Appeler le client',
      'cv.masked': 'Appel masqué : votre numéro n’est pas communiqué.',
      'cv.relay': 'Numéro relais Takaata', 'cv.calling': 'Appel de {n} via le numéro relais…', 'cv.hangup': 'Raccrocher',
      'cv.demo': 'Prototype : aucun appel n’est passé. Au lancement, l’appel passera par un numéro relais fourni par l’opérateur.',
      'cv.ended': 'La course est terminée : l’appel direct n’est plus possible.', 'cv.support': 'Contacter le service client',
      'cv.clientCodeT': 'Code de prise en charge', 'cv.clientCodeS': 'Les 4 derniers chiffres de votre numéro. Le chauffeur vous les demandera à son arrivée.',
      'cv.verifyT': 'Vérifiez le client', 'cv.verifyS': 'Demandez au client de confirmer les 4 derniers chiffres de son numéro avant de charger.',
      'd.next.pickup': 'Client confirmé · commencer le chargement'
    },
    en: {
      'cv.call': 'Call', 'cv.callDriver': 'Call the driver', 'cv.callClient': 'Call the customer',
      'cv.masked': 'Masked call: your number is not shared.',
      'cv.relay': 'Takaata relay number', 'cv.calling': 'Calling {n} through the relay number…', 'cv.hangup': 'Hang up',
      'cv.demo': 'Prototype: no call is placed. At launch, calls go through a relay number provided by the operator.',
      'cv.ended': 'The trip is over: direct calls are no longer possible.', 'cv.support': 'Contact customer service',
      'cv.clientCodeT': 'Pickup code', 'cv.clientCodeS': 'The last 4 digits of your number. The driver will ask for them on arrival.',
      'cv.verifyT': 'Check the customer', 'cv.verifyS': 'Ask the customer to confirm the last 4 digits of their number before loading.',
      'd.next.pickup': 'Customer confirmed · start loading'
    }
  });

  // Bouton d'appel : actif seulement pendant la course, toujours via le numéro relais.
  function callBlock(o, side) {
    if (!store.canCall(o)) return '';
    return `<div class="call-row">
      <button type="button" class="btn btn-light call-btn" data-act="call" data-id="${o.id}" data-side="${side}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>
        ${esc(t(side === 'client' ? 'cv.callDriver' : 'cv.callClient'))}</button>
      <small>${esc(t('cv.masked'))}</small>
    </div>`;
  }

  function afterCall() {
    return `<div class="call-ended"><small>${esc(t('cv.ended'))}</small>
      <button type="button" class="link-btn" data-act="me-sub" data-sub="support">${esc(t('cv.support'))} ›</button></div>`;
  }

  function callOverlay() {
    const c = view.call;
    const o = c && store.getOrder(c.orderId);
    if (!o || !store.canCall(o)) { view.call = null; return ''; }
    const who = c.side === 'client' ? (o.driver.me ? t('o.you') : o.driver.name) : (o.owner === 'me' ? t('role.client') : o.client || t('role.client'));
    return `<div class="call-sheet" role="dialog" aria-modal="true" aria-label="${esc(t('cv.call'))}">
      <div class="call-card">
        <span class="avatar avatar-lg call-avatar" aria-hidden="true">${initials(who)}</span>
        <b>${esc(who)}</b>
        <p class="pulse">${esc(t('cv.calling', { n: who }))}</p>
        <p class="call-relay"><small>${esc(t('cv.relay'))}</small><span class="mono">+225 ${esc(o.relay)}</span></p>
        <p class="hint">${esc(t('cv.masked'))}</p>
        <button type="button" class="btn btn-danger btn-block" data-act="hangup">${esc(t('cv.hangup'))}</button>
        <p class="hint">${esc(t('cv.demo'))}</p>
      </div></div>`;
  }

  // ---------- rendu ----------
  function currentRole() { return ROUTES[location.hash.slice(1)] || null; }

  let lastHtml = '';
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
    else if (role === 'client') body = view.name === 'wizard' ? wizard() : view.name === 'order' ? orderView() : view.name === 'orders' ? ordersView() : view.name === 'me' ? meView() : view.name === 'booking' ? bookingView() : clientHome();
    else if (role === 'driver') body = store.driver() ? driverApp() : driverAuthView();
    else body = adminView();

    const withNav = (role === 'client' && signedIn) || (role === 'driver' && !!store.driver());
    const nav = !withNav ? '' : role === 'driver' ? driverNav() : bottomNav();
    const call = (view.call && role !== 'admin' ? callOverlay() : '') + (role === 'driver' && store.driver() ? notifBanner() : '');
    const html = `${header(role)}<main class="app-main${withNav ? ' has-nav' : ''}${role === 'admin' ? ' is-admin' : ''}">${body}<p class="app-demo">${esc(t('app.demo'))}</p></main>${nav}${call}`;
    // Ne remplace l'écran que s'il a changé : évite de perdre un appui pendant un rafraîchissement.
    if (html === lastHtml && root.innerHTML) return;
    lastHtml = html;
    root.innerHTML = html;

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
  root.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-act]')) { e.preventDefault(); e.target.click(); }
  });
  // Échap ferme la fiche Admin, même quand le focus est sorti de l'app.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && currentRole() === 'admin' && (view.adm.order || view.adm.driver || view.adm.client)) { Object.assign(view.adm, { order: null, driver: null, client: null }); render(); }
  });

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
      case 'vv-count': { const v = vivState(), f = b.dataset.f; v[f] = Math.max(f === 'units' ? 1 : 0, Math.min(f === 'units' ? 200 : 2, v[f] + +b.dataset.d)); render(); break; }
      case 'vv-pick': vivState().confirm = id; vivState().propFor = null; view.vivErr = ''; if (view.name !== 'home') go('home'); else dgo(); break;
      case 'vv-prop-open': vivState().propFor = vivState().propFor === id ? null : id; render(); break;
      case 'vv-paydep': store.payDeposit(b.dataset.trip, id, vivState().pay); ui.toast(t('vv.booked')); break;
      case 'dprop': store.answerProposal(b.dataset.trip, id, b.dataset.ok === '1'); break;
      case 'sf-sos': view.sosAsk = true; render(); break;
      case 'sf-sos-no': view.sosAsk = false; render(); break;
      case 'sf-sos-yes': view.sosAsk = false; store.sosAlert(b.dataset.trip, id); ui.toast(t('sf.sent')); break;
      case 'vv-back': vivState().confirm = null; dgo(); break;
      case 'vv-book': {
        const v = vivState();
        const res = store.bookTrip(id, { stop: v.stop, unitKind: v.kind, units: v.units, seats: v.seats, lastMile: v.lastMile, payment: v.pay });
        if (!res.ok) { view.vivErr = t('vv.full'); render(); break; }
        v.confirm = null;
        ui.toast(t('vv.booked'));
        go('booking', { bookingId: res.booking.id });
        break;
      }
      case 'vv-open': go('booking', { bookingId: id }); break;
      case 'vv-cancel': store.cancelBooking(b.dataset.trip, id); break;
      case 'vv-advance': case 'dtrip-next': store.advanceTrip(id); break;
      case 'dtrip-open': view.dtripForm = {}; render(); break;
      case 'dtrip-close': view.dtripForm = null; render(); break;
      case 'adm-mod': Object.assign(view.adm, { mod: b.dataset.mod, order: null, driver: null, client: null }); dgo(); break;
      case 'adm-filter': view.adm.filter = b.dataset.f; render(); break;
      case 'an-period': view.adm.period = +b.dataset.n; view.aiSummary = ''; render(); break;
      case 'ai-prepare': { const since = view.adm.period ? Date.now() - view.adm.period * 864e5 : 0; view.aiSummary = aiSummary(store.state.events.filter(e => e.at >= since), view.adm.period); render(); break; }
      case 'ai-copy': {
        const ta = document.getElementById('ai-summary');
        try { navigator.clipboard.writeText(view.aiSummary).then(() => ui.toast(t('ai.copied')), () => { ta.select(); }); } catch (err) { ta.select(); }
        break;
      }
      case 'adm-logout': setAdmSession(null); view.adm.mod = 'dash'; dgo(); break;
      case 'tm-regen': view.teamForm.pass = genPass(); view.teamForm.name = (document.getElementById('tm-name') || {}).value || view.teamForm.name; render(); break;
      case 'tm-del': view.teamDelete = id; render(); break;
      case 'tm-del-no': view.teamDelete = null; render(); break;
      case 'tm-del-yes': view.teamDelete = null; view.teamCreated = null; store.removeStaff(id); break;
      case 'an-seed': store.seedAnalytics(); break;
      case 'an-clear': store.clearDemoAnalytics(); break;
      case 'an-export': exportEvents(); break;
      case 'adm-dtab': view.adm.dtab = b.dataset.t; render(); break;
      case 'adm-order': Object.assign(view.adm, { order: id, driver: null, client: null }); render(); break;
      case 'adm-driver': Object.assign(view.adm, { driver: b.dataset.phone, order: null, client: null }); render(); break;
      case 'adm-client': Object.assign(view.adm, { client: b.dataset.phone, order: null, driver: null }); render(); break;
      case 'adm-close': Object.assign(view.adm, { order: null, driver: null, client: null }); render(); break;
      case 'adm-approve': store.reviewDriver(b.dataset.phone, true); break;
      case 'adm-reject': store.reviewDriver(b.dataset.phone, false, t(document.getElementById('adm-reason').value)); break;
      case 'adm-suspend': { const d = store.driverAccount(b.dataset.phone); store.suspendDriver(d.phone, !d.suspended); break; }
      case 'adm-cancel': store.adminCancel(id); break;
      case 'adm-resolve': store.resolveReport(+b.dataset.at); break;
      case 'adm-defaults': store.resetPricing(); ui.toast(t('ad.saved')); break;
      case 'call': view.call = { orderId: id, side: b.dataset.side }; render(); break;
      case 'hangup': view.call = null; render(); break;
      case 'dtab': view.dtab = b.dataset.tab; view.dmeSub = ''; view.confirmLogout = false; view.supportSent = false; dgo(); break;
      case 'dme-sub': view.dmeSub = b.dataset.sub; view.confirmLogout = false; view.supportSent = false; dgo(); break;
      case 'd-online': store.setOnline(!store.driver().online); break;
      case 'nt-close': view.dnotif = null; render(); break;
      case 'nt-view': view.dnotif = null; view.dtab = 'jobs'; dgo(); break;
      case 'nt-recharge': view.dnotif = null; view.dtab = 'gains'; dgo(); break;
      case 'nt-accept': {
        const o = store.getOrder(id);
        view.dnotif = null;
        const res = o ? store.driverOffer(id, o.price) : { ok: false };
        view.dtab = 'jobs';
        if (res.ok) ui.toast(t('nt.sent')); else if (res.missing) ui.toast(t('d.need', { m: fcfa(res.missing) }));
        dgo();
        break;
      }
      case 'nt-enable':
        try { Notification.requestPermission().then(() => render()); } catch (err) { /* non disponible */ }
        break;
      case 'd-goal-edit': view.goalEdit = !view.goalEdit; render(); break;
      case 'd-goal': view.goalEdit = false; store.setDriver({ goal: +b.dataset.n }); break;
      case 'd-decline-open': view.declineFor = view.declineFor === id ? null : id; render(); break;
      case 'd-decline': view.declineFor = null; store.driverDecline(id, b.dataset.r); break;
      case 'd-logout': store.driverLogout(); view.confirmLogout = false; view.dtab = 'jobs'; view.dauth = { mode: 'login', step: 'id', f: newDriverForm(), err: '' }; dgo(); break;
      case 'da-mode': view.dauth = { mode: b.dataset.mode, step: 'id', f: newDriverForm(view.dauth.f.phone), err: '' }; dgo(); break;
      case 'da-prev': {
        const a = view.dauth, i = SIGNUP_STEPS.indexOf(a.step);
        a.err = '';
        a.step = i > 0 ? SIGNUP_STEPS[i - 1] : 'id';
        dgo();
        break;
      }
      case 'da-resend': sendDriverOtp(); render(); break;
      case 'da-edit': view.dauth.step = 'id'; view.dauth.err = ''; dgo(); break;
      case 'a-review': store.reviewDriver(b.dataset.phone, b.dataset.ok === '1', b.dataset.ok === '1' ? '' : t('a.rejectWhy')); break;
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
        const keepKeys = ['need', 'from', 'to', 'fromDetail', 'toDetail', 'vehicle', 'service', 'notes', 'itemsQty', 'weightManual', 'floorsFrom', 'floorsTo', 'elevator', 'helpers', 'passengers', 'payment'];
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

  function dBind(el) {
    const f = view.dauth && view.dauth.f;
    if (!f) return false;
    if (el.dataset.dcat) {
      const c = el.dataset.dcat;
      f.licenseCats = el.checked ? f.licenseCats.concat(c) : f.licenseCats.filter(x => x !== c);
      return true;
    }
    if (el.dataset.ddoc) { f.docs[el.dataset.ddoc] = el.files ? el.files.length : 0; return true; }
    if (!el.dataset.dbind) return false;
    f[el.dataset.dbind] = el.type === 'checkbox' ? el.checked : el.value;
    return true;
  }

  root.addEventListener('input', e => {
    if (e.target.id === 'adm-q') { view.adm.q = e.target.value; render(); return; }
    if (e.target.dataset.dbind && e.target.matches('input:not([type=checkbox]):not([type=radio]), textarea')) { dBind(e.target); return; }
    if (e.target.matches('input[type=text], input:not([type]), textarea, input[type=number], input[type=datetime-local]')) bindValue(e.target);
  });

  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.dbind || el.dataset.dcat || el.dataset.ddoc) {
      dBind(el);
      // Les champs texte gardent la saisie ; le reste (date, choix, photos) met l'écran à jour.
      if (!el.matches('input[type=text], input[type=tel], input[type=number], input:not([type])')) render();
      return;
    }
    if (el.id === 'vv-stop') { vivState().stop = el.value; render(); return; }
    if (el.id === 'vv-lastMile') { vivState().lastMile = el.checked; return; }
    if (el.dataset.viv) { vivState()[el.dataset.viv] = el.value; render(); return; }
    if (el.id === 'adm-reason') { view.adm.reason = el.value; return; }
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
    if (f.id === 'admGateForm') { submitAdmGate(); return; }
    if (f.classList.contains('prop-form')) {
      const v = vivState(), tripId = f.dataset.id;
      const unitPrice = Math.round(+document.getElementById('vp-' + tripId).value || 0);
      if (unitPrice < 100) return;
      const res = store.bookTrip(tripId, { stop: v.stop, unitKind: v.kind, units: v.units, seats: v.seats, lastMile: v.lastMile, payment: v.pay, unitPrice });
      if (!res.ok) { ui.toast(t('vv.full')); return; }
      v.propFor = null;
      go('booking', { bookingId: res.booking.id });
      return;
    }
    if (f.id === 'agentForm') {
      const g = view.agent, val = id => document.getElementById(id).value;
      Object.assign(g, { trip: val('ag-trip'), name: val('ag-name').trim(), phone: val('ag-phone').replace(/\D/g, '').replace(/^225(?=\d{10}$)/, ''), stop: val('ag-stop'), kind: val('ag-kind'), units: Math.max(1, +val('ag-units') || 1), seats: +val('ag-seats'), paid: val('ag-paid') });
      const trip = store.tripsState().find(x => x.id === g.trip);
      const ok = trip && g.name && PHONE_RE.test(g.phone) && (trip.from === g.stop || trip.stops.includes(g.stop));
      const res = ok ? store.bookTrip(g.trip, { stop: g.stop, unitKind: g.kind, units: g.units, seats: g.seats, client: g.name, phone: g.phone, channel: 'whatsapp',
        payment: g.paid === 'no' ? 'cash' : g.paid, status: 'booked', depositPaid: g.paid !== 'no' }) : { ok: false };
      if (!res.ok) { document.getElementById('ag-err').hidden = false; return; }
      const bk = res.booking;
      view.agentDone = { name: g.name, phone: g.phone, msg: t('ag.confirmMsg', { d: trip.driverName, pl: trip.plate, s: store.stopOf(g.stop).name, h: hm(store.stopTime(trip, g.stop)), a: hm(store.arrivalTime(trip)), u: g.units, k: t('vv.' + g.kind).toLowerCase(), p: g.seats, t: fcfa(bk.total), c: g.phone.slice(-4) }) };
      Object.assign(g, { name: '', phone: '' });
      render();
      return;
    }
    if (f.id === 'dTripForm') {
      const err = document.getElementById('tf-err');
      const depart = new Date(document.getElementById('tf-depart').value).getTime();
      const capacity = +document.getElementById('tf-cap').value, price = +document.getElementById('tf-price').value;
      if (!depart || depart < Date.now()) { err.textContent = t('vv.dBadTime'); err.hidden = false; return; }
      if (!(capacity > 0) || !(price > 0)) { err.textContent = t('vv.dBadCap'); err.hidden = false; return; }
      const stops = Array.from(f.querySelectorAll('input[data-tstop]:checked')).map(x => x.dataset.tstop).sort((a, b) => store.stopOf(a).km - store.stopOf(b).km);
      store.publishTrip({ depart, stops, capacity, seats: +document.getElementById('tf-seats').value, pricePerUnit: price, pricePerSeat: +document.getElementById('tf-seatPrice').value || 0 });
      view.dtripForm = null;
      ui.toast(t('vv.dPublished'));
      render();
      return;
    }
    if (f.id === 'teamForm') {
      const tf = view.teamForm, err = document.getElementById('tm-err');
      tf.name = document.getElementById('tm-name').value.trim();
      tf.dur = +(f.querySelector('input[name=tm-dur]:checked') || {}).value || 0;
      tf.perms = Array.from(f.querySelectorAll('input[data-perm]:checked')).map(x => x.dataset.perm);
      if (!tf.name) { err.textContent = t('tm.needName'); err.hidden = false; return; }
      if (!tf.perms.length) { err.textContent = t('tm.needPerm'); err.hidden = false; return; }
      store.addStaff({ name: tf.name, hash: await admHash(tf.pass), perms: tf.perms, expiresAt: tf.dur ? Date.now() + tf.dur : null });
      view.teamCreated = { n: tf.name, p: tf.pass };
      view.teamForm = null;
      render();
      return;
    }
    if (f.id === 'ownerPassForm') {
      const p1 = document.getElementById('op-pass').value, p2 = document.getElementById('op-pass2').value, err = document.getElementById('op-err');
      if (p1.length < 8) { err.textContent = t('ax.short'); err.hidden = false; return; }
      if (p1 !== p2) { err.textContent = t('ax.mismatch'); err.hidden = false; return; }
      store.setOwnerHash(await admHash(p1));
      ui.toast(t('tm.saved'));
      render();
      return;
    }
    if (f.id === 'pricingForm') {
      const num = id => Math.max(0, Math.round(+document.getElementById(id).value || 0));
      store.setPricing({
        vehicles: Object.fromEntries(VEHICLES.map(v => [v.id, { base: num(`pr-${v.id}-base`), perKm: num(`pr-${v.id}-perKm`), floor: num(`pr-${v.id}-floor`) }])),
        helper: num('pr-helper'), floorFee: num('pr-floor')
      });
      const wa = document.getElementById('pr-wa').value.replace(/\D/g, '').replace(/^225(?=\d{10}$)/, '');
      if (!wa || PHONE_RE.test(wa)) store.setSetting('whatsapp', wa);
      ui.toast(t('ad.saved'));
      TKSite.refresh();
      return;
    }
    if (f.id === 'dAuthForm') { submitDriverAuth(); return; }
    if (f.id === 'dSupportForm') {
      const text = document.getElementById('dSupportText').value.trim();
      if (!text) return;
      store.report(null, `[${t('role.driver')} ${fmtPhone(store.driver().phone)}] ${text}`);
      view.supportSent = true;
      render();
      return;
    }
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
  let lastTrips = null;
  store.subscribe(() => {
    const d = store.driver();
    if (d) {
      if (lastTrips != null && d.trips > lastTrips && d.earnings[0]) {
        const e = d.earnings, goal = d.goal || 15000;
        const todayNet = e.filter(x => x.at >= today0()).reduce((a, x) => a + x.net, 0);
        view.celebrate = { net: e[0].net, msg: todayNet >= goal ? t('dh.goalDone') : t('dh.left', { n: fcfa(goal - todayNet) }) };
        clearTimeout(view.celebrateTimer);
        view.celebrateTimer = setTimeout(() => { view.celebrate = null; render(); }, 6000);
      }
      lastTrips = d.trips;
      balanceCheck(d);
    } else lastTrips = null;
    if (currentRole() && view.name !== 'wizard') render();
  });

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
      if (ev.type === 'approved' && currentRole() === 'driver') ui.toast(t('da.approved'));
      if (ev.type === 'request') requestNotif(ev.order);
      if (ev.type === 'proposal' && currentRole() === 'client' && ev.booking.phone === store.state.session) ui.toast(t(ev.booking.status === 'accepted' ? 'vv.propAccepted' : 'vv.propRefused'));
    });
    // Comptes à rebours : clôture automatique, renvoi du code SMS ; carte en direct.
    const role = currentRole();
    if (role === 'admin' && view.adm.mod === 'live' && admSession() && Date.now() % 2000 < 1000) render();
    const o = view.name === 'order' && store.getOrder(view.orderId);
    if (role === 'client' && !store.user() && view.auth.step === 'otp') render();
    else if (role === 'driver' && !store.driver() && view.dauth.step === 'otp') render();
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type !== 'tk-notif') return;
      if (location.hash !== '#chauffeur') location.hash = 'chauffeur';
      view.dtab = m.action === 'open' && !m.orderId ? 'gains' : 'jobs';
      const o = m.orderId && store.getOrder(m.orderId);
      if (m.action === 'accept' && o) { const res = store.driverOffer(o.id, o.price); if (res.ok) ui.toast(t('nt.sent')); }
      dgo();
    });
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ }
  }
})();
