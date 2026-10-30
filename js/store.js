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
  const SIM = { offers: [2500, 5500, 9000, 13000], steps: [7000, 15000, 25000, 35000], decision: 3500 };
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
      pricing: null,
      settings: { whatsapp: '', driverRefBonus: 0, dataSaver: false },  // WhatsApp Takaata, bonus de parrainage chauffeur, économie de données
      recurring: [],    // courses programmées chaque semaine (modèle de commande + jours + heure)
      events: [],
      trips: null,      // trajets « Vivriers vers Abidjan » publiés par les chauffeurs
      admin: { ownerHash: '', staff: [] },  // accès à la console : administrateur principal + collaborateurs       // journal d'usage pour les analyses (publication, offres, refus, annulations…)    // grille modifiée depuis l'Admin (null = grille du business plan)
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
    // Anciennes données : identifiant et statut pour chaque signalement.
    (state.reports || []).forEach((r, i) => { if (!r.id) r.id = 'RP-' + (r.at || Date.now()).toString(36).toUpperCase() + i; if (!r.status) r.status = r.resolved ? 'resolved' : 'open'; if (!r.type) r.type = r.urgent ? 'sos' : r.orderId ? 'dispute' : 'message'; });
  }
  // Session déjà ouverte dans un autre onglet (ex. Admin) : on recharge l'état dès qu'il change,
  // pour qu'une suspension ou une validation s'applique immédiatement.
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = Object.assign(defaultState(), JSON.parse(e.newValue)); } catch (err) { return; }
    listeners.forEach(fn => fn());
  });
  function save() {
    try { saveRaw(); } catch (e) {
      // Stockage plein (photos, notes vocales) : on retire les médias des courses terminées les plus anciennes.
      const old = state.orders.filter(o => ['delivered', 'cancelled'].includes(o.status) && (o.voice || o.itemPhotos || o.proofs)).reverse();
      for (const o of old) { delete o.voice; delete o.itemPhotos; delete o.proofs; try { saveRaw(); return; } catch (err) { /* continuer */ } }
      // Sinon : stockage indisponible (navigation privée), l'app continue en mémoire.
    }
  }
  function saveRaw() { localStorage.setItem(KEY, JSON.stringify(state)); }
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

  // --- journal d'usage (analyses) ---
  const MAX_EVENTS = 5000;
  function track(type, o, extra) {
    const e = Object.assign({ at: Date.now(), type }, o ? { orderId: o.id, from: o.from, to: o.to, vehicle: o.vehicle, need: o.need, km: o.km } : {}, extra);
    state.events.unshift(e);
    if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS;
  }
  const who = of => of.me && drv() ? drv().phone : of.name;

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
    const chk = TK.checkLoad(o, o.vehicle, km);
    o.weightKg = chk.kg; o.volume = chk.volume;
    if (owner === 'me') o.plannedOffers = planOffers(o);
    return o;
  }

  // Contrôle « serveur » d'une demande : capacité réelle du véhicule et date prévue.
  const PLAN_MIN_MS = 15 * 60 * 1000, PLAN_MAX_DAYS = 30;
  function validateDraft(draft) {
    const km = distanceKm(draft.from, draft.to);
    const errors = TK.checkLoad(Object.assign({}, draft, { km }), draft.vehicle, km).errors.slice();
    if (draft.when === 'later') {
      const at = new Date(draft.whenAt).getTime();
      if (!at || at < Date.now() + PLAN_MIN_MS || at > Date.now() + PLAN_MAX_DAYS * 864e5) errors.push({ code: 'date' });
    }
    return errors;
  }

  function planOffers(o, base = o.createdAt) {
    const round = o.rounds || 1;
    const r = rng(o.id + ':' + round);
    // Même modèle que la jauge du client : moins de chances = moins de chauffeurs intéressés, et surtout des contre-offres.
    const ch = TK.acceptChance({ vehicle: o.vehicle, km: o.km, price: o.price, reference: o.reference, when: o.when, at: base });
    const n = ch.pct < 15 ? 1 : ch.pct < 40 ? 2 : ch.pct < 70 ? 3 : 4;
    const pool = DRIVER_POOL.slice().sort(() => r() - 0.5).slice(0, n);
    return pool.map((d, i) => {
      const accepts = r() < ch.pct / 100 * 0.9;
      const counter = roundUp100(Math.max(o.minimum, o.price * (1.05 + r() * 0.2), o.reference * (0.97 + r() * 0.12)));
      const price = accepts ? o.price : Math.max(counter, o.price + 100);
      return {
        id: `${o.id}-${round}-${i}`, at: base + SIM.offers[i], name: d.name, rating: d.rating, trips: d.trips,
        plate: plateFor(r), phone: phoneFor(r), eta: 4 + Math.floor(r() * 18), price, kind: price === o.price ? 'accept' : 'counter'
      };
    });
  }

  function createOrder(draft) {
    const errors = validateDraft(draft);
    if (errors.length) { track('rejected_publish', null, { codes: errors.map(e => e.code), vehicle: draft.vehicle }); emit(); return { ok: false, errors }; }
    const o = buildOrder(draft, 'me');
    state.orders.unshift(o);
    track('created', o, { price: o.price, reference: o.reference, service: o.service, passengers: +o.passengers || 0 });
    emit();
    return { ok: true, order: o };
  }

  const getOrder = id => state.orders.find(o => o.id === id);

  // Nouvelle proposition du client (autant de fois qu'il veut) : les acceptations au prix précédent expirent,
  // les contre-offres au moins égales au nouveau prix restent valables, et la demande repart vers les chauffeurs.
  function repropose(orderId, price) {
    const o = getOrder(orderId);
    if (!o || o.status !== 'open') return { ok: false };
    price = Math.max(o.minimum, Math.round(price));
    if (price === o.price) return { ok: false, same: true };
    const now = Date.now();
    for (const of of visibleOffers(o, now)) if (of.kind === 'accept' || of.price < price) of.declined = true;
    o.plannedOffers = o.plannedOffers.filter(p => p.at <= now);
    const mine = o.offers.find(of => of.me && of.declined);
    if (mine && drv() && drv().holds[o.id] != null) release(o.id);
    o.rounds = (o.rounds || 1) + 1;
    track('reproposed', o, { price, previous: o.price, round: o.rounds });
    o.price = price;
    if (o.owner === 'me') o.plannedOffers = o.plannedOffers.concat(planOffers(o, now));
    o.seenOffers = o.plannedOffers.filter(p => p.at <= now).length;
    emit();
    return { ok: true };
  }

  function visibleOffers(o, now = Date.now()) {
    const planned = o.plannedOffers.filter(p => p.at <= now);
    return planned.concat(o.offers).filter(of => !of.declined).sort((a, b) => a.price - b.price || b.rating - a.rating);
  }

  // --- dossier chauffeur : documents et droits d'agir ---
  // Un document peut être : manquant, fourni (à vérifier), vérifié, refusé ou expiré. Une date seule ne prouve rien.
  const REQUIRED_DOCS = ['idFront', 'idBack', 'selfie', 'license', 'regCard', 'insurance', 'inspection', 'vehicleFront', 'vehicleCargo'];
  const DOC_EXPIRY = { license: 'licenseExp', insurance: 'insuranceExp', inspection: 'inspectionExp' };
  function docState(d, key) {
    if (!d || !(d.docs && d.docs[key])) return 'missing';
    const exp = DOC_EXPIRY[key] && d[DOC_EXPIRY[key]];
    if (DOC_EXPIRY[key] && (!exp || new Date(exp).getTime() < Date.now())) return 'expired';
    const rv = (d.docReview || {})[key];
    return rv ? rv.status : 'provided';
  }
  const docsBlocking = d => REQUIRED_DOCS.filter(k => ['missing', 'expired', 'refused'].includes(docState(d, k)));
  function reviewDoc(phone, key, ok, reason) {
    const d = state.driverAccounts[phone];
    if (!d || !(d.docs && d.docs[key])) return;
    d.docReview = Object.assign({}, d.docReview, { [key]: { status: ok ? 'verified' : 'refused', reason: ok ? '' : reason || '', at: Date.now() } });
    emit();
  }
  // Document renvoyé par le chauffeur (nouvelle photo, nouvelle date) : il repasse en « fourni, à vérifier ».
  function updateDoc(key, img, exp) {
    const d = drv();
    if (!d || !REQUIRED_DOCS.includes(key)) return { ok: false };
    const ek = DOC_EXPIRY[key];
    if (ek) { if (!exp || new Date(exp).getTime() <= Date.now()) return { ok: false, code: 'date' }; d[ek] = exp; }
    d.docs = Object.assign({}, d.docs, { [key]: 1 });
    d.docImgs = Object.assign({}, d.docImgs, { [key]: img });
    d.docReview = Object.assign({}, d.docReview); delete d.docReview[key];
    d.docsSubmittedAt = Date.now();
    track('doc_updated', null, { driver: d.phone, doc: key });
    emit();
    return { ok: true };
  }
  // Chauffeur autorisé à agir : dossier validé, non suspendu, documents valides.
  function activeDrv() { const d = drv(); return d && d.status === 'approved' && !d.suspended && !docsBlocking(d).length ? d : null; }
  function blockReason(d) {
    if (!d) return 'nodriver';
    if (d.suspended) return 'suspended';
    if (d.status !== 'approved') return 'pending';
    if (docsBlocking(d).length) return 'docs';
    return '';
  }

  // --- solde chauffeur ---
  // Chauffeur connecté sur cet appareil.
  function drv() { return state.driverAccounts[state.driverSession] || null; }

  function held() { return drv() ? Object.values(drv().holds).reduce((s, n) => s + n, 0) : 0; }
  function available() { return drv() ? drv().balance - held() : 0; }
  function ledger(type, amount, extra) { drv().ledger.unshift(Object.assign({ at: Date.now(), type, amount }, extra)); }

  function recharge(amount, channel) {
    amount = Math.round(amount);
    if (!drv() || drv().suspended) return false;
    if (!(amount >= RECHARGE_MIN)) return false;
    drv().balance += amount;
    ledger('recharge', amount, { channel });
    emit();
    return true;
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
    if (!o || o.status !== 'open') return { ok: false };
    const why = blockReason(dd);
    if (why) return { ok: false, reason: why };
    if (!dd.online) return { ok: false, reason: 'offline' };
    if (o.offers.some(of => of.me && !of.declined)) return { ok: false };
    // Refait à chaque acceptation : véhicule, capacité réelle, et une seule course à la fois (charge déjà embarquée).
    if (o.vehicle !== dd.vehicle) return { ok: false, reason: 'vehicle' };
    const chk = TK.checkLoad(o, dd.vehicle, o.km);
    if (!chk.ok) return { ok: false, reason: 'capacity', errors: chk.errors };
    if (state.orders.some(x => x.driver && x.driver.me && CALLABLE.includes(x.status))) return { ok: false, reason: 'busy' };
    price = Math.max(o.minimum, Math.round(price));
    const c = commission(price, o.optionsPrice);
    if (available() < c) return { ok: false, missing: c - available() };
    hold(o.id, c);
    track('offer', o, { driver: dd.phone, kind: price === o.price ? 'accept' : 'counter', price, asked: o.price, reference: o.reference, delayMs: Date.now() - o.createdAt });
    const d = drv();
    o.offers.push({
      id: `${o.id}-me`, me: true, driverPhone: d.phone, at: Date.now(), name: `${d.firstName} ${d.lastName}`, rating: driverRating(d), trips: d.trips,
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
      // Réservation déjà faite ; on vérifie qu'elle couvre bien le prix retenu, et on refait les contrôles du chauffeur.
      if (!drv() || drv().holds[o.id] !== commission(offer.price, o.optionsPrice)) return;
      if (!activeDrv() || !TK.checkLoad(o, drv().vehicle, o.km).ok) { offer.declined = true; release(o.id); emit(); return; }
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
    // Code de livraison à 4 chiffres : le client le donne au chauffeur à l'arrivée, ce qui clôture la course et libère le paiement.
    o.deliveryCode = String(1000 + Math.floor(Math.random() * 9000));
    o.codeTries = 0;
    track('assigned', o, { driver: who(offer), kind: offer.kind, price: offer.price, asked: o.price, reference: o.reference, delayMs: Date.now() - o.createdAt });
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
    if (o.driver && o.driver.me && !activeDrv()) return;
    o.status = NEXT[o.status];
    o.timeline[o.status] = Date.now();
    if (o.schedule) delete o.schedule[o.status];
    // Le chauffeur simulé documente le chargement et la livraison par photos.
    if (o.sim && o.status === 'loading') o.photos.start = Math.max(o.photos.start, 2);
    if (o.sim && o.status === 'arrived') o.photos.end = Math.max(o.photos.end, 2);
    emit();
  }

  // Confirmation de livraison : débit unique de la commission (espèces) ou reversement net (Mobile Money).
  // by : 'client' (confirmation), 'auto' (sans réponse, sur preuve du chauffeur) ou 'support' (litige tranché).
  function confirmDelivery(orderId, by = 'client') {
    const o = getOrder(orderId);
    if (!o || o.status !== 'arrived') return;
    o.status = 'delivered';
    o.closedBy = by;
    if (by === 'support') state.reports.filter(x => x.orderId === o.id && x.status !== 'resolved').forEach(x => Object.assign(x, { status: 'resolved', resolved: true, resolvedAt: Date.now(), outcome: 'validate' }));
    o.disputed = false;
    track('delivered', o, { driver: o.driver && who(o.driver), price: o.price, by, durationMs: Date.now() - (o.timeline.assigned || o.createdAt) });
    o.timeline.delivered = Date.now();
    // Le chauffeur note aussi le client. Chauffeur simulé : 5 étoiles ; chauffeur de cet appareil : il choisit après le code.
    if (o.owner === 'me' && !(o.driver && o.driver.me)) applyClientRating(o.clientPhone, 5);
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

  // Le chauffeur saisit le code du client. 5 essais, puis le support prend le relais.
  const CODE_TRIES = 5, END_PHOTOS_MIN = 2, RECHARGE_MIN = 5000;
  function submitDeliveryCode(orderId, codeIn) {
    const o = getOrder(orderId);
    if (!o || o.status !== 'arrived') return { ok: false };
    if (o.driver && o.driver.me && !activeDrv()) return { ok: false, blocked: true };
    if (o.codeTries >= CODE_TRIES) return { ok: false, locked: true };
    // Le chauffeur photographie la marchandise livrée (2 photos minimum) avant de saisir le code.
    if (o.driver && o.driver.me && (o.photos.end || 0) < END_PHOTOS_MIN) return { ok: false, photos: true };
    if (String(codeIn).trim() !== o.deliveryCode) {
      o.codeTries = (o.codeTries || 0) + 1;
      track('code_failed', o, { tries: o.codeTries });
      if (o.codeTries >= CODE_TRIES) { o.disputed = true; addReport({ orderId: o.id, text: 'Code de livraison : 5 essais incorrects.', phone: o.clientPhone, type: 'dispute' }); }
      emit();
      return { ok: false, left: CODE_TRIES - o.codeTries };
    }
    confirmDelivery(o.id, 'code');
    return { ok: true };
  }

  // Vérifications du visage du chauffeur (en ligne, acceptation, départ) : gardées comme preuve.
  function faceCheck(step, orderId, image) {
    const d = drv();
    if (!d || d.suspended) return;
    const entry = { at: Date.now(), step, orderId: orderId || null, ok: true };
    d.faceChecks = [entry].concat(d.faceChecks || []).slice(0, 50);
    if (image && step === 'online') d.lastFace = image;
    const o = orderId && getOrder(orderId);
    if (o) o.faceChecks = (o.faceChecks || []).concat(entry);
    track('face_check', o || null, { driver: d.phone, step });
    emit();
  }

  // --- note du client par le chauffeur ---
  function applyClientRating(phone, stars) {
    const u = phone && state.accounts[phone];
    if (!u) return;
    u.rating = ((u.rating || 5) * (u.ratingCount || 0) + stars) / ((u.ratingCount || 0) + 1);
    u.ratingCount = (u.ratingCount || 0) + 1;
  }
  function rateClient(orderId, stars, tags) {
    const o = getOrder(orderId);
    if (!o || o.status !== 'delivered' || o.clientRating) return;
    o.clientRating = { stars, tags: tags || [], at: Date.now() };
    if (o.owner === 'me') applyClientRating(o.clientPhone, stars);
    track('client_rated', o, { stars, tags: tags || [] });
    emit();
  }
  // Note affichée aux chauffeurs : vraie note du compte, ou note simulée stable pour les clients de démonstration.
  function clientRatingOf(o) {
    const u = o.owner === 'me' && state.accounts[o.clientPhone];
    if (u) return u.ratingCount ? { rating: u.rating, count: u.ratingCount } : null;
    const r = rng('cr' + (o.client || o.id));
    return { rating: Math.round((4.2 + r() * 0.8) * 10) / 10, count: 3 + Math.floor(r() * 60) };
  }

  // --- courses programmées chaque semaine ---
  // Prochaine date (jours 0 = dimanche … 6 = samedi, heure « HH:MM ») après « from ».
  function nextOccurrence(days, time, from = Date.now()) {
    const [h, m] = time.split(':').map(Number);
    for (let i = 0; i < 8; i++) {
      const d = new Date(from); d.setDate(d.getDate() + i); d.setHours(h, m, 0, 0);
      if (days.includes(d.getDay()) && d.getTime() > from) return d.getTime();
    }
    return null;
  }
  const PUBLISH_BEFORE_MS = 60 * 60 * 1000;   // la demande est publiée 1 h avant l'heure prévue
  function addRecurring(template, days, time) {
    const r = { id: 'RC-' + newId().slice(3), template, days, time, active: true, createdAt: Date.now(), owner: state.session, created: [] };
    r.nextAt = nextOccurrence(days, time);
    state.recurring = (state.recurring || []).concat(r);
    track('recurring_created', null, { days: days.length, vehicle: template.vehicle });
    emit();
    return r;
  }
  function toggleRecurring(id) { const r = (state.recurring || []).find(x => x.id === id); if (r) { r.active = !r.active; if (r.active) r.nextAt = nextOccurrence(r.days, r.time); emit(); } }
  function removeRecurring(id) { state.recurring = (state.recurring || []).filter(x => x.id !== id); emit(); }
  function runRecurring(id) {
    const r = (state.recurring || []).find(x => x.id === id);
    if (!r) return null;
    const at = r.nextAt || nextOccurrence(r.days, r.time);
    const when = new Date(at - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const res = createOrder(Object.assign(JSON.parse(JSON.stringify(r.template)), { when: 'later', whenAt: when, recurringId: r.id }));
    r.nextAt = nextOccurrence(r.days, r.time, at);
    if (!res.ok) { r.lastError = res.errors.map(e => e.code).join(','); emit(); return null; }
    r.lastError = '';
    r.created.unshift(res.order.id);
    emit();
    return res.order;
  }
  const myRecurring = () => (state.recurring || []).filter(r => r.owner === state.session);

  // --- comptes entreprises ---
  function setBusiness(info) { const u = user(); if (!u) return; u.business = Object.assign({ createdAt: Date.now(), members: [], invoice: true }, u.business, info); emit(); }
  function addMember(phone) { const u = user(); if (!u || !u.business) return; if (!u.business.members.includes(phone)) u.business.members.push(phone); emit(); }
  function removeMember(phone) { const u = user(); if (!u || !u.business) return; u.business.members = u.business.members.filter(p => p !== phone); emit(); }

  // --- parrainage chauffeur ---
  const REF_TRIPS = 10;
  const driverCode = d => `${(d.firstName || '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}-${String(d.phone).slice(-4)}`;
  function findDriverByCode(code) { return Object.values(state.driverAccounts).find(d => driverCode(d) === String(code).trim().toUpperCase()) || null; }
  function referrals(d) { return Object.values(state.driverAccounts).filter(x => x.referredBy === d.phone); }

  function cancelInfo(o) {
    if (o.status === 'open') return { free: true };
    if (o.status === 'assigned' && Date.now() - o.timeline.assigned < FREE_CANCEL_MS) return { free: true };
    return { free: false };
  }

  function cancelOrder(orderId) {
    const o = getOrder(orderId);
    if (!o || ['delivered', 'cancelled', 'arrived'].includes(o.status)) return;
    o.cancelFree = cancelInfo(o).free;
    track('cancelled', o, { stage: o.status, by: o.cancelledBy || (o.owner === 'me' ? 'client' : 'other'), free: o.cancelFree, driver: o.driver && who(o.driver) });
    o.status = 'cancelled';
    o.timeline.cancelled = Date.now();
    if (drv() && drv().holds[o.id] != null) release(o.id);
    emit();
  }

  function rate(orderId, stars, tags, comment) {
    const o = getOrder(orderId);
    if (!o || o.rating != null) return;
    o.rating = stars;
    track('rated', o, { driver: o.driver && who(o.driver), stars, tags: tags || [] });
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
  }

  // Preuves photo du chauffeur (prises en direct) : nombre + miniatures.
  function addPhotos(orderId, which, images) {
    const o = getOrder(orderId);
    if (!o || (o.driver && o.driver.me && !activeDrv())) return;
    const list = Array.isArray(images) ? images : [];
    o.photos[which] += list.length || +images || 0;
    o.proofs = o.proofs || { start: [], end: [] };
    o.proofs[which] = o.proofs[which].concat(list).slice(0, 8);
    emit();
  }

  // Signalements : message, litige (lié à une course) ou urgence. Cycle : ouvert → en cours → résolu (avec décision).
  function addReport(r) {
    const rep = Object.assign({ id: 'RP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), at: Date.now(), status: 'open',
      type: r.urgent ? 'sos' : r.orderId ? 'dispute' : 'message' }, r);
    state.reports.unshift(rep);
    return rep;
  }
  function takeReport(id) { const r = state.reports.find(x => x.id === id); if (r && r.status === 'open') { r.status = 'progress'; r.takenAt = Date.now(); emit(); } }
  function report(orderId, text) {
    addReport({ orderId, text, phone: state.session });
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
          o.plannedOffers.filter(p => p.at <= now).slice(seen).forEach(p => track('offer', o, { driver: p.name, kind: p.kind, price: p.price, asked: o.price, reference: o.reference, delayMs: p.at - o.createdAt }));
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
            track('offer_rejected', o, { driver: drv() && drv().phone, price: mine.price, asked: o.price });
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
    }
    for (const r of state.recurring || []) {
      if (r.active && r.nextAt && now >= r.nextAt - PUBLISH_BEFORE_MS && r.owner === state.session) { runRecurring(r.id); changed = true; events.push({ type: 'recurring', r }); }
    }
    for (const trip of state.trips || []) {
      for (const b of trip.bookings) {
        if (b.status === 'proposed' && b.answerAt && now >= b.answerAt) {
          delete b.answerAt;
          answerProposal(trip.id, b.id, b.unitPrice >= trip.pricePerUnit * 0.85);
          events.push({ type: 'proposal', trip, booking: b });
          changed = true;
        }
      }
    }
    const me = drv();
    if (me && me.online && me.status === 'approved' && !me.suspended && now - lastSpawn > 25000) {
      const waiting = state.orders.filter(o => o.status === 'open' && o.vehicle === me.vehicle && !(me.declined && me.declined[o.id])).length;
      if (waiting < 3) { const o = spawnRequest(me.vehicle); events.push({ type: 'request', order: o }); changed = true; }
      lastSpawn = now;
    }
    for (const d of Object.values(state.driverAccounts)) {
      if (d.status === 'pending' && now - d.submittedAt >= DEMO_REVIEW_MS && !d.demoReviewed) {
        // Démo : l'équipe « vérifie » les documents fournis et valides ; un dossier incomplet reste en attente.
        d.demoReviewed = true; changed = true;
        d.docReview = Object.assign({}, d.docReview);
        REQUIRED_DOCS.forEach(k => { if (docState(d, k) === 'provided') d.docReview[k] = { status: 'verified', at: now, demo: true }; });
        if (!docsBlocking(d).length) { d.status = 'approved'; d.reviewedAt = now; if (d.phone === state.driverSession) events.push({ type: 'approved' }); }
      }
      if (d.suspended && d.online) { d.online = false; changed = true; }
      if (d.status === 'approved' && d.docsSubmittedAt && now - d.docsSubmittedAt >= DEMO_REVIEW_MS) {
        delete d.docsSubmittedAt; changed = true;
        d.docReview = Object.assign({}, d.docReview);
        REQUIRED_DOCS.forEach(k => { if (docState(d, k) === 'provided') d.docReview[k] = { status: 'verified', at: now, demo: true }; });
      }
    }
    if (changed) emit();
    return events;
  }

  function reset() {
    const { lang, accounts, session, driverAccounts, driverSession, admin } = state;
    state = defaultState();
    // Les comptes restent ; soldes et gains des chauffeurs repartent de zéro.
    Object.values(driverAccounts).forEach(d => Object.assign(d, { online: false, balance: 0, holds: {}, ledger: [], digitalEarnings: 0, earnings: [], trips: 0, ratingSum: 0, ratingCount: 0 }));
    Object.assign(state, { lang, accounts, session, driverAccounts, driverSession, admin });
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
    if (on) {
      if (d.online) {
        d.online = false;
        const ss = d.sessions || [];
        if (ss.length && !ss[ss.length - 1].to) ss[ss.length - 1].to = Date.now();
      }
      // Ses offres en attente sont retirées et les commissions réservées libérées.
      for (const o of state.orders) {
        if (o.status !== 'open') continue;
        const of = o.offers.find(x => x.driverPhone === phone && !x.declined);
        if (of) { of.declined = true; if (d.holds[o.id] != null) { const amount = d.holds[o.id]; delete d.holds[o.id]; d.ledger.unshift({ at: Date.now(), type: 'release', amount, orderId: o.id }); } }
      }
      track('suspended', null, { driver: phone });
    }
    emit();
  }
  // Décision du support : valider la livraison, annuler la course, rembourser le client, ou classer sans suite.
  function resolveReport(id, outcome, note) {
    const r = state.reports.find(x => x.id === id);
    if (!r || r.status === 'resolved') return;
    const o = r.orderId && !r.trip && getOrder(r.orderId);
    Object.assign(r, { status: 'resolved', resolved: true, resolvedAt: Date.now(), outcome: outcome || 'closed', note: note || '' });
    if (o) {
      if (outcome === 'validate' && o.status === 'arrived') confirmDelivery(o.id, 'support');
      if (outcome === 'cancel' && !['delivered', 'cancelled'].includes(o.status)) { o.cancelledBy = 'support'; cancelOrder(o.id); }
      if (!state.reports.some(x => x.orderId === o.id && x.status !== 'resolved')) o.disputed = false;
    }
    track('report_resolved', o || null, { outcome: r.outcome, type: r.type, ms: r.resolvedAt - r.at });
    emit();
  }
  function adminCancel(orderId) {
    const o = getOrder(orderId);
    if (!o) return;
    o.cancelledBy = 'support';
    cancelOrder(orderId);
  }

  // Refus d'une demande par le chauffeur, avec son motif (données pour les analyses).
  function driverDecline(orderId, reason) {
    const o = getOrder(orderId), d = drv();
    if (!o || !d) return;
    d.declined = Object.assign({}, d.declined, { [orderId]: Date.now() });
    track('declined', o, { driver: d.phone, reason, price: o.price });
    emit();
  }

  // En ligne / hors ligne : on garde les sessions pour le temps en ligne.
  function setOnline(on) {
    const d = drv();
    if (!d) return { ok: false };
    if (on && blockReason(d)) return { ok: false, reason: blockReason(d) };
    if (!!d.online === on) return { ok: true };
    d.online = on;
    d.sessions = d.sessions || [];
    if (on) d.sessions.push({ from: Date.now() });
    else if (d.sessions.length && !d.sessions[d.sessions.length - 1].to) d.sessions[d.sessions.length - 1].to = Date.now();
    track(on ? 'online' : 'offline', null, { driver: d.phone });
    emit();
    return { ok: true };
  }
  function onlineMsSince(d, since) {
    return (d.sessions || []).reduce((a, x) => a + Math.max(0, (x.to || Date.now()) - Math.max(x.from, since)), 0);
  }

  // Données de démonstration pour l'onglet Analyses (30 jours simulés, marqués demo).
  function seedAnalytics() {
    const r = rng('analytics' + Date.now());
    const pick = arr => arr[Math.floor(r() * arr.length)];
    const weights = { yopougon: 9, abobo: 7, cocody: 8, adjame: 8, marcory: 5, koumassi: 5, plateau: 6, treichville: 4, portbouet: 3, attecoube: 2, bingerville: 2, anyama: 1, songon: 1 };
    const pool = Object.entries(weights).flatMap(([c, w]) => Array(w).fill(c));
    const hourW = [0, 0, 0, 0, 0, 1, 3, 6, 9, 8, 7, 6, 5, 5, 6, 7, 8, 9, 7, 4, 2, 1, 0, 0];
    const hours = hourW.flatMap((w, h) => Array(w).fill(h));
    const vehicles = ['tricycle', 'tricycle', 'van1t', 'van1t', 'van1t', 'van1t', 'truck3t', 'truck3t', 'truck10t'];
    const reasons = ['far', 'far', 'far', 'low', 'low', 'low', 'low', 'vehicle', 'heavy', 'other'];
    const drivers = DRIVER_POOL.map(d => d.name);
    const out = [];
    for (let i = 0; i < 420; i++) {
      const day = Math.floor(r() * 30), h = pick(hours);
      const at = Date.now() - day * 864e5 - (new Date().getHours() - h) * 36e5 - Math.floor(r() * 36e5);
      const from = pick(pool); let to = pick(pool); if (to === from && r() < .6) to = pick(pool);
      const vehicle = pick(vehicles), km = distanceKm(from, to);
      const ref = quote(vehicle, km, null).reference;
      const asked = TK.roundUp100(ref * (0.9 + r() * 0.2));
      const base = { orderId: 'DEMO-' + i, from, to, vehicle, need: pick(['moving', 'goods', 'goods', 'parcel']), km, demo: true };
      out.push(Object.assign({ at, type: 'created', price: asked, reference: ref, service: r() < .4 ? 'handling' : 'transport', passengers: Math.floor(r() * 3) }, base));
      const nDecl = Math.floor(r() * 3);
      for (let k = 0; k < nDecl; k++) out.push(Object.assign({ at: at + 30000 * (k + 1), type: 'declined', driver: pick(drivers), reason: pick(reasons), price: asked }, base));
      if (r() < .12) { out.push(Object.assign({ at: at + 120000, type: 'cancelled', stage: 'open', by: 'client', free: true }, base)); continue; }
      const dName = pick(drivers), counter = r() < .55, price = counter ? TK.roundUp100(asked * (1.05 + r() * .15)) : asked;
      const delay = 20000 + Math.floor(r() * 240000);
      out.push(Object.assign({ at: at + delay - 5000, type: 'offer', driver: dName, kind: counter ? 'counter' : 'accept', price, asked, reference: ref, delayMs: delay - 5000 }, base));
      out.push(Object.assign({ at: at + delay, type: 'assigned', driver: dName, kind: counter ? 'counter' : 'accept', price, asked, reference: ref, delayMs: delay }, base));
      if (r() < .06) { out.push(Object.assign({ at: at + delay + 300000, type: 'cancelled', stage: 'assigned', by: r() < .5 ? 'client' : 'driver', driver: dName }, base)); continue; }
      out.push(Object.assign({ at: at + delay + 2700000, type: 'delivered', driver: dName, price, by: r() < .7 ? 'client' : 'auto', durationMs: 2400000 + Math.floor(r() * 3e6) }, base));
      if (r() < .7) out.push(Object.assign({ at: at + delay + 2800000, type: 'rated', driver: dName, stars: r() < .8 ? 5 : r() < .6 ? 4 : 3, tags: [] }, base));
    }
    state.events = state.events.filter(e => !e.demo).concat(out).sort((a, b) => b.at - a.at).slice(0, MAX_EVENTS);
    emit();
  }
  function clearDemoAnalytics() { state.events = state.events.filter(e => !e.demo); emit(); }


  // --- Vivriers vers Abidjan : trajets retour des chauffeurs, réservation au sac ---
  // Axe Bouaké → Abidjan. Distances approximatives, à confirmer sur le terrain.
  const CORRIDOR = {
    id: 'bouake', stops: [
      { id: 'bouake', name: 'Bouaké · gare routière', km: 0 },
      { id: 'tiebissou', name: 'Tiébissou', km: 55 },
      { id: 'yamoussoukro', name: 'Yamoussoukro · péage', km: 105 },
      { id: 'toumodi', name: 'Toumodi · carrefour', km: 150 },
      { id: 'singrobo', name: 'Péage de Singrobo', km: 200 },
      { id: 'ndouci', name: 'N’Douci', km: 250 },
      { id: 'gesco', name: 'Gesco · Yopougon (entrée d’Abidjan)', km: 335 }
    ]
  };
  const SPEED_KMH = 60, STOP_MIN = 10, DEPOSIT_RATE = 0.2, FREE_CANCEL_H = 6;
  const TRIP_STEPS = ['scheduled', 'departed', 'arrived', 'done'];
  const stopOf = id => CORRIDOR.stops.find(x => x.id === id);

  // Heure de passage à un arrêt : départ + temps de route + 10 min par arrêt desservi avant.
  function stopTime(trip, stopId) {
    const a = stopOf(trip.from), b = stopOf(stopId);
    const served = trip.stops.filter(id => stopOf(id).km > a.km && stopOf(id).km < b.km).length;
    return trip.depart + (b.km - a.km) / SPEED_KMH * 36e5 + served * STOP_MIN * 60000;
  }
  const arrivalTime = trip => stopTime(trip, 'gesco');
  // Capacité d'un trajet en kg : « places » = sacs de 50 kg, plafonnées par la charge utile réelle du véhicule.
  const UNIT_KG = { sac: 50, carton: 20, cageot: 25 };
  const TRIP_VEHICLES = ['van1t', 'truck3t', 'truck10t'];
  const payloadOf = v => (TK.vehicles && TK.vehicles.SPECS[v] ? TK.vehicles.SPECS[v].payloadKg : 0);
  const tripMaxKg = trip => Math.min(trip.capacity * UNIT_KG.sac, payloadOf(trip.vehicle) || Infinity);
  function tripLoad(trip) {
    const live = trip.bookings.filter(b => !['cancelled', 'refused'].includes(b.status));
    const kg = live.reduce((a, b) => a + b.units * (UNIT_KG[b.unitKind] || UNIT_KG.sac), 0);
    return { units: live.reduce((a, b) => a + b.units, 0), seats: live.reduce((a, b) => a + b.seats, 0), kg, maxKg: tripMaxKg(trip), freeKg: Math.max(0, tripMaxKg(trip) - kg) };
  }
  // Nombre d'unités d'un type encore possibles sur ce trajet.
  const tripRoom = (trip, kind) => Math.floor(tripLoad(trip).freeKg / (UNIT_KG[kind] || UNIT_KG.sac));
  const TRIP_MAX_DAYS = 7;
  function validateTrip(trip, d) {
    const errors = [];
    if (!TRIP_VEHICLES.includes(d.vehicle)) errors.push({ code: 'tripVehicle' });
    if (!(trip.depart > Date.now()) || trip.depart > Date.now() + TRIP_MAX_DAYS * 864e5) errors.push({ code: 'tripDate', days: TRIP_MAX_DAYS });
    const maxPlaces = Math.floor(payloadOf(d.vehicle) / UNIT_KG.sac);
    if (!(trip.capacity >= 1) || trip.capacity > maxPlaces) errors.push({ code: 'tripCap', max: maxPlaces, kg: payloadOf(d.vehicle) });
    const maxSeats = (TK.VEH_RULES[d.vehicle] || {}).maxPassengers ?? 2;
    if (trip.seats > maxSeats) errors.push({ code: 'passengers', n: trip.seats, max: maxSeats });
    if (!(trip.pricePerUnit > 0)) errors.push({ code: 'tripPrice' });
    return errors;
  }
  // Les trajets de démonstration couvrent toujours cette nuit et demain soir, même le lendemain.
  function ensureTrips() {
    const n = new Date(); n.setHours(0, 0, 0, 0);
    if (new Date().getHours() < 6) n.setDate(n.getDate() - 1);
    if (!state.trips || state.tripsNight !== n.toDateString()) seedTrips();
  }
  function tripsState() { ensureTrips(); return state.trips; }

  function seedTrips() {
    // Nuits de départ : « cette nuit » commence à 18 h (la veille avant 6 h du matin), « demain soir » la nuit suivante.
    const night0 = new Date(); night0.setHours(0, 0, 0, 0);
    if (new Date().getHours() < 6) night0.setDate(night0.getDate() - 1);
    const r = rng('trips' + night0.toDateString());
    const day0 = night0;
    const plan = [[21, 30, 'truck10t', 60, 2, 1500, 2000], [22, 15, 'truck3t', 35, 1, 1800, 2500], [23, 0, 'truck10t', 80, 2, 1200, 2000], [0, 20, 'truck3t', 30, 2, 2000, 2500]];
    const trips = [];
    [0, 1].forEach(dd => plan.forEach(([h, m, veh, cap, seats, pu, ps], i) => {
      const d = new Date(day0.getTime() + (dd + (h < 12 ? 1 : 0)) * 864e5); d.setHours(h, m, 0, 0);
      const drv = DRIVER_POOL[(i + dd * 3) % DRIVER_POOL.length];
      const t = {
        id: `TR-${d.getMonth() + 1}${String(d.getDate()).padStart(2, '0')}-${dd}${i}`, sim: true, driver: drv.name, driverName: drv.name, rating: drv.rating, plate: plateFor(r), vehicle: veh,
        from: 'bouake', depart: d.getTime(), stops: ['tiebissou', 'yamoussoukro', 'toumodi', 'singrobo', 'ndouci'].filter(() => r() > .2),
        capacity: cap, seats, pricePerUnit: pu, pricePerSeat: ps, bookings: [], status: 'scheduled', createdAt: Date.now()
      };
      if (!t.stops.includes('yamoussoukro')) t.stops.push('yamoussoukro');
      t.stops.sort((x, y) => stopOf(x).km - stopOf(y).km);
      // quelques places déjà réservées par d'autres commerçantes
      const taken = Math.floor(cap * (0.2 + r() * 0.5));
      t.bookings.push({ id: t.id + '-x', client: 'Autres commerçantes', stop: t.stops[0], units: taken, seats: Math.min(seats - 1, Math.floor(r() * 2)), status: 'booked', other: true });
      if (d.getTime() > Date.now()) trips.push(t);
    }));
    // On garde les trajets simulés déjà réservés et on complète les nuits manquantes.
    const keep = (state.trips || []).filter(t => (!t.sim && t.depart > Date.now() - 864e5) || (t.sim && t.bookings.some(b => !b.other) && t.depart > Date.now() - 864e5));
    state.trips = keep.concat(trips.filter(t => !keep.some(k => k.id === t.id)));
    state.tripsNight = night0.toDateString();
  }

  function publishTrip(trip) {
    const d = activeDrv();
    if (!d) return { ok: false, errors: [{ code: blockReason(drv()) }] };
    const errors = validateTrip(trip, d);
    if (errors.length) return { ok: false, errors };
    const t = Object.assign({ id: 'TR-' + Date.now().toString(36).toUpperCase(), driver: d.phone, driverName: `${d.firstName} ${d.lastName}`, rating: driverRating(d),
      plate: d.plate, vehicle: d.vehicle, from: 'bouake', bookings: [], status: 'scheduled', createdAt: Date.now() }, trip);
    tripsState().unshift(t);
    track('trip_published', null, { tripId: t.id, driver: d.phone, capacity: t.capacity, seats: t.seats, price: t.pricePerUnit, depart: t.depart });
    emit();
    return { ok: true, trip: t };
  }

  // Commission sur la marchandise seulement : les places passagers reviennent entièrement au chauffeur.
  function quoteBooking(trip, units, seats, unitPrice = trip.pricePerUnit) {
    const goods = units * unitPrice, people = seats * trip.pricePerSeat, total = goods + people;
    return { unitPrice, total, deposit: Math.max(500, roundUp100(total * DEPOSIT_RATE)), fee: Math.round(goods * TK.COMMISSION_RATE) };
  }

  function bookTrip(tripId, req) {
    const trip = tripsState().find(x => x.id === tripId);
    if (!trip || trip.status !== 'scheduled') return { ok: false };
    const load = tripLoad(trip);
    const kg = req.units * (UNIT_KG[req.unitKind] || UNIT_KG.sac);
    if (!(req.units >= 1) || kg > load.freeKg || load.seats + req.seats > trip.seats) return { ok: false, full: true };
    // Prix proposé par la commerçante : la place est retenue en attendant la réponse du chauffeur.
    const proposed = req.unitPrice && req.unitPrice !== trip.pricePerUnit;
    const q = quoteBooking(trip, req.units, req.seats, req.unitPrice || trip.pricePerUnit);
    const u = user();
    const b = Object.assign({ id: trip.id + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), client: u ? `${u.firstName} ${u.lastName}` : '', phone: state.session,
      channel: 'app', at: Date.now() }, req, q, { status: req.status || (proposed ? 'proposed' : 'booked') });
    if (b.status === 'proposed' && trip.sim) b.answerAt = Date.now() + 4000;
    trip.bookings.push(b);
    track(proposed ? 'trip_proposed' : 'trip_booked', null, { tripId, stop: req.stop, units: req.units, seats: req.seats, price: q.total, unitPrice: q.unitPrice, asked: trip.pricePerUnit, lastMile: !!req.lastMile, driver: trip.driver, channel: b.channel });
    emit();
    return { ok: true, booking: b };
  }

  const findBooking = (tripId, bookingId) => { const trip = tripsState().find(x => x.id === tripId); return [trip, trip && trip.bookings.find(x => x.id === bookingId)]; };

  // Réponse du chauffeur à un prix proposé.
  function answerProposal(tripId, bookingId, accept) {
    const [trip, b] = findBooking(tripId, bookingId);
    if (trip && !trip.sim && !(activeDrv() && activeDrv().phone === trip.driver)) return;
    if (!b || b.status !== 'proposed') return;
    b.status = accept ? 'accepted' : 'refused';
    b.answeredAt = Date.now();
    track(accept ? 'trip_proposal_accepted' : 'trip_proposal_refused', null, { tripId, unitPrice: b.unitPrice, asked: trip.pricePerUnit, driver: trip.driver });
    emit();
  }

  // Acompte payé après acceptation du prix proposé.
  function payDeposit(tripId, bookingId, payment) {
    const [trip, b] = findBooking(tripId, bookingId);
    if (!b || b.status !== 'accepted' || trip.status !== 'scheduled') return;
    Object.assign(b, { status: 'booked', payment, paidAt: Date.now() });
    track('trip_booked', null, { tripId, stop: b.stop, units: b.units, seats: b.seats, price: b.total, unitPrice: b.unitPrice, driver: trip.driver, channel: b.channel });
    emit();
  }

  // Bouton d'urgence : alerte prioritaire pour le support Takaata.
  function sosAlert(tripId, bookingId) {
    const [trip, b] = findBooking(tripId, bookingId);
    if (!b) return;
    addReport({ orderId: tripId, trip: true, text: `URGENCE · ${b.client || ''} · ${b.phone ? '+225 ' + b.phone : ''} · trajet ${trip.driverName} (${trip.plate})`, phone: b.phone, urgent: true });
    track('sos', null, { tripId, driver: trip.driver });
    emit();
  }

  // Urgence pendant une course (chauffeur ou client) : alerte prioritaire au support, avec la position si disponible.
  function orderSos(orderId, by, pos) {
    const o = getOrder(orderId);
    if (!o) return;
    const where = pos ? ` · position https://maps.google.com/?q=${pos.lat},${pos.lon}` : '';
    const dv = o.driver ? ` · ${o.driver.name} (${o.driver.plate})` : '';
    addReport({ orderId: o.id, text: `URGENCE ${by === 'driver' ? 'chauffeur' : 'client'} · ${TK.commune(o.from).name} → ${TK.commune(o.to).name}${dv}${where}`,
      phone: by === 'driver' ? (drv() && drv().phone) : o.clientPhone, urgent: true });
    track('sos', o, { by });
    emit();
  }

  function setSetting(key, value) { state.settings = Object.assign({ whatsapp: '' }, state.settings, { [key]: value }); emit(); }

  function cancelBooking(tripId, bookingId) {
    const trip = tripsState().find(x => x.id === tripId);
    const b = trip && trip.bookings.find(x => x.id === bookingId);
    if (!b || !['booked', 'proposed', 'accepted'].includes(b.status) || trip.status !== 'scheduled') return;
    const paid = b.status === 'booked';
    b.status = 'cancelled';
    b.refund = !paid || trip.depart - Date.now() > FREE_CANCEL_H * 36e5;
    track('trip_cancelled', null, { tripId, units: b.units, refund: b.refund, hoursBefore: (trip.depart - Date.now()) / 36e5 });
    emit();
  }

  // Avancement du trajet (le chauffeur le fait ; bouton démo côté client).
  function advanceTrip(tripId) {
    const trip = tripsState().find(x => x.id === tripId);
    if (!trip) return;
    if (!trip.sim && !(activeDrv() && activeDrv().phone === trip.driver)) return;
    const i = TRIP_STEPS.indexOf(trip.status);
    if (i < 0 || i >= TRIP_STEPS.length - 1) return;
    trip.status = TRIP_STEPS[i + 1];
    trip[trip.status + 'At'] = Date.now();
    if (trip.status === 'departed') trip.bookings.filter(b => ['proposed', 'accepted'].includes(b.status)).forEach(b => { b.status = 'cancelled'; b.refund = true; });
    const live = trip.bookings.filter(b => !['cancelled', 'refused'].includes(b.status) && !b.other);
    if (trip.status === 'departed') live.forEach(b => { b.status = 'boarded'; });
    if (trip.status === 'arrived') {
      live.forEach(b => {
        b.status = 'arrived';
        // Suite automatique jusqu'au marché d'Adjamé : commande en ville créée pour la commerçante.
        if (b.lastMile && b.phone && !b.lastMileOrder) {
          const o = buildOrder({ need: 'goods', from: 'yopougon', to: 'adjame', fromDetail: 'Gesco', toDetail: 'Marché d’Adjamé', vehicle: b.units > 8 ? 'van1t' : 'tricycle',
            items: `${b.units} ${b.unitKind === 'sac' ? 'sacs de 50 kg' : b.unitKind === 'carton' ? 'cartons' : 'cageots'} (vivriers)`, weight: '', service: 'transport', helpers: 1,
            floorsFrom: 0, floorsTo: 0, elevator: false, passengers: b.seats, payment: b.payment || 'cash', when: 'now', packing: false, dismantle: false }, 'me');
          o.clientPhone = b.phone;
          state.orders.unshift(o);
          b.lastMileOrder = o.id;
          track('created', o, { price: o.price, reference: o.reference, service: 'transport', passengers: b.seats, fromTrip: tripId });
        }
      });
      track('trip_arrived', null, { tripId, onTime: (h => h < 5 || h >= 18)(new Date(arrivalTime(trip)).getHours()), units: tripLoad(trip).units, capacity: trip.capacity, driver: trip.driver });
    }
    if (trip.status === 'done') live.forEach(b => { b.status = 'completed'; });
    emit();
  }

  function myBookings() {
    return tripsState().flatMap(trip => trip.bookings.filter(b => b.phone && b.phone === state.session).map(b => ({ trip, b })));
  }

  // --- accès Admin ---
  function adminState() { return state.admin || (state.admin = { ownerHash: '', staff: [] }); }
  function setOwnerHash(hash) { adminState().ownerHash = hash; emit(); }
  function addStaff(member) { adminState().staff.push(Object.assign({ id: 'st' + Date.now().toString(36), createdAt: Date.now(), lastLogin: null }, member)); emit(); }
  function removeStaff(id) { const a = adminState(); a.staff = a.staff.filter(m => m.id !== id); emit(); }
  function touchStaff(id) { const m = adminState().staff.find(x => x.id === id); if (m) { m.lastLogin = Date.now(); emit(); } }

  // --- demandes entrantes simulées (pour la démonstration côté chauffeur) ---
  const SAMPLE_LOADS = {
    tricycle: [['parcel', '8 cartons de marchandises', '90 kg'], ['goods', '10 sacs d’oignons', '250 kg']],
    van1t: [['moving', 'Lit 2 places, 1 réfrigérateur, 6 cartons', '220 kg'], ['goods', '20 casiers de boissons', '300 kg'], ['moving', 'Canapé 3 places, table et 4 chaises', '150 kg']],
    truck3t: [['moving', 'Appartement 3 pièces', '1 200 kg'], ['goods', '60 sacs de riz de 25 kg', '1 500 kg']],
    truck10t: [['goods', 'Ciment : 150 sacs de 50 kg', '7 500 kg'], ['goods', 'Stock de grossiste, 12 palettes', '6 000 kg']]
  };
  const CLIENTS = ['Mariam K.', 'Boutique Nanan', 'Serge A.', 'Aïcha T.', 'Quincaillerie du Rail', 'Jean-Marc B.', 'Fatou D.', 'Maquis Chez Tantie'];
  let lastSpawn = 0;
  function spawnRequest(vehicleId) {
    const r = rng('spawn' + Date.now());
    const pick = arr => arr[Math.floor(r() * arr.length)];
    const from = pick(TK.COMMUNES).id; let to = pick(TK.COMMUNES).id; if (to === from) to = pick(TK.COMMUNES).id;
    const [need, items, weight] = pick(SAMPLE_LOADS[vehicleId]);
    const handling = need === 'moving';
    const o = buildOrder({ need, from, to, vehicle: vehicleId, items, weight, service: handling ? 'handling' : 'transport', helpers: 1, floorsFrom: handling ? Math.floor(r() * 3) : 0,
      floorsTo: 0, elevator: false, passengers: Math.floor(r() * 2), payment: pick(TK.PAYMENTS), client: pick(CLIENTS), fromDetail: '', toDetail: '', when: 'now', packing: false, dismantle: false }, 'other');
    o.weightKg = o.weightKg || Number(String(weight).replace(/[^0-9]/g, '')) || 0;
    o.spawned = true;
    state.orders.unshift(o);
    track('created', o, { price: o.price, reference: o.reference, service: o.service, passengers: o.passengers });
    return o;
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
  function driverLogout() { if (drv() && drv().online) setOnline(false); state.driverSession = null; emit(); }
  function reviewDriver(phone, ok, reason) {
    const d = state.driverAccounts[phone];
    if (!d) return { ok: false };
    // Validation seulement si chaque document obligatoire est fourni, vérifié et non expiré.
    if (ok && REQUIRED_DOCS.some(k => docState(d, k) !== 'verified')) return { ok: false, missing: REQUIRED_DOCS.filter(k => docState(d, k) !== 'verified') };
    d.status = ok ? 'approved' : 'rejected';
    d.reviewedAt = Date.now();
    d.rejectReason = ok ? '' : (reason || '');
    if (!ok && d.online) setOnlineFor(d, false);
    emit();
    return { ok: true };
  }
  function setOnlineFor(d, on) { d.online = on; const ss = d.sessions || []; if (!on && ss.length && !ss[ss.length - 1].to) ss[ss.length - 1].to = Date.now(); }
  function addLead(lead) { state.leads.push(Object.assign({ at: Date.now() }, lead)); emit(); }

  load();
  ensureTrips();
  applyPricing();

  window.TK = Object.assign(window.TK || {}, {
    store: {
      get state() { return state; },
      subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
      set, setDriver, addLead, createOrder, getOrder, visibleOffers, driverOffer, chooseOffer,
      advance, confirmDelivery, repropose, submitDeliveryCode, faceCheck, orderSos, rateClient, clientRatingOf,
      validateDraft, activeDrv, blockReason, docState, docsBlocking, reviewDoc, updateDoc, REQUIRED_DOCS, DOC_EXPIRY, takeReport,
      UNIT_KG, tripRoom, tripMaxKg, validateTrip, TRIP_VEHICLES, payloadOf,
      addRecurring, toggleRecurring, removeRecurring, runRecurring, myRecurring, nextOccurrence,
      setBusiness, addMember, removeMember, driverCode, findDriverByCode, referrals, REF_TRIPS, CODE_TRIES, END_PHOTOS_MIN, RECHARGE_MIN, cancelInfo, cancelOrder, rate, addPhotos, report, recharge, tick, reset,
      user, account, register, login, logout, updateUser,
      driverDecline, setOnline, onlineMsSince, seedAnalytics, clearDemoAnalytics,
      setPricing, resetPricing, suspendDriver, resolveReport, adminCancel, DEFAULT_PRICING,
      driver: drv, driverAccount, driverRegister, driverLogin, driverLogout, reviewDriver, driverRating,
      held, available, NEXT, canCall,
      adminState, setOwnerHash, addStaff, removeStaff, touchStaff, DRIVER_POOL,
      answerProposal, payDeposit, sosAlert, setSetting,
      CORRIDOR, stopOf, stopTime, arrivalTime, tripLoad, tripsState, publishTrip, quoteBooking, bookTrip, cancelBooking, advanceTrip, myBookings, seedTrips,
      DEPOSIT_RATE, FREE_CANCEL_H
    }
  });
})();
