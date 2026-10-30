// Données métier Takaata — grille et règles issues du business plan V3 (hypothèses du pilote).
(function () {
  const COMMISSION_RATE = 0.15;

  // Grille de référence : prix = max(plancher, base + km × tarif) + options.
  const VEHICLES = [
    { id: 'tricycle', base: 1000, perKm: 150, floor: 1500, load: '≈ 400 kg' },
    { id: 'van1t', base: 2500, perKm: 300, floor: 3500, load: '1 t' },
    { id: 'truck3t', base: 5000, perKm: 500, floor: 7000, load: '3 t' },
    { id: 'truck10t', base: 10000, perKm: 800, floor: 13000, load: '10 t' }
  ];

  // Options déclarées par le client (montants indicatifs, à tester pendant le pilote).
  const OPTIONS = {
    helper: 1000,      // par manutentionnaire
    floor: 200,        // par étage sans ascenseur (départ + arrivée)
    packing: 3000,     // emballage
    dismantle: 2500    // démontage / remontage
  };

  // Centres approximatifs des communes du Grand Abidjan.
  const COMMUNES = [
    { id: 'abobo', name: 'Abobo', lat: 5.418, lon: -4.020 },
    { id: 'adjame', name: 'Adjamé', lat: 5.367, lon: -4.023 },
    { id: 'anyama', name: 'Anyama', lat: 5.495, lon: -4.052 },
    { id: 'attecoube', name: 'Attécoubé', lat: 5.333, lon: -4.040 },
    { id: 'bingerville', name: 'Bingerville', lat: 5.355, lon: -3.885 },
    { id: 'cocody', name: 'Cocody', lat: 5.360, lon: -3.990 },
    { id: 'koumassi', name: 'Koumassi', lat: 5.297, lon: -3.948 },
    { id: 'marcory', name: 'Marcory', lat: 5.303, lon: -3.980 },
    { id: 'plateau', name: 'Plateau', lat: 5.323, lon: -4.020 },
    { id: 'portbouet', name: 'Port-Bouët', lat: 5.256, lon: -3.926 },
    { id: 'songon', name: 'Songon', lat: 5.315, lon: -4.255 },
    { id: 'treichville', name: 'Treichville', lat: 5.293, lon: -4.005 },
    { id: 'yopougon', name: 'Yopougon', lat: 5.345, lon: -4.080 }
  ];

  // 3 besoins : déménagement (meubles compris), marchandises (vivriers, commerce), colis.
  const NEEDS = ['moving', 'vivriers', 'goods', 'parcel'];  // + vivriers : axe Bouaké → Abidjan, réservation au sac
  const PAYMENTS = ['cash', 'orange', 'wave', 'mtn', 'djamo'];
  const STATUSES = ['open', 'assigned', 'pickup', 'loading', 'transit', 'arrived', 'delivered'];

  const ROAD_FACTOR = 1.35;   // vol d'oiseau → route
  const SAME_COMMUNE_KM = 4;

  function commune(id) { return COMMUNES.find(c => c.id === id); }
  function vehicle(id) { return VEHICLES.find(v => v.id === id); }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  function distanceKm(fromId, toId) {
    const a = commune(fromId), b = commune(toId);
    if (!a || !b) return 0;
    if (a.id === b.id) return SAME_COMMUNE_KM;
    return Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon) * ROAD_FACTOR * 10) / 10;
  }

  // Commune la plus proche d'une position GPS (null si hors du Grand Abidjan).
  function nearestCommune(lat, lon, maxKm = 15) {
    let best = null, bestKm = Infinity;
    for (const c of COMMUNES) {
      const d = haversineKm(lat, lon, c.lat, c.lon);
      if (d < bestKm) { best = c; bestKm = d; }
    }
    return bestKm <= maxKm ? best : null;
  }

  const roundUp100 = n => Math.ceil(n / 100) * 100;

  function optionsTotal(o) {
    if (!o) return 0;
    let total = 0;
    if (o.service === 'handling') {
      total += (o.helpers || 0) * OPTIONS.helper;
      if (!o.elevator) total += ((o.floorsFrom || 0) + (o.floorsTo || 0)) * OPTIONS.floor;
    }
    if (o.packing) total += OPTIONS.packing;
    if (o.dismantle) total += OPTIONS.dismantle;
    return total;
  }

  // Prix de référence suggéré et prix minimum accepté pour une course.
  function quote(vehicleId, km, opts) {
    const v = vehicle(vehicleId);
    const transport = roundUp100(Math.max(v.floor, v.base + km * v.perKm));
    const options = optionsTotal(opts);
    return {
      transport,
      options,
      reference: transport + options,
      minimum: v.floor + options
    };
  }

  // Chances qu'un chauffeur accepte le prix proposé. Modèle de règles en attendant les vraies données du pilote :
  // écart au prix conseillé, heure, distance, offre de véhicules et délai de réservation.
  const SUPPLY = { tricycle: 6, van1t: 0, truck3t: -6, truck10t: -10 };
  function acceptChance({ vehicle, km, price, reference, when, at }) {
    const ratio = price / reference;
    let pct = 100 / (1 + Math.exp(-(ratio - 0.88) * 12));
    const h = new Date(at || Date.now()).getHours();
    if (h >= 21 || h < 5) pct -= 12;
    else if ((h >= 7 && h < 9) || (h >= 17 && h < 19)) pct -= 5;
    if (ratio < 1 && km > 25) pct -= 8;
    if (km < 3) pct -= 4;
    pct += SUPPLY[vehicle] || 0;
    if (when === 'later') pct += 5;
    pct = Math.round(Math.max(3, Math.min(97, pct)));
    return { pct, level: pct < 30 ? 'low' : pct < 60 ? 'mid' : pct < 85 ? 'good' : 'high' };
  }
  // Plus petit prix qui donne une « bonne » chance (60 % et plus).
  function goodPrice(args) {
    for (let p = roundUp100(args.minimum); p <= args.reference * 1.6; p += 100) if (acceptChance(Object.assign({}, args, { price: p })).pct >= 60) return p;
    return roundUp100(args.reference * 1.2);
  }

  // ---------- Contrôle de capacité (le même contrôle est refait par le serveur à chaque modification) ----------
  // Dimensions moyennes des objets, en mètres (longueur, largeur, hauteur).
  const ITEM_DIMS = {
    box: [0.5, 0.4, 0.4], sack: [0.8, 0.5, 0.25], crate: [0.6, 0.4, 0.3], mattress: [1.9, 1.4, 0.25], bed: [2.0, 1.6, 0.3],
    fridge: [1.8, 0.7, 0.7], freezer: [1.2, 0.7, 0.9], washer: [0.85, 0.6, 0.6], sofa: [2.0, 0.9, 0.85], armchair: [0.9, 0.85, 0.85],
    tv: [1.3, 0.8, 0.15], wardrobe: [2.0, 1.8, 0.6], table: [1.6, 0.9, 0.75], chairs: [0.9, 0.5, 0.1], fan: [1.2, 0.4, 0.4],
    gas: [0.6, 0.35, 0.35], moto: [1.9, 1.1, 0.7], pallet: [1.2, 1.2, 0.8], cement: [0.6, 0.4, 0.12], rebar: [6.0, 0.05, 0.05], drinks: [0.4, 0.3, 0.3]
  };
  // Règles par véhicule (pilote, à confirmer avec les chauffeurs) : places en cabine, distance maximale,
  // hauteur utile d'une caisse ouverte (chargement dépassant des ridelles), taux de remplissage réaliste.
  const VEH_RULES = {
    tricycle: { maxPassengers: 1, maxKm: 25, openHeight: 1.0 },
    van1t: { maxPassengers: 2 },
    truck3t: { maxPassengers: 2 },
    truck10t: { maxPassengers: 2 }
  };
  const FILL_RATE = 0.8;

  function loadOf(d) {
    const W = (TK.vehicles && TK.vehicles.WEIGHTS) || {};
    const items = Object.entries(d.itemsQty || {}).filter(([, n]) => n > 0);
    const est = items.reduce((a, [k, n]) => a + (W[k] || 0) * n, 0);
    const kg = Number(d.weightManual) > 0 ? Number(d.weightManual) : est || Number(d.weightKg) || 0;
    const volume = items.reduce((a, [k, n]) => a + (ITEM_DIMS[k] ? ITEM_DIMS[k].reduce((x, y) => x * y, 1) : 0) * n, 0);
    return { kg, volume: Math.round(volume * 100) / 100, items };
  }
  // Vérifie qu'un chargement tient dans un véhicule : poids, volume, plus grand objet, passagers, distance.
  function checkLoad(d, vehicleId = d.vehicle, km = d.km) {
    const spec = TK.vehicles && TK.vehicles.SPECS[vehicleId];
    const rule = VEH_RULES[vehicleId] || {};
    if (!spec) return { ok: false, errors: [{ code: 'vehicle' }] };
    const { kg, volume, items } = loadOf(d);
    const h = spec.open ? rule.openHeight || spec.h : spec.h;
    const usable = Math.round(spec.l * spec.w * h * FILL_RATE * 100) / 100;
    const box = [spec.l, spec.w, h].sort((a, b) => b - a);
    const errors = [];
    if (kg > spec.payloadKg) errors.push({ code: 'weight', kg, max: spec.payloadKg });
    if (volume > usable) errors.push({ code: 'volume', vol: volume, max: usable });
    for (const [k] of items) {
      const dims = (ITEM_DIMS[k] || []).slice().sort((a, b) => b - a);
      const i = dims.findIndex((x, j) => x > box[j] + 1e-9);
      if (i >= 0) errors.push({ code: 'size', item: k, len: dims[i], max: box[i] });
    }
    if ((+d.passengers || 0) > (rule.maxPassengers ?? 2)) errors.push({ code: 'passengers', n: +d.passengers, max: rule.maxPassengers });
    if (rule.maxKm && km > rule.maxKm) errors.push({ code: 'distance', km, max: rule.maxKm });
    return { ok: !errors.length, errors, kg, volume, usable };
  }
  // Plus petit véhicule qui accepte ce chargement.
  function vehicleFor(d, km = d.km) { return VEHICLES.find(v => checkLoad(d, v.id, km).ok) || null; }

  // Commission prélevée sur la part transport seulement : les options (aides, étages) reviennent entièrement au chauffeur.
  const commission = (price, options = 0) => Math.round(Math.max(0, price - options) * COMMISSION_RATE);

  window.TK = Object.assign(window.TK || {}, {
    COMMISSION_RATE, VEHICLES, OPTIONS, COMMUNES, NEEDS, PAYMENTS, STATUSES,
    commune, vehicle, distanceKm, nearestCommune, quote, optionsTotal, commission, roundUp100, acceptChance, goodPrice, ITEM_DIMS, VEH_RULES, loadOf, checkLoad, vehicleFor
  });
})();
