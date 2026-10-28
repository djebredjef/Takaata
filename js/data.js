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
    helper: 2000,      // par manutentionnaire
    floor: 1000,       // par étage sans ascenseur (départ + arrivée)
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

  const NEEDS = ['moving', 'furniture', 'food', 'shop', 'parcel'];
  const PAYMENTS = ['cash', 'orange', 'wave', 'mtn'];
  const STATUSES = ['open', 'assigned', 'pickup', 'loading', 'transit', 'arrived', 'delivered'];

  const ROAD_FACTOR = 1.35;   // vol d'oiseau → route
  const SAME_COMMUNE_KM = 4;

  function commune(id) { return COMMUNES.find(c => c.id === id); }
  function vehicle(id) { return VEHICLES.find(v => v.id === id); }

  function distanceKm(fromId, toId) {
    const a = commune(fromId), b = commune(toId);
    if (!a || !b) return 0;
    if (a.id === b.id) return SAME_COMMUNE_KM;
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(h)) * ROAD_FACTOR;
    return Math.round(km * 10) / 10;
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

  const commission = price => Math.round(price * COMMISSION_RATE);

  window.TK = Object.assign(window.TK || {}, {
    COMMISSION_RATE, VEHICLES, OPTIONS, COMMUNES, NEEDS, PAYMENTS, STATUSES,
    commune, vehicle, distanceKm, quote, optionsTotal, commission, roundUp100
  });
})();
