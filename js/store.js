// État de l'application et règles métier (commandes, offres, solde prépayé).
// Prototype : tout est stocké dans le navigateur. Le backend (Firebase) prendra le relais.
(function () {
  const { vehicle, commission, quote, distanceKm, roundUp100 } = TK;
  const KEY = 'takaata.v1';

  const DRIVER_POOL = [
    { name: 'Koné Ibrahim', rating: 4.9, trips: 214 },
    { name: 'Yao Serge', rating: 4.7, trips: 132 },
    { name: 'Bamba Moussa', rating: 4.8, trips: 301 },
    { name: 'Kouamé Patrice', rating: 4.6, trips: 58 },
    { name: 'Touré Awa', rating: 4.9, trips: 97 },
    { name: 'Diallo Mamadou', rating: 4.5, trips: 176 },
    { name: "N'Guessan Eric", rating: 4.8, trips: 245 }
  ];

  // Délais de la simulation (ms)
  const SIM = { offers: [2500, 5500, 9000, 13000], steps: [7000, 15000, 25000, 35000], decision: 3500, autoConfirm: 4000 };
  // Sans réponse du client après l'arrivée, la course est clôturée sur la preuve du chauffeur.
  // Prototype : 60 s pour la démonstration (valeur réelle à fixer, par ex. 2 h).
  const AUTO_CLOSE_MS = 60 * 1000;
  const FREE_CANCEL_MS = 5 * 60 * 1000;

  let state;
  const listeners = new Set();

  // --- utilitaires ---
  function rng(seedStr) {
    let h = 2166136261;
    for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h += 0x6D2B79F5;
      let x = Math.imul(h ^ (h >>> 15), 1 | h);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const plateFor = r => `${1000 + Math.floor(r() * 8999)} ${['GH', 'KL', 'FP', 'JD', 'HB'][Math.floor(r() * 5)]} 01`;
  const phoneFor = r => `+225 07 ${String(Math.floor(r() * 90) + 10)} ${String(Math.floor(r() * 90) + 10)} ${String(Math.floor(r() * 90) + 10)} ${String(Math.floor(r() * 90) + 10)}`;
  function newId() {
    const d = new Date();
    const stamp = String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return `TK-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function defaultState() {
    return {
      lang: 'fr',
      role: 'client',
      orders: [],
      driverAccounts: {},   // chauffeurs par numéro : dossier, véhicule, solde prépayé, gains
      driverSession: null,
      reports: [],
      leads: [],
      pricing: null,    // grille modifiée depuis l'Admin (null = grille du business plan)
      accounts: {},     // comptes clients par numéro (prototype local ; Firebase Auth au lancement)
      session: null,    // numéro du client connecté
      seeded: false
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
    } catch (e) { state = defaultState(); }
    if (!state.seeded) seed();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* stockage indisponible */ }
  }
  function emit() { save(); listeners.forEach(fn => fn()); }

  // Demandes d'autres clients, visibles dans l'espace chauffeur.
  function seed() {
    const now = Date.now();
    const samples = [
      { need: 'furniture', from: 'marcory', to: 'koumassi', vehicle: 'van1t', items: 'Armoire 3 portes, 2 chevets', weight: '120 kg', service: 'handling', helpers: 1, floorsFrom: 0, floorsTo: 2, elevator: false, payment: 'cash', client: 'Akissi D.' },
      { need: 'food', from: 'adjame', to: 'yopougon', vehicle: 'truck3t', items: '40 sacs de riz de 25 kg', weight: '1 000 kg', service: 'transport', payment: 'wave', client: 'Boutique Sika' },
      { need: 'parcel', from: 'plateau', to: 'cocody', vehicle: 'tricycle', items: '6 cartons de fournitures', weight: '60 kg', service: 'transport', payment: 'orange', client: 'Kader T.' }
    ];
    samples.forEach((s, i) => {
      const o = buildOrder(Object.assign({ fromDetail: '', toDetail: '', when: 'now', packing: false, dismantle: false }, s), 'other');
      o.createdAt = now - (i + 1) * 60000;
      o.plannedOffers = [];
      state.orders.push(o);
    });
    state.seeded = true;
    save();
  }

  // Numéro à 10 chiffres pour les clients simulés.
  const demoPhone = r => ['07', '05', '01'][Math.floor(r() * 3)] + String(Math.floor(r() * 1e8)).padStart(8, '0');

  // Numéro relais (appel masqué) : seul numéro que chauffeur et client voient l'un de l'autre.
  // Prototype : numéro fictif ; au lancement, attribué par l'opérateur téléphonique / le fournisseur d'appels masqués.
  function relayFor(orderId) {
    const r = rng('relay' + orderId);
    return '27 20 ' + [0, 0, 0].map(() => String(Math.floor(r() * 90) + 10)).join(' ');
  }
  // Appels possibles de l'attribution du chauffeur jusqu'à la fin de la course.
  const CALLABLE = ['assigned', 'pickup', 'loading', 'transit', 'arrived'];
  function canCall(o) { return !!(o && o.driver && CALLABLE.includes(o.status)); }

  // --- commandes ---
  function buildOrder(draft, owner) {
    const km = distanceKm(draft.from, draft.to);
    const q = quote(draft.vehicle, km, draft);
    const price = Math.max(draft.price || q.reference, q.minimum);
    const o = Object.assign({}, draft, {
      id: newId(), owner, createdAt: Date.now(), km,
      transportPrice: q.transport, optionsPrice: q.options, reference: q.reference, minimum: q.minimum,
      price, status: 'open', offers: [], plannedOffers: [], timeline: {}, photos: { start: 0, end: 0 },
      clientPhone: owner === 'me' ? state.session : demoPhone(rng(draft.from + draft.to + draft.client))
    });
    if (owner === 'me') o.plannedOffers = planOffers(o);
    return o;
  }

  function planOffers(o) {
    const r = rng(o.id);
    const pool = DRIVER_POOL.slice().sort(() => r() - 0.5).slice(0, SIM.offers.length);
    return pool.map((d, i) => {
      // Plus le prix proposé est haut par rapport à la référence, plus les chauffeurs acceptent tel quel.
      const generosity = o.price / o.reference;
      const accepts = r() < Math.min(0.85, 0.25 + (generosity - 0.9) * 1.5);
      const counter = roundUp100(Math.max(o.minimum, o.price * (1.05 + r() * 0.2), o.reference * (0.97 + r() * 0.12)));
      const price = accepts ? o.price : Math.max(counter, o.price + 100);
      return {
        id: `${o.id}-${i}`, at: o.createdAt + SIM.offers[i], name: d.name, rating: d.rating, trips: d.trips,
        plate: plateFor(r), phone: phoneFor(r), eta: 4 + Math.floor(r() * 18), price, kind: price === o.price ? 'accept' : 'counter'
      };
    });
  }

  function createOrder(draft) {
    const o = buildOrder(draft, 'me');
    state.orders.unshift(o);
    emit();
    return o;
  }

  const getOrder = id => state.orders.find(o => o.id === id);

  function visibleOffers(o, now = Date.now()) {
    const planned = o.plannedOffers.filter(p => p.at <= now);
    return planned.concat(o.offers).filter(of => !of.declined).sort((a, b) => a.price - b.price || b.rating - a.rating);
  }

  // --- solde chauffeur ---
  // Chauffeur connecté sur cet appareil.
  function drv() { return state.driverAccounts[state.driverSession] || null; }

  function held() { return drv() ? Object.values(drv().holds).reduce((s, n) => s + n, 0) : 0; }
  function available() { return drv() ? drv().balance - held() : 0; }
  function ledger(type, amount, extra) { drv().ledger.unshift(Object.assign({ at: Date.now(), type, amount }, extra)); }

  function recharge(amount, channel) {
    drv().balance += amount;
    ledger('recharge', amount, { channel });
    emit();
  }

  function hold(orderId, amount) {
    drv().holds[orderId] = amount;
    ledger('reserve', amount, { orderId });
  }
  function release(orderId) {
    const amount = drv().holds[orderId];
    if (amount == null) return;
    delete drv().holds[orderId];
    ledger('release', amount, { orderId });
  }

  // Offre de « mon » chauffeur : vérifie et réserve 15 % avant d'envoyer.
  function driverOffer(orderId, price) {
    const o = getOrder(orderId);
    const dd = drv();
    if (!o || o.status !== 'open' || !dd || dd.status !== 'approved' || dd.suspended || !dd.online) return { ok: false };
    if (o.offers.some(of => of.me && !of.declined)) return { ok: false };
    price = Math.max(o.minimum, Math.round(price));
    const c = commission(price, o.optionsPrice);
    if (available() < c) return { ok: false, missing: c - available() };
    hold(o.id, c);
    const d = drv();
    o.offers.push({
      id: `${o.id}-me`, me: true, at: Date.now(), name: `${d.firstName} ${d.lastName}`, rating: driverRating(d), trips: d.trips,
      plate: d.plate, phone: '+225 ' + d.phone.replace(/(\d{2})(?=\d)/g, '$1 '), eta: 6, price, kind: price === o.price ? 'accept' : 'counter'
    });
    // Les clients simulés répondent après quelques secondes.
    if (o.owner === 'other') o.pendingDecision = Date.now() + SIM.decision;
    emit();
    return { ok: true };
  }

  function chooseOffer(orderId, offerId) {
    const o = getOrder(orderId);
    if (!o || o.status !== 'open') return;
    const offer = visibleOffers(o).find(of => of.id === offerId);
    if (!offer) return;
    if (offer.me) {
      // Réservation déjà faite ; on vérifie qu'elle couvre bien le prix retenu.
      if (!drv() || drv().holds[o.id] !== commission(offer.price, o.optionsPrice)) return;
    } else {
      // Mon offre éventuelle n'est pas retenue : libération immédiate.
      const mine = o.offers.find(of => of.me && !of.declined);
      if (mine) { mine.declined = true; if (drv()) release(o.id); }
    }
    o.driver = offer;
    o.relay = relayFor(o.id);
    o.price = offer.price;
    o.commission = commission(offer.price, o.optionsPrice);
    o.status = 'assigned';
    o.timeline.assigned = Date.now();
    o.sim = !offer.me;
    if (o.sim) {
      const base = Date.now();
      o.schedule = { pickup: base + SIM.steps[0], loading: base + SIM.steps[1], transit: base + SIM.steps[2], arrived: base + SIM.steps[3] };
    }
    emit();
    return offer;
  }

  const NEXT = { assigned: 'pickup', pickup: 'loading', loading: 'transit', transit: 'arrived' };
  function advance(orderId) {
    const o = getOrder(orderId);
    if (!o || !NEXT[o.status]) return;
    o.status = NEXT[o.status];
    o.timeline[o.status] = Date.now();
    if (o.schedule) delete o.schedule[o.status];
    // Le chauffeur simulé documente le chargement et la livraison par photos.
    if (o.sim && o.status === 'loading') o.photos.start = Math.max(o.photos.start, 2);
    if (o.sim && o.status === 'arrived') o.photos.end = Math.max(o.photos.end, 2);
    if (o.status === 'arrived') o.autoConfirmAt = Date.now() + (o.owner === 'other' ? SIM.autoConfirm : AUTO_CLOSE_MS);
    emit();
  }

  // Confirmation de livraison : débit unique de la commission (espèces) ou reversement net (Mobile Money).
  // by : 'client' (confirmation), 'auto' (sans réponse, sur preuve du chauffeur) ou 'support' (litige tranché).
  function confirmDelivery(orderId, by = 'client') {
    const o = getOrder(orderId);
    if (!o || o.status !== 'arrived') return;
    o.status = 'delivered';
    o.closedBy = by;
    delete o.autoConfirmAt;
    o.timeline.delivered = Date.now();
    // Le chauffeur note aussi le client (simulé : 5 étoiles).
    const u = user();
    if (o.owner === 'me' && u) {
      u.rating = ((u.rating || 5) * (u.ratingCount || 0) + 5) / ((u.ratingCount || 0) + 1);
      u.ratingCount = (u.ratingCount || 0) + 1;
    }
    if (o.driver && o.driver.me && drv()) {
      const c = o.commission;
      const d = drv();
      d.trips = (d.trips || 0) + 1;
      d.earnings.unshift({ at: Date.now(), orderId: o.id, route: [o.from, o.to], price: o.price, net: o.price - c, channel: o.payment });
      delete drv().holds[o.id];
      if (o.payment === 'cash') {
        drv().balance -= c;
        ledger('debit', c, { orderId: o.id });
      } else {
        const net = o.price - c;
        drv().digitalEarnings += net;
        ledger('payout', net, { orderId: o.id, channel: o.payment });
      }
    }
    emit();
  }

  function cancelInfo(o) {
    if (o.status === 'open') return { free: true };
    if (o.status === 'assigned' && Date.now() - o.timeline.assigned < FREE_CANCEL_MS) return { free: true };
    return { free: false };
  }

  function cancelOrder(orderId) {
    const o = getOrder(orderId);
    if (!o || ['delivered', 'cancelled', 'arrived'].includes(o.status)) return;
    o.cancelFree = cancelInfo(o).free;
    o.status = 'cancelled';
    o.timeline.cancelled = Date.now();
    if (drv() && drv().holds[o.id] != null) release(o.id);
    emit();
  }

  function rate(orderId, stars, tags, comment) {
    const o = getOrder(orderId);
    if (!o || o.rating != null) return;
    o.rating = stars;
    o.ratingTags = tags || [];
    o.ratingComment = comment || '';
    if (o.driver && o.driver.me && drv()) {
      const d = drv();
      d.ratingSum = (d.ratingSum || 0) + stars;
      d.ratingCount = (d.ratingCount || 0) + 1;
    }
    emit();
  }

  // Signalement : pendant la livraison, il suspend la clôture automatique (litige traité par le support).
  function dispute(orderId) {
    const o = getOrder(orderId);
    if (!o || o.status !== 'arrived') return;
    o.disputed = true;
    delete o.autoConfirmAt;
  }

  function addPhotos(orderId, which, count) {
    const o = getOrder(orderId);
    if (!o) return;
    o.photos[which] += count;
    emit();
  }

  function report(orderId, text) {
    state.reports.unshift({ at: Date.now(), orderId, text, phone: state.session });
    if (orderId) dispute(orderId);
    emit();
  }

  // --- comptes clients ---
  function user() { return state.session ? state.accounts[state.session] : null; }
  function account(phone) { return state.accounts[phone] || null; }
  function register(info) {
    state.accounts[info.phone] = Object.assign({ createdAt: Date.now(), rating: 5, ratingCount: 0, photo: '', passHash: '', notif: true }, info);
    state.session = info.phone;
    emit();
  }
  function login(phone) { if (state.accounts[phone]) { state.session = phone; emit(); } }
  function logout() { state.session = null; emit(); }
  function updateUser(patch) { const u = user(); if (u) { Object.assign(u, patch); emit(); } }

  // Boucle de simulation : offres, réponses des clients simulés, progression des courses.
  function tick() {
    const now = Date.now();
    let changed = false;
    const events = [];
    for (const o of state.orders) {
      if (o.status === 'open' && o.owner === 'me') {
        const seen = o.seenOffers || 0;
        const count = o.plannedOffers.filter(p => p.at <= now).length;
        if (count > seen) {
          o.seenOffers = count;
          changed = true;
          events.push({ type: 'offer', order: o });
        }
      }
      if (o.pendingDecision && now >= o.pendingDecision) {
        delete o.pendingDecision;
        const mine = o.offers.find(of => of.me && !of.declined);
        if (o.status === 'open' && mine) {
          if (mine.price <= Math.round(o.price * 1.15)) {
            chooseOffer(o.id, mine.id);
            events.push({ type: 'accepted', order: o });
          } else {
            mine.declined = true;
            if (drv()) release(o.id);
            events.push({ type: 'declined', order: o });
          }
        }
        changed = true;
      }
      if (o.sim && o.schedule) {
        const due = Object.entries(o.schedule).filter(([, at]) => at <= now).map(([s]) => s);
        for (const s of TK.STATUSES) {
          if (due.includes(s) && NEXT[o.status] === s) { advance(o.id); changed = true; }
        }
      }
      if (o.autoConfirmAt && now >= o.autoConfirmAt) {
        delete o.autoConfirmAt;
        confirmDelivery(o.id, o.owner === 'other' ? 'client' : 'auto');
        changed = true;
      }
    }
    for (const d of Object.values(state.driverAccounts)) {
      if (d.status === 'pending' && now - d.submittedAt >= DEMO_REVIEW_MS) {
        d.status = 'approved'; d.reviewedAt = now; changed = true;
        if (d.phone === state.driverSession) events.push({ type: 'approved' });
      }
    }
    if (changed) emit();
    return events;
  }

  function reset() {
    const { lang, accounts, session, driverAccounts, driverSession } = state;
    state = defaultState();
    // Les comptes restent ; soldes et gains des chauffeurs repartent de zéro.
    Object.values(driverAccounts).forEach(d => Object.assign(d, { online: false, balance: 0, holds: {}, ledger: [], digitalEarnings: 0, earnings: [], trips: 0, ratingSum: 0, ratingCount: 0 }));
    Object.assign(state, { lang, accounts, session, driverAccounts, driverSession });
    seed();
    emit();
  }

  function set(patch) { Object.assign(state, patch); emit(); }
  // --- Admin : tarifs, suspension, litiges ---
  const DEFAULT_PRICING = {
    vehicles: Object.fromEntries(TK.VEHICLES.map(v => [v.id, { base: v.base, perKm: v.perKm, floor: v.floor }])),
    helper: TK.OPTIONS.helper, floorFee: TK.OPTIONS.floor
  };
  function applyPricing() {
    const pr = state.pricing || DEFAULT_PRICING;
    TK.VEHICLES.forEach(v => Object.assign(v, pr.vehicles[v.id]));
    TK.OPTIONS.helper = pr.helper;
    TK.OPTIONS.floor = pr.floorFee;
  }
  function setPricing(pr) { state.pricing = pr; applyPricing(); emit(); }
  function resetPricing() { state.pricing = null; applyPricing(); emit(); }
  function suspendDriver(phone, on) {
    const d = state.driverAccounts[phone];
    if (!d) return;
    d.suspended = on;
    if (on) d.online = false;
    emit();
  }
  function resolveReport(at) {
    const r = state.reports.find(x => x.at === at);
    if (r) { r.resolved = true; emit(); }
  }
  function adminCancel(orderId) {
    const o = getOrder(orderId);
    if (!o) return;
    o.cancelledBy = 'support';
    cancelOrder(orderId);
  }

  function setDriver(patch) { if (drv()) { Object.assign(drv(), patch); emit(); } }

  // --- comptes chauffeurs ---
  const DEMO_REVIEW_MS = 8000;  // prototype : dossier validé automatiquement après 8 s (réel : équipe Takaata)
  function driverRating(d) { return d.ratingCount ? d.ratingSum / d.ratingCount : 5; }
  function driverAccount(phone) { return state.driverAccounts[phone] || null; }
  function driverRegister(profile) {
    state.driverAccounts[profile.phone] = Object.assign({
      status: 'pending', submittedAt: Date.now(), online: false, trips: 0, ratingSum: 0, ratingCount: 0,
      balance: 0, holds: {}, ledger: [], digitalEarnings: 0, earnings: []
    }, profile);
    state.driverSession = profile.phone;
    emit();
  }
  function driverLogin(phone) { if (state.driverAccounts[phone]) { state.driverSession = phone; emit(); } }
  function driverLogout() { if (drv()) drv().online = false; state.driverSession = null; emit(); }
  function reviewDriver(phone, ok, reason) {
    const d = state.driverAccounts[phone];
    if (!d) return;
    d.status = ok ? 'approved' : 'rejected';
    d.reviewedAt = Date.now();
    d.rejectReason = ok ? '' : (reason || '');
    emit();
  }
  function addLead(lead) { state.leads.push(Object.assign({ at: Date.now() }, lead)); emit(); }

  load();
  applyPricing();

  window.TK = Object.assign(window.TK || {}, {
    store: {
      get state() { return state; },
      subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
      set, setDriver, addLead, createOrder, getOrder, visibleOffers, driverOffer, chooseOffer,
      advance, confirmDelivery, cancelInfo, cancelOrder, rate, addPhotos, report, recharge, tick, reset,
      user, account, register, login, logout, updateUser,
      setPricing, resetPricing, suspendDriver, resolveReport, adminCancel, DEFAULT_PRICING,
      driver: drv, driverAccount, driverRegister, driverLogin, driverLogout, reviewDriver, driverRating,
      held, available, NEXT, AUTO_CLOSE_MS, canCall
    }
  });
})();
