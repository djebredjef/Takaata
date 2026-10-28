// Application Takaata (PWA) : espaces Client, Chauffeur et Admin + routage.
(function () {
  const { t, VEHICLES, NEEDS, PAYMENTS, STATUSES, store, ui, quote, distanceKm, commission, commune, vehicle } = TK;
  const { fcfa, esc, fmt } = ui;

  const ROUTES = { app: 'client', chauffeur: 'driver', admin: 'admin' };
  const NEED_VEHICLE = { moving: 'truck3t', furniture: 'van1t', food: 'truck3t', shop: 'van1t', parcel: 'tricycle' };
  const PROGRESS = { open: null, assigned: 0, pickup: 0, loading: 0.04, transit: 0.55, arrived: 1, delivered: 1, cancelled: null };
  const ACTIVE = ['open', 'assigned', 'pickup', 'loading', 'transit', 'arrived'];

  const view = { name: 'home', step: 1, draft: null, orderId: null, confirmCancel: false, reportOpen: false, reported: false, counterFor: null, confirmReset: false, offerMsg: {} };
  const root = document.getElementById('app');

  // ---------- helpers ----------
  const route = o => `${esc(commune(o.from).name)} → ${esc(commune(o.to).name)}`;
  const pill = s => `<span class="pill pill-${s}">${esc(t('status.' + s))}</span>`;
  const stars = n => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));
  const time = ts => new Date(ts).toLocaleTimeString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = ts => new Date(ts).toLocaleDateString(TK.getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });

  function newDraft(patch) {
    return Object.assign({
      need: 'moving', from: 'yopougon', to: 'cocody', fromDetail: '', toDetail: '', when: 'now', whenAt: '',
      vehicle: 'truck3t', service: 'transport', items: '', weight: '', floorsFrom: 0, floorsTo: 0,
      elevator: false, helpers: 1, packing: false, dismantle: false, price: null, payment: 'cash'
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
  function clientHome() {
    const mine = store.state.orders.filter(o => o.owner === 'me');
    const active = mine.filter(o => ACTIVE.includes(o.status));
    const past = mine.filter(o => !ACTIVE.includes(o.status));
    return `
      ${active.length ? `<section class="app-sec"><h2 class="app-h">${esc(t('c.active'))}</h2>
        <div class="stack">${active.map(orderRow).join('')}</div></section>` : ''}
      <section class="app-sec">
        <h1 class="app-title">${esc(t('c.hello'))}</h1>
        <div class="need-grid">
          ${NEEDS.map(n => `<button class="need-btn" type="button" data-act="start" data-need="${n}">
            <span class="need-ic need-${n}" aria-hidden="true"></span>
            <b>${esc(t('need.' + n))}</b><small>${esc(t('needd.' + n))}</small></button>`).join('')}
        </div>
      </section>
      <section class="app-sec">
        <h2 class="app-h">${esc(t('c.history'))}</h2>
        ${past.length ? `<div class="stack">${past.map(orderRow).join('')}</div>` : `<p class="empty">${esc(t('c.noHistory'))}</p>`}
      </section>`;
  }

  function orderRow(o) {
    return `<button class="order-row" type="button" data-act="open-order" data-id="${o.id}">
      <span class="order-row-main"><b>${route(o)}</b><small>${esc(t('need.' + o.need))} · ${esc(t('veh.' + o.vehicle))} · ${date(o.createdAt)}</small></span>
      <span class="order-row-side"><span class="mono">${fcfa(o.price)}</span>${pill(o.status)}</span>
    </button>`;
  }

  function wizard() {
    const d = view.draft, step = view.step;
    const q = draftQuote(d);
    const kmVal = distanceKm(d.from, d.to);
    const titles = ['w.s1', 'w.s2', 'w.s3', 'w.s4'];
    let body = '';

    if (step === 1) {
      body = `
        <fieldset class="chips"><legend class="sr-only">Besoin</legend>
          ${NEEDS.map(n => `<label class="chip-radio"><input type="radio" name="need" id="w-need-${n}" value="${n}" data-bind="need"${d.need === n ? ' checked' : ''}><span>${esc(t('need.' + n))}</span></label>`).join('')}
        </fieldset>
        <div class="route-fields">
          <label class="field"><span>${esc(t('quote.from'))}</span><select id="w-from" data-bind="from">${ui.communeOptions(d.from)}</select></label>
          <label class="field"><span>${esc(t('w.fromDetail'))}</span><input id="w-fromDetail" data-bind="fromDetail" value="${esc(d.fromDetail)}" placeholder="${esc(t('w.detailPh'))}"></label>
          <label class="field"><span>${esc(t('quote.to'))}</span><select id="w-to" data-bind="to">${ui.communeOptions(d.to)}</select></label>
          <label class="field"><span>${esc(t('w.toDetail'))}</span><input id="w-toDetail" data-bind="toDetail" value="${esc(d.toDetail)}" placeholder="${esc(t('w.detailPh'))}"></label>
        </div>
        <div class="map-card">${ui.routeMap(d.from, d.to, null)}<p class="mono">${ui.km(kmVal)}</p></div>
        ${d.from === d.to ? `<p class="hint">${esc(t('w.sameCommune', { km: kmVal }))}</p>` : ''}
        <fieldset class="chips"><legend>${esc(t('w.when'))}</legend>
          <label class="chip-radio"><input type="radio" name="when" id="w-when-now" value="now" data-bind="when"${d.when === 'now' ? ' checked' : ''}><span>${esc(t('w.now'))}</span></label>
          <label class="chip-radio"><input type="radio" name="when" id="w-when-later" value="later" data-bind="when"${d.when === 'later' ? ' checked' : ''}><span>${esc(t('w.later'))}</span></label>
        </fieldset>
        ${d.when === 'later' ? `<label class="field"><span class="sr-only">${esc(t('w.later'))}</span><input type="datetime-local" id="w-whenAt" data-bind="whenAt" value="${esc(d.whenAt)}"></label>` : ''}`;
    }

    if (step === 2) {
      // Présentation façon « choix du véhicule » : onglets, caisse chargée, formules de service.
      const V = TK.vehicles;
      const prices = {
        handling: quote(d.vehicle, kmVal, { service: 'handling', helpers: 1 }).reference,
        transport: quote(d.vehicle, kmVal, { service: 'transport' }).reference
      };
      const svc = kind => `
        <label class="svc-card${d.service === kind ? ' is-on' : ''}">
          <input type="radio" name="service" id="w-svc-${kind}" value="${kind}" data-bind="service"${d.service === kind ? ' checked' : ''}>
          <span class="svc-check" aria-hidden="true"></span>
          <span class="svc-txt"><b>${esc(t('svc.' + kind))}</b><small>${esc(t('svc.' + kind + 'D'))}</small></span>
          <span class="svc-price"><b class="mono">${fmt(prices[kind])}</b><small>FCFA · ${esc(t('svc.from'))}</small></span>
        </label>`;
      body = `
        ${V.tabs(d.vehicle, 'data-veh-tab')}
        ${V.stage(d.vehicle, 'data-veh-step')}
        <div class="veh-sum">
          <p>${esc(t('sum.' + d.vehicle))}</p>
          <button type="button" class="link-btn veh-how" data-veh-open="${d.vehicle}">${esc(t('vs.how'))} ›</button>
        </div>
        <fieldset class="svc-list"><legend class="sr-only">${esc(t('w.service'))}</legend>${svc('handling')}${svc('transport')}</fieldset>
        <p class="hint">${esc(t('quote.distance'))} : <span class="mono">${ui.km(kmVal)}</span> · ${esc(t('vs.tap'))}</p>`;
    }

    if (step === 3) {
      const handling = d.service === 'handling';
      body = `
        <p class="notice">${esc(t('veh.' + d.vehicle))} · ${esc(t(handling ? 'svc.handling' : 'svc.transport'))}</p>
        <label class="field"><span>${esc(t('w.items'))}</span><textarea id="w-items" rows="3" data-bind="items" placeholder="${esc(t('w.itemsPh'))}">${esc(d.items)}</textarea></label>
        <p class="field-error" id="w-items-err" hidden>${esc(t('w.itemsRequired'))}</p>
        <label class="field"><span>${esc(t('w.weight'))}</span><input id="w-weight" data-bind="weight" value="${esc(d.weight)}" placeholder="ex. 150 kg"></label>
        ${handling ? `
        <div class="row-3">
          ${counter('helpers', t('w.helpers'), d.helpers, 1, 6)}
          ${counter('floorsFrom', t('w.floorsFrom'), d.floorsFrom, 0, 20)}
          ${counter('floorsTo', t('w.floorsTo'), d.floorsTo, 0, 20)}
        </div>
        <label class="check"><input type="checkbox" id="w-elevator" data-bind="elevator"${d.elevator ? ' checked' : ''}><span>${esc(t('w.elevator'))}</span></label>
        <p class="hint">${esc(t('w.perHelper', { p: fcfa(TK.OPTIONS.helper) }))} · ${esc(t('w.perFloor', { p: fcfa(TK.OPTIONS.floor) }))}</p>` : ''}
        <label class="check"><input type="checkbox" id="w-packing" data-bind="packing"${d.packing ? ' checked' : ''}><span>${esc(t('w.packing'))} <small class="mono">+${fmt(TK.OPTIONS.packing)}</small></span></label>
        <label class="check"><input type="checkbox" id="w-dismantle" data-bind="dismantle"${d.dismantle ? ' checked' : ''}><span>${esc(t('w.dismantle'))} <small class="mono">+${fmt(TK.OPTIONS.dismantle)}</small></span></label>`;
    }

    if (step === 4) {
      if (d.price == null || d.price < q.minimum) d.price = q.reference;
      body = `
        <div class="waybill waybill-app">
          <div class="waybill-head"><span>${route(d)}</span><span class="mono">${ui.km(kmVal)}</span></div>
          <dl class="waybill-lines">
            <div><dt>${esc(t('w.transport'))} · ${esc(t('veh.' + d.vehicle))}</dt><dd class="mono">${fcfa(q.transport)}</dd></div>
            <div><dt>${esc(t('w.options'))}</dt><dd class="mono">${fcfa(q.options)}</dd></div>
            <div class="total"><dt>${esc(t('w.reference'))}</dt><dd class="mono">${fcfa(q.reference)}</dd></div>
            <div><dt>${esc(t('w.minimum'))}</dt><dd class="mono">${fcfa(q.minimum)}</dd></div>
          </dl>
        </div>
        <div class="price-box">
          <span class="label">${esc(t('w.yourPrice'))}</span>
          <div class="stepper">
            <button type="button" class="step-btn" data-act="price" data-d="-500" aria-label="−500"${d.price - 500 < q.minimum ? ' disabled' : ''}>−</button>
            <label class="price-input"><input id="w-price" type="number" inputmode="numeric" step="100" min="${q.minimum}" value="${d.price}" data-bind="price"><span>FCFA</span></label>
            <button type="button" class="step-btn" data-act="price" data-d="500" aria-label="+500">+</button>
          </div>
          <p class="field-error" id="w-price-err" hidden>${esc(t('w.belowMin', { min: fcfa(q.minimum) }))}</p>
        </div>
        <fieldset class="chips"><legend>${esc(t('w.payment'))}</legend>
          ${PAYMENTS.map(p => `<label class="chip-radio"><input type="radio" name="payment" id="w-pay-${p}" value="${p}" data-bind="payment"${d.payment === p ? ' checked' : ''}><span>${esc(t('pay.' + p))}</span></label>`).join('')}
        </fieldset>
        <p class="hint">${esc(t('w.priceNote'))}</p>`;
    }

    return `
      <section class="app-sec wizard">
        <div class="wiz-head">
          <button class="link-btn" type="button" data-act="${step === 1 ? 'home' : 'wiz-prev'}">← ${esc(t(step === 1 ? 'w.cancel' : 'w.prev'))}</button>
          <span class="mono">${esc(t('w.step', { n: step }))}</span>
        </div>
        <ol class="wiz-bar" aria-hidden="true">${titles.map((k, i) => `<li class="${i + 1 <= step ? 'is-done' : ''}"></li>`).join('')}</ol>
        <h1 class="app-title">${esc(t(titles[step - 1]))}</h1>
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
        <p class="phone-line">${esc(t('t.call'))} : <span class="mono select-all">${esc(dv.phone)}</span></p>

        <ol class="timeline">${steps.map((s, i) => `
          <li class="${i < idx || o.status === 'delivered' ? 'is-done' : i === idx ? 'is-now' : ''}">
            <span>${esc(t('status.' + s))}</span><small class="mono">${o.timeline[s] ? time(o.timeline[s]) : ''}</small>
          </li>`).join('')}</ol>

        <dl class="kv">
          <div><dt>${esc(t('t.agreed'))}</dt><dd class="mono">${fcfa(o.price)}</dd></div>
          <div><dt>${esc(t('w.payment'))}</dt><dd>${esc(t('pay.' + o.payment))}</dd></div>
        </dl>

        ${o.status !== 'delivered' ? `
        <div class="photo-row">
          ${photoInput(o, 'start', t('t.photosStart'))}
          ${['transit', 'arrived'].includes(o.status) ? photoInput(o, 'end', t('t.photosEnd')) : ''}
        </div>` : ''}

        ${o.status === 'arrived' ? `
          <div class="confirm-box">
            <p>${esc(t('t.confirmHint'))}</p>
            <button class="btn btn-signal btn-block" type="button" data-act="confirm" data-id="${o.id}">${esc(t('t.confirm'))}</button>
          </div>` : ''}

        ${o.sim && store.NEXT[o.status] ? `<button class="link-btn demo-btn" type="button" data-act="demo-next" data-id="${o.id}">${esc(t('t.demoNext'))} →</button>` : ''}

        ${o.status === 'delivered' ? receipt(o) : ''}
        ${reportBlock(o)}
        ${['assigned', 'pickup'].includes(o.status) ? cancelBlock(o) : ''}`;
    }

    return `
      <section class="app-sec">
        <div class="wiz-head">
          <button class="link-btn" type="button" data-act="home">← ${esc(t('c.history'))}</button>
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
    const rated = o.rating != null;
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
      ${rated ? `<p class="notice">${esc(t('r.thanks'))} <span class="stars">${stars(o.rating)}</span></p>` : `
      <form class="rate" id="rateForm" data-id="${o.id}">
        <p class="app-h">${esc(t('r.title'))}</p>
        <div class="rate-stars" role="radiogroup">
          ${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="stars" id="rate-${n}" value="${n}"${n === 5 ? ' checked' : ''}><span aria-label="${n}">★</span></label>`).join('')}
        </div>
        <label class="field"><span class="sr-only">${esc(t('r.commentPh'))}</span><input id="rateComment" placeholder="${esc(t('r.commentPh'))}"></label>
        <button class="btn btn-signal btn-sm" type="submit">${esc(t('r.send'))}</button>
      </form>`}
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
        ${nextKey ? `<button class="btn btn-signal btn-block" type="button" data-act="d-next" data-id="${o.id}">${esc(t(nextKey))}</button>` : ''}
        ${o.status === 'arrived' ? `<p class="hint">${esc(t('d.waitClient'))}</p>
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
        ${s.reports.length ? `<ol class="ledger-list">${s.reports.map(r => `<li><span><b class="mono">${esc(r.orderId)}</b><small>${esc(r.text)}</small></span><span class="mono">${date(r.at)}</span></li>`).join('')}</ol>` : `<p class="empty">${esc(t('a.noReports'))}</p>`}
      </section>
      <section class="app-sec">
        ${view.confirmReset ? `<div class="confirm-inline"><p>${esc(t('a.resetConfirm'))}</p><div class="btn-row">
          <button class="btn btn-danger btn-sm" type="button" data-act="reset-yes">${esc(t('a.resetYes'))}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="reset-no">${esc(t('a.resetNo'))}</button></div></div>`
          : `<button class="link-btn danger" type="button" data-act="reset-ask">${esc(t('a.reset'))}</button>`}
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
    const focused = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;

    let body;
    if (role === 'client') body = view.name === 'wizard' ? wizard() : view.name === 'order' ? orderView() : clientHome();
    else if (role === 'driver') body = driverView();
    else body = adminView();

    root.innerHTML = `${header(role)}<main class="app-main">${body}<p class="app-demo">${esc(t('app.demo'))}</p></main>`;

    Object.entries(keep).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bind) el.value = v;
    });
    if (focused) { const el = document.getElementById(focused); if (el) el.focus({ preventScroll: true }); }
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
    if (view.name === 'wizard' && view.draft) {
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
      case 'start': {
        const need = b.dataset.need;
        go('wizard', { step: 1, draft: newDraft({ need, vehicle: NEED_VEHICLE[need], service: need === 'moving' ? 'handling' : 'transport' }) });
        break;
      }
      case 'wiz-prev': go('wizard', { step: Math.max(1, view.step - 1) }); break;
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
        const keepKeys = ['need', 'from', 'to', 'fromDetail', 'toDetail', 'vehicle', 'service', 'items', 'weight', 'floorsFrom', 'floorsTo', 'elevator', 'helpers', 'packing', 'dismantle', 'payment'];
        const patch = {};
        keepKeys.forEach(k => { patch[k] = o[k]; });
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
  TK.vehicles.swipe(root, dir => { if (view.name === 'wizard' && view.draft) setVehicle(TK.vehicles.step(view.draft.vehicle, dir)); });

  root.addEventListener('input', e => {
    if (e.target.matches('input[type=text], input:not([type]), textarea, input[type=number], input[type=datetime-local]')) bindValue(e.target);
  });

  root.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'drvVehicle') { store.setDriver({ vehicle: el.value }); return; }
    if (el.dataset.act === 'photos') {
      const n = el.files ? el.files.length : 0;
      if (n) store.addPhotos(el.dataset.id, el.dataset.which, n);
      return;
    }
    if (bindValue(el)) {
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

  root.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'wizForm') {
      if (view.step === 3 && !view.draft.items.trim()) {
        document.getElementById('w-items-err').hidden = false;
        document.getElementById('w-items').focus();
        return;
      }
      if (view.step < 4) { go('wizard', { step: view.step + 1 }); return; }
      const q = draftQuote(view.draft);
      if (!view.draft.price || view.draft.price < q.minimum) {
        document.getElementById('w-price-err').hidden = false;
        return;
      }
      const o = store.createOrder(view.draft);
      ui.toast(t('toast.published'));
      go('order', { orderId: o.id, draft: null });
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
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lang-toggle]')) return;
    const next = TK.getLang() === 'fr' ? 'en' : 'fr';
    TK.setLang(next);
    store.set({ lang: next });
    TK.applyStatic();
    TKSite.refresh();
    render();
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
  }, 1000);

  window.TKApp = {
    prefill(q) {
      view.name = 'wizard'; view.step = 1;
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
