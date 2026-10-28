// Présentation des véhicules : illustration de la caisse chargée, dimensions,
// et panneau « Que peut-on charger ? ». Capacités indicatives, à valider avec les chauffeurs.
(function () {
  const { t, VEHICLES } = TK;

  // Caisse en mètres (l = longueur, w = largeur, h = hauteur ; ridelles pour le tricycle).
  const SPECS = {
    tricycle: {
      l: 1.6, w: 1.2, h: 0.4, payload: '400 kg', open: true,
      items: [['box', '≤ 10'], ['sack', '≤ 12'], ['crate', '≤ 8'], ['drinks', '≤ 10'], ['gas', '≤ 6'], ['tv', '≤ 55"'], ['fan', ''], ['chairs', '≤ 20'], ['washer', '1']],
      scene: [
        { k: 'box', x: 0.03, w: 0.26, row: 'b' }, { k: 'box', x: 0.03, w: 0.26, stack: 1, row: 'b' },
        { k: 'crate', x: 0.6, w: 0.3, row: 'b' }, { k: 'crate', x: 0.6, w: 0.3, stack: 1, row: 'b' },
        { k: 'sack', x: 0.34, w: 0.17, row: 'f' }, { k: 'sack', x: 0.52, w: 0.17, row: 'f' },
        { k: 'gas', x: 0.18, w: 0.1, row: 'f' }, { k: 'drinks', x: 0.74, w: 0.2, row: 'f' }
      ]
    },
    van1t: {
      l: 2.6, w: 1.6, h: 1.5, payload: '1 t', cab: 'van',
      items: [['mattress', '≤ 160 cm'], ['bed', '≤ 160 cm'], ['fridge', '≤ 350 L'], ['washer', ''], ['sofa', '2 pl.'], ['tv', ''], ['box', '≤ 25'], ['sack', '≤ 40'], ['moto', '1']],
      scene: [
        { k: 'mattress', x: 0.06, w: 0.4, row: 'b' }, { k: 'fridge', x: 0.72, w: 0.28, row: 'b' },
        { k: 'box', x: 0.0, w: 0.18, row: 'f' }, { k: 'box', x: 0.0, w: 0.18, stack: 1, row: 'f' },
        { k: 'tv', x: 0.0, w: 0.18, y: 0.52, row: 'f' },
        { k: 'sofa', x: 0.2, w: 0.38, row: 'f' }, { k: 'washer', x: 0.6, w: 0.19, row: 'f' }
      ]
    },
    truck3t: {
      l: 4.2, w: 2.0, h: 2.0, payload: '3 t', cab: 'truck',
      items: [['wardrobe', '3 portes'], ['bed', '≤ 180 cm × 2'], ['mattress', '× 2'], ['sofa', '3 pl. + 2'], ['fridge', ''], ['freezer', ''], ['washer', ''], ['table', '+ 6'], ['box', '≤ 60'], ['sack', '≤ 120'], ['moto', '≤ 3']],
      scene: [
        { k: 'wardrobe', x: 0.02, w: 0.22, row: 'b' }, { k: 'mattress', x: 0.26, w: 0.26, row: 'b' },
        { k: 'fridge', x: 0.55, w: 0.15, row: 'b' },
        { k: 'box', x: 0.74, w: 0.13, row: 'b' }, { k: 'box', x: 0.74, w: 0.13, stack: 1, row: 'b' }, { k: 'box', x: 0.74, w: 0.13, stack: 2, row: 'b' },
        { k: 'sofa', x: 0.0, w: 0.3, row: 'f' }, { k: 'washer', x: 0.32, w: 0.12, row: 'f' },
        { k: 'table', x: 0.46, w: 0.2, row: 'f' }, { k: 'chairs', x: 0.68, w: 0.1, row: 'f' },
        { k: 'armchair', x: 0.81, w: 0.14, row: 'f' }
      ]
    },
    truck10t: {
      l: 6.8, w: 2.4, h: 2.4, payload: '10 t', cab: 'truck', axles: 2,
      items: [['sack', '≤ 400'], ['cement', '≤ 200'], ['rebar', '≤ 6 m'], ['pallet', '≤ 12'], ['drinks', '≤ 300'], ['crate', '≤ 300'], ['wardrobe', ''], ['sofa', ''], ['fridge', ''], ['moto', '≤ 8']],
      scene: [
        { k: 'cement', x: 0.02, w: 0.18, row: 'b' }, { k: 'cement', x: 0.02, w: 0.18, stack: 1, row: 'b' },
        { k: 'sack', x: 0.22, w: 0.09, row: 'b' }, { k: 'sack', x: 0.31, w: 0.09, row: 'b' }, { k: 'sack', x: 0.265, w: 0.09, stack: 1, row: 'b' },
        { k: 'drinks', x: 0.43, w: 0.12, row: 'b' }, { k: 'drinks', x: 0.43, w: 0.12, stack: 1, row: 'b' },
        { k: 'wardrobe', x: 0.58, w: 0.18, row: 'b' }, { k: 'fridge', x: 0.78, w: 0.09, row: 'b' },
        { k: 'pallet', x: 0.02, w: 0.36, row: 'f' }, { k: 'rebar', x: 0.02, w: 0.36, y: 0.26, row: 'f' },
        { k: 'crate', x: 0.41, w: 0.1, row: 'f' }, { k: 'crate', x: 0.41, w: 0.1, stack: 1, row: 'f' },
        { k: 'sofa', x: 0.54, w: 0.2, row: 'f' }, { k: 'moto', x: 0.77, w: 0.19, row: 'f' }
      ]
    }
  };

  // Icônes d'objets : [largeur, hauteur] du viewBox + dessin. Couleurs fixes, lisibles sur les deux thèmes.
  const ICONS = {
    box: [48, 40, '<rect x="1" y="3" width="46" height="36" rx="2" fill="#D9A066" stroke="#A9733F"/><rect x="1" y="3" width="46" height="9" fill="#C48A52"/><rect x="20" y="3" width="8" height="15" fill="#EBD3A8"/><path d="M6 30h12" stroke="#A9733F" stroke-width="2"/>'],
    sack: [36, 48, '<path d="M5 12Q2 30 5 47h26q3-17 0-35z" fill="#EDE6D3" stroke="#BDB298"/><path d="M8 12q10-10 20 0z" fill="#D9CFB5"/><rect x="4" y="25" width="28" height="9" fill="#4E8C5B"/><rect x="11" y="28" width="14" height="3" fill="#EDE6D3"/>'],
    crate: [48, 38, '<ellipse cx="14" cy="11" rx="10" ry="5" fill="#8DB255"/><ellipse cx="32" cy="10" rx="11" ry="6" fill="#7FA846"/><circle cx="24" cy="13" r="5" fill="#E2533D"/><rect x="1" y="12" width="46" height="25" rx="2" fill="#C98B4E" stroke="#9A6430"/><path d="M1 20h46M1 28h46" stroke="#9A6430" stroke-width="2"/>'],
    mattress: [36, 48, '<rect x="2" y="1" width="32" height="46" rx="5" fill="#F4F5F3" stroke="#B5C1C5" stroke-width="1.5"/><path d="M2 13l16-12 16 12M2 25l16-12 16 12M2 37l16-12 16 12M2 13l16 12 16-12M2 25l16 12 16-12" stroke="#CFD8DB" fill="none"/><rect x="2" y="40" width="32" height="7" rx="3" fill="#7FA9C9"/>'],
    bed: [56, 34, '<rect x="1" y="1" width="9" height="32" rx="2" fill="#B98858"/><rect x="1" y="17" width="54" height="8" fill="#C99A6B"/><rect x="47" y="12" width="8" height="21" rx="2" fill="#B98858"/><rect x="12" y="25" width="3" height="8" fill="#8E6440"/><rect x="40" y="25" width="3" height="8" fill="#8E6440"/><rect x="10" y="12" width="37" height="5" rx="2" fill="#F1E6D6"/>'],
    fridge: [26, 48, '<rect x="1" y="1" width="24" height="46" rx="3" fill="#C9D1D4" stroke="#8F9DA3"/><rect x="18" y="1" width="7" height="46" rx="2" fill="#AEB9BD"/><path d="M1 17h24" stroke="#8F9DA3" stroke-width="1.5"/><rect x="4" y="7" width="2" height="7" rx="1" fill="#6F7E84"/><rect x="4" y="21" width="2" height="10" rx="1" fill="#6F7E84"/>'],
    freezer: [48, 32, '<rect x="2" y="8" width="44" height="23" rx="3" fill="#EBEFF1" stroke="#A9B6BA"/><rect x="1" y="3" width="46" height="7" rx="2" fill="#D3DADD" stroke="#A9B6BA"/><rect x="20" y="10" width="8" height="2" rx="1" fill="#7E8E93"/>'],
    washer: [34, 40, '<rect x="1" y="1" width="32" height="38" rx="3" fill="#F2F4F5" stroke="#AEBABF"/><rect x="1" y="1" width="32" height="8" rx="2" fill="#DCE2E4"/><circle cx="26" cy="5" r="2" fill="#7E8E93"/><circle cx="17" cy="24" r="10" fill="#5B6B73"/><circle cx="17" cy="24" r="6.5" fill="#8FA9B4"/>'],
    sofa: [60, 30, '<rect x="5" y="2" width="50" height="16" rx="5" fill="#E8742B"/><rect x="2" y="13" width="56" height="11" rx="4" fill="#F28A45"/><rect x="0" y="8" width="9" height="17" rx="3" fill="#D2621C"/><rect x="51" y="8" width="9" height="17" rx="3" fill="#D2621C"/><rect x="5" y="24" width="3" height="5" fill="#6B4A33"/><rect x="52" y="24" width="3" height="5" fill="#6B4A33"/>'],
    armchair: [32, 30, '<rect x="5" y="2" width="22" height="16" rx="5" fill="#E8742B"/><rect x="2" y="13" width="28" height="11" rx="4" fill="#F28A45"/><rect x="0" y="8" width="7" height="17" rx="3" fill="#D2621C"/><rect x="25" y="8" width="7" height="17" rx="3" fill="#D2621C"/><rect x="5" y="24" width="3" height="5" fill="#6B4A33"/><rect x="24" y="24" width="3" height="5" fill="#6B4A33"/>'],
    tv: [48, 36, '<rect x="1" y="1" width="46" height="28" rx="2" fill="#26313A"/><rect x="3" y="3" width="42" height="24" fill="#4F6B78"/><path d="M5 22l12-10 8 7 6-5 12 9" fill="#6E8C99"/><rect x="21" y="29" width="6" height="3" fill="#26313A"/><rect x="13" y="32" width="22" height="3" rx="1" fill="#26313A"/>'],
    wardrobe: [32, 48, '<rect x="1" y="1" width="30" height="46" rx="2" fill="#B07A4C" stroke="#7F5430"/><path d="M11 3v42M21 3v42" stroke="#8E5E36" stroke-width="1.5"/><rect x="8" y="22" width="2" height="5" fill="#E9D4B4"/><rect x="18" y="22" width="2" height="5" fill="#E9D4B4"/><rect x="28" y="22" width="2" height="5" fill="#E9D4B4"/>'],
    table: [48, 30, '<rect x="0" y="6" width="48" height="5" rx="1" fill="#C99A6B"/><rect x="4" y="11" width="4" height="19" fill="#A97C52"/><rect x="40" y="11" width="4" height="19" fill="#A97C52"/><rect x="2" y="11" width="44" height="3" fill="#A97C52"/>'],
    chairs: [28, 44, '<rect x="5" y="1" width="18" height="15" rx="5" fill="#2F80C8"/><rect x="5" y="7" width="18" height="15" rx="5" fill="#2A72B3"/><rect x="2" y="21" width="24" height="6" rx="2" fill="#2F80C8"/><path d="M5 27l-2 16M23 27l2 16M7 27l1 14M21 27l-1 14" stroke="#2A72B3" stroke-width="2.5"/>'],
    fan: [28, 48, '<circle cx="14" cy="14" r="12.5" fill="#E6EBED" stroke="#9AA7AC"/><path d="M14 14l-6-9a10 10 0 0 1 12 0zM14 14l10 4a10 10 0 0 1-6 9zM14 14l-4 10a10 10 0 0 1-7-8z" fill="#B9C6CB"/><circle cx="14" cy="14" r="2.5" fill="#6F7E84"/><rect x="13" y="26" width="2" height="18" fill="#9AA7AC"/><ellipse cx="14" cy="45" rx="9" ry="2.5" fill="#6F7E84"/>'],
    gas: [24, 42, '<rect x="8" y="1" width="8" height="7" rx="1" fill="#C9CFD1"/><rect x="2" y="7" width="20" height="34" rx="8" fill="#2E7D5B"/><rect x="2" y="18" width="20" height="5" fill="#E6C23A"/>'],
    moto: [56, 36, '<circle cx="11" cy="27" r="8" fill="#26313A"/><circle cx="11" cy="27" r="3" fill="#9AA7AC"/><circle cx="45" cy="27" r="8" fill="#26313A"/><circle cx="45" cy="27" r="3" fill="#9AA7AC"/><path d="M11 27l10-11h14l8 3 2 8z" fill="#D2462F"/><rect x="18" y="11" width="16" height="5" rx="2" fill="#26313A"/><path d="M42 18l3-12h5" stroke="#26313A" stroke-width="2.5" fill="none"/>'],
    pallet: [48, 12, '<rect x="0" y="0" width="48" height="3" fill="#C9A26B"/><rect x="0" y="9" width="48" height="3" fill="#C9A26B"/><rect x="2" y="3" width="6" height="6" fill="#A97C52"/><rect x="21" y="3" width="6" height="6" fill="#A97C52"/><rect x="40" y="3" width="6" height="6" fill="#A97C52"/>'],
    cement: [48, 30, '<rect x="1" y="16" width="22" height="13" rx="3" fill="#A7AEB1"/><rect x="25" y="16" width="22" height="13" rx="3" fill="#9CA4A7"/><rect x="12" y="2" width="22" height="13" rx="3" fill="#B3BABD"/><rect x="5" y="20" width="14" height="4" fill="#E2533D"/><rect x="29" y="20" width="14" height="4" fill="#E2533D"/><rect x="16" y="6" width="14" height="4" fill="#E2533D"/>'],
    rebar: [64, 10, '<path d="M0 2h64M0 5h64M0 8h64" stroke="#7A5E50" stroke-width="2"/><path d="M0 3.5h64M0 6.5h64" stroke="#5B463B" stroke-width="1"/>'],
    drinks: [40, 36, '<rect x="1" y="9" width="38" height="26" rx="2" fill="#D23C2F" stroke="#9E2A20"/><circle cx="8" cy="7" r="3.5" fill="#3A2A1F"/><circle cx="16" cy="7" r="3.5" fill="#3A2A1F"/><circle cx="24" cy="7" r="3.5" fill="#3A2A1F"/><circle cx="32" cy="7" r="3.5" fill="#3A2A1F"/><rect x="12" y="16" width="16" height="6" rx="2" fill="#F2F4F5"/>']
  };

  TK.addStrings({
    fr: {
      'vs.how': 'Que peut-on charger ?', 'vs.canCarry': 'Peut transporter, par exemple', 'vs.choose': 'Choisir ce véhicule',
      'vs.order': 'Commander avec ce véhicule', 'vs.close': 'Fermer', 'vs.from': 'Dès {p}', 'vs.payload': 'Charge utile',
      'vs.dims': 'Caisse', 'ph.goods': 'Marchandises', 'ph.moving': 'Déménagement', 'vs.prev': 'Véhicule précédent', 'vs.next': 'Véhicule suivant', 'vs.tap': 'Touchez le véhicule pour voir ce qui rentre',
      'vs.note': "Capacités indicatives : elles varient selon le véhicule du chauffeur. Décrivez précisément vos objets à l'étape suivante.",
      'sum.tricycle': 'Petits colis, sacs et cageots, ou 1 à 2 objets moyens.',
      'sum.van1t': 'Studio ou déménagement partiel : 5 à 8 meubles et appareils.',
      'sum.truck3t': 'Appartement de 2 à 3 pièces, ou stock de commerce.',
      'sum.truck10t': 'Maison de 4 à 5 pièces, grossistes et matériaux.',
      'svc.handling': 'Avec manutention', 'svc.handlingD': '1 aide inclus · démontage et emballage en option',
      'svc.transport': 'Transport seul', 'svc.transportD': 'Le chauffeur conduit, vous chargez', 'svc.from': 'à partir de',
      'it.box': 'Cartons', 'it.sack': 'Sacs de 25 kg', 'it.crate': 'Cageots de vivriers', 'it.mattress': 'Matelas', 'it.bed': 'Lit démonté',
      'it.fridge': 'Réfrigérateur', 'it.freezer': 'Congélateur coffre', 'it.washer': 'Machine à laver', 'it.sofa': 'Canapé',
      'it.armchair': 'Fauteuil', 'it.tv': 'Téléviseur', 'it.wardrobe': 'Armoire démontée', 'it.table': 'Table et chaises',
      'it.chairs': 'Chaises plastiques', 'it.fan': 'Ventilateur', 'it.gas': 'Bouteilles de gaz', 'it.moto': 'Moto',
      'it.pallet': 'Palettes', 'it.cement': 'Sacs de ciment 50 kg', 'it.rebar': 'Fer à béton', 'it.drinks': 'Casiers de boissons'
    },
    en: {
      'vs.how': 'What fits?', 'vs.canCarry': 'Can carry, for example', 'vs.choose': 'Choose this vehicle',
      'vs.order': 'Book this vehicle', 'vs.close': 'Close', 'vs.from': 'From {p}', 'vs.payload': 'Payload',
      'vs.dims': 'Cargo space', 'ph.goods': 'Goods', 'ph.moving': 'House move', 'vs.prev': 'Previous vehicle', 'vs.next': 'Next vehicle', 'vs.tap': 'Tap the vehicle to see what fits',
      'vs.note': "Indicative capacity: it depends on the driver's vehicle. Describe your items precisely in the next step.",
      'sum.tricycle': 'Small parcels, sacks and crates, or 1 to 2 medium items.',
      'sum.van1t': 'Studio or partial move: 5 to 8 pieces of furniture and appliances.',
      'sum.truck3t': '2 to 3-room flat, or shop stock.',
      'sum.truck10t': '4 to 5-room house, wholesalers and building materials.',
      'svc.handling': 'With handling', 'svc.handlingD': '1 helper included · dismantling and packing optional',
      'svc.transport': 'Transport only', 'svc.transportD': 'The driver drives, you load', 'svc.from': 'from',
      'it.box': 'Boxes', 'it.sack': '25 kg sacks', 'it.crate': 'Produce crates', 'it.mattress': 'Mattress', 'it.bed': 'Dismantled bed',
      'it.fridge': 'Fridge', 'it.freezer': 'Chest freezer', 'it.washer': 'Washing machine', 'it.sofa': 'Sofa',
      'it.armchair': 'Armchair', 'it.tv': 'TV', 'it.wardrobe': 'Dismantled wardrobe', 'it.table': 'Table and chairs',
      'it.chairs': 'Plastic chairs', 'it.fan': 'Fan', 'it.gas': 'Gas cylinders', 'it.moto': 'Motorbike',
      'it.pallet': 'Pallets', 'it.cement': '50 kg cement bags', 'it.rebar': 'Rebar', 'it.drinks': 'Drink crates'
    }
  });

  const metres = m => `${String(m).replace('.', TK.getLang() === 'fr' ? ',' : '.')}\u00a0m`;
  const n1 = v => Math.round(v * 10) / 10;

  function icon(key) {
    const [w, h, body] = ICONS[key];
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${body}</svg>`;
  }

  function placeIcon(key, x, y, w, h) {
    const [vw, vh, body] = ICONS[key];
    return `<svg x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMax meet">${body}</svg>`;
  }

  const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map(p => p.map(n1).join(',')).join(' ')}"/>`;
  const wheel = (cx, cy, r) => `<circle class="v-tire" cx="${n1(cx)}" cy="${n1(cy)}" r="${r}"/><circle class="v-hub" cx="${n1(cx)}" cy="${n1(cy)}" r="${Math.round(r * 0.45)}"/>`;

  // Illustration du véhicule, caisse ouverte côté spectateur, avec chargement et cotes.
  function drawnArt(id) {
    const s = SPECS[id];
    const tri = !!s.open;
    const W = 400, yF = tri ? 150 : 166;
    const k = Math.min((tri ? 170 : 230) / s.l, (tri ? 40 : 108) / s.h);
    const L = s.l * k, H = s.h * k, dx = s.w * k * 0.42, dy = -s.w * k * 0.26;
    const cabW = tri ? 96 : s.cab === 'van' ? 74 : 70;
    const x0 = (W - 34 - (cabW + L + dx)) / 2 + cabW, x1 = x0 + L; // 34 px réservés à la cote de hauteur
    const top = yF - H;
    const out = [];

    out.push(`<ellipse class="v-shadow" cx="${n1(x0 - cabW / 2 + (L + dx) / 2)}" cy="${yF + (tri ? 37 : 32)}" rx="${n1((cabW + L + dx) / 2 + 6)}" ry="7"/>`);
    // caisse : paroi du fond, paroi de bout, plancher
    out.push(poly([[x0 + dx, top + dy], [x1 + dx, top + dy], [x1 + dx, yF + dy], [x0 + dx, yF + dy]], 'v-back'));
    out.push(poly([[x1, top], [x1 + dx, top + dy], [x1 + dx, yF + dy], [x1, yF]], 'v-end'));
    out.push(poly([[x0, top], [x0 + dx, top + dy], [x0 + dx, yF + dy], [x0, yF]], 'v-end v-end-front'));
    out.push(poly([[x0, yF], [x1, yF], [x1 + dx, yF + dy], [x0 + dx, yF + dy]], 'v-floor'));
    if (!tri) out.push(poly([[x0, top], [x1, top], [x1 + dx, top + dy], [x0 + dx, top + dy]], 'v-roof'));

    // chargement : rangée du fond puis rangée avant
    let itemsTop = top;
    for (const row of ['b', 'f']) {
      const f = row === 'b' ? 0.62 : 0.12;
      s.scene.filter(it => it.row === row).forEach(it => {
        // Hauteur déduite des proportions de l'icône, pour que les piles se touchent.
        const [vw, vh] = ICONS[it.k];
        let w = it.w * L, h = w * vh / vw;
        if (!tri && h > H * 0.97) { h = H * 0.97; w = h * vw / vh; }
        const y = yF + dy * f - (it.y || 0) * H - (it.stack || 0) * h - h;
        itemsTop = Math.min(itemsTop, y);
        out.push(placeIcon(it.k, x0 + it.x * L + dx * f, y, w, h));
      });
    }

    // châssis, bande de marque
    out.push(`<rect class="v-shade" x="${n1(x0 - (tri ? 4 : cabW - 4))}" y="${yF}" width="${n1(L + (tri ? 8 : cabW))}" height="${tri ? 8 : 14}" rx="2"/>`);
    if (tri) {
      // ridelle avant découpée, comme la caisse des camions
      out.push(`<path class="v-frame" d="M${n1(x0)} ${n1(top)}H${n1(x1)}V${yF}M${n1(x0)} ${n1(top)}V${yF}"/>`);
      out.push(`<rect class="v-brand" x="${n1(x0)}" y="${yF + 2}" width="${n1(L)}" height="4"/>`);
      // avant moto
      out.push(poly([[x0, yF - 4], [x0 - 30, yF - 6], [x0 - 46, yF - 22], [x0 - 62, yF - 22], [x0 - 58, yF + 4], [x0, yF + 10]], 'v-body'));
      out.push(`<rect class="v-tire" x="${n1(x0 - 40)}" y="${yF - 17}" width="30" height="7" rx="3"/>`);
      out.push(`<path class="v-fork" d="M${n1(x0 - 64)} ${yF - 30}L${n1(x0 - 80)} ${yF + 20}"/>`);
      out.push(`<path class="v-bar" d="M${n1(x0 - 62)} ${yF - 22}L${n1(x0 - 70)} ${yF - 44}M${n1(x0 - 78)} ${yF - 44}L${n1(x0 - 60)} ${yF - 47}"/>`);
      out.push(`<circle class="v-light" cx="${n1(x0 - 70)}" cy="${yF - 34}" r="4"/>`);
      out.push(wheel(x0 - 80, yF + 20, 15), wheel(x1 - 30, yF + 20, 16));
    } else {
      // arêtes avant de la caisse découpée
      out.push(`<path class="v-frame" d="M${n1(x0)} ${n1(top)}H${n1(x1)}V${yF}M${n1(x0)} ${n1(top)}V${yF}"/>`);
      if (s.cab === 'van') {
        out.push(poly([[x0, top], [x0 - 34, top], [x0 + dx * 0.0 - 34 + dx, top + dy], [x0 + dx, top + dy]], 'v-shade'));
        out.push(poly([[x0, top], [x0 - 34, top], [x0 - 62, yF - H * 0.48], [x0 - cabW, yF - H * 0.38], [x0 - cabW, yF + 12], [x0, yF + 12]], 'v-body'));
        out.push(poly([[x0 - 8, top + 8], [x0 - 36, top + 8], [x0 - 58, yF - H * 0.5], [x0 - 8, yF - H * 0.5]], 'v-glass'));
        out.push(`<path class="v-line" d="M${n1(x0 - 4)} ${n1(top + 4)}V${yF + 8}"/>`);
      } else {
        const Hc = Math.max(70, Math.min(H * 0.92, 92));
        out.push(poly([[x0 - 50, yF - Hc], [x0 - 6, yF - Hc], [x0 - 6 + dx * 0.8, yF - Hc + dy * 0.8], [x0 - 50 + dx * 0.8, yF - Hc + dy * 0.8]], 'v-shade'));
        out.push(poly([[x0 - 6, yF - Hc], [x0 - 50, yF - Hc], [x0 - cabW, yF - Hc * 0.55], [x0 - cabW, yF + 12], [x0 - 6, yF + 12]], 'v-body'));
        out.push(poly([[x0 - 12, yF - Hc + 8], [x0 - 47, yF - Hc + 8], [x0 - cabW + 5, yF - Hc * 0.52], [x0 - 12, yF - Hc * 0.52]], 'v-glass'));
      }
      out.push(`<rect class="v-light" x="${n1(x0 - cabW)}" y="${yF - 6}" width="6" height="6" rx="1"/>`);
      out.push(`<rect class="v-brand" x="${n1(x0 - cabW + 2)}" y="${yF + 2}" width="${n1(cabW + L - 4)}" height="4"/>`);
      out.push(wheel(x0 - cabW + 26, yF + 14, 17), wheel(x1 - 34, yF + 14, 17));
      if (s.axles === 2) out.push(wheel(x1 - 72, yF + 14, 17));
    }

    // cotes : longueur (arête haute du fond), largeur (arête gauche), hauteur (droite)
    const ly = Math.min(top + dy, itemsTop) - 12;
    out.push(`<path class="v-dim" d="M${n1(x0 + dx)} ${n1(ly)}H${n1(x1 + dx)}M${n1(x0 + dx)} ${n1(ly - 4)}v8M${n1(x1 + dx)} ${n1(ly - 4)}v8"/>`);
    out.push(`<text class="v-dimt" x="${n1(x0 + dx + L / 2)}" y="${n1(ly - 6)}" text-anchor="middle">${metres(s.l)}</text>`);
    out.push(`<path class="v-dim" d="M${n1(x0 - 10)} ${n1(top - 6)}L${n1(x0 + dx - 10)} ${n1(top + dy - 6)}"/>`);
    out.push(`<text class="v-dimt" x="${n1(x0 + dx / 2 - 14)}" y="${n1(top + dy / 2 - 10)}" text-anchor="end">${metres(s.w)}</text>`);
    const hx = x1 + dx + 12;
    out.push(`<path class="v-dim" d="M${n1(hx)} ${n1(top + dy)}V${n1(yF + dy)}M${n1(hx - 4)} ${n1(top + dy)}h8M${n1(hx - 4)} ${n1(yF + dy)}h8"/>`);
    out.push(`<text class="v-dimt" x="${n1(hx + 7)}" y="${n1(top + dy + H / 2 + 4)}">${metres(s.h)}</text>`);

    return `<svg class="veh-art-svg" viewBox="0 0 ${W} 214" overflow="visible" role="img" aria-label="${t('veh.' + id)} · ${metres(s.l)} × ${metres(s.w)} × ${metres(s.h)}">${out.join('')}</svg>`;
  }

  // Visuels fournis pour chaque véhicule ; à défaut, l'illustration dessinée.
  const PHOTOS = {
    tricycle: [{ src: 'assets/vehicles/tricycle.jpg', w: 1200, h: 591 }],
    truck3t: [{ src: 'assets/vehicles/truck3t.jpg', w: 1200, h: 656 }],
    truck10t: [
      { src: 'assets/vehicles/truck10t-goods.jpg', w: 1200, h: 607, label: 'ph.goods' },
      { src: 'assets/vehicles/truck10t-moving.jpg', w: 1200, h: 607, label: 'ph.moving' }
    ]
  };
  const photoIndex = {};

  function photoAlt(id, ph) {
    const s = SPECS[id];
    return `${t('veh.' + id)}${ph.label ? ' · ' + t(ph.label) : ''} · ${metres(s.l)} × ${metres(s.w)} × ${metres(s.h)}`;
  }

  function art(id) {
    const list = PHOTOS[id];
    if (!list) return drawnArt(id);
    const ph = list[photoIndex[id] || 0];
    return `<img class="veh-photo" src="${ph.src}" width="${ph.w}" height="${ph.h}" alt="${photoAlt(id, ph)}" decoding="async">`;
  }

  // Bascule entre plusieurs visuels d'un même véhicule (ex. 10T : marchandises / déménagement).
  function photoSwitch(id) {
    const list = PHOTOS[id];
    if (!list || list.length < 2) return '';
    const cur = photoIndex[id] || 0;
    return `<div class="photo-switch" role="group">${list.map((ph, i) => `<button type="button" class="photo-chip${i === cur ? ' is-on' : ''}" aria-pressed="${i === cur}" data-photo-v="${id}" data-photo-i="${i}">${t(ph.label)}</button>`).join('')}</div>`;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-photo-i]');
    if (!b) return;
    const id = b.dataset.photoV, i = +b.dataset.photoI, ph = PHOTOS[id][i];
    photoIndex[id] = i;
    const box = b.closest('.veh-stage, .sheet-art');
    const img = box && box.querySelector('img.veh-photo');
    if (img) { img.src = ph.src; img.alt = photoAlt(id, ph); }
    b.parentElement.querySelectorAll('.photo-chip').forEach(c => {
      const on = c === b;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', on);
    });
  });

  const stageClass = id => PHOTOS[id] ? ' has-photo' : '';

  function tabs(selected, attr) {
    return `<div class="veh-tabs" role="tablist">${VEHICLES.map(v => `<button type="button" role="tab" class="veh-tab${v.id === selected ? ' is-on' : ''}" aria-selected="${v.id === selected}" ${attr}="${v.id}">${t('veh.' + v.id)}</button>`).join('')}</div>`;
  }

  function dims(id) {
    const s = SPECS[id];
    return `<span>${t('vs.dims')} ${metres(s.l)} × ${metres(s.w)} × ${metres(s.h)}</span> <span>· ${t('vs.payload')} ${s.payload.replace(' ', '\u00a0')}</span>`;
  }

  function stage(id, actAttr) {
    return `<div class="veh-stage${stageClass(id)}">
      <button type="button" class="veh-arrow veh-arrow-prev" ${actAttr}="prev" aria-label="${t('vs.prev')}">‹</button>
      <button type="button" class="veh-art" data-veh-open="${id}" aria-label="${t('vs.how')} ${t('veh.' + id)}">${art(id)}</button>
      <button type="button" class="veh-arrow veh-arrow-next" ${actAttr}="next" aria-label="${t('vs.next')}">›</button>
      ${photoSwitch(id)}
      <p class="veh-dims mono">${dims(id)}</p>
    </div>`;
  }

  function step(id, dir) {
    const ids = VEHICLES.map(v => v.id);
    const i = ids.indexOf(id) + (dir === 'next' ? 1 : -1);
    return ids[(i + ids.length) % ids.length];
  }

  // ---------- panneau « Que peut-on charger ? » ----------
  let sheetEl = null, sheetState = null, lastFocus = null;

  function sheetHTML() {
    const id = sheetState.id;
    return `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <div class="sheet-head">
          <h2 id="sheetTitle" class="sheet-title">${t('vs.how')}</h2>
          <button type="button" class="sheet-x" data-sheet-close aria-label="${t('vs.close')}">✕</button>
        </div>
        <div class="sheet-body">
          ${tabs(id, 'data-sheet-v')}
          <div class="sheet-art${stageClass(id)}">${art(id)}${photoSwitch(id)}<p class="veh-dims mono">${dims(id)}</p></div>
          <section class="sheet-card">
            <h3>${t('vs.canCarry')} · <span class="accent">${t('veh.' + id)}</span></h3>
            <p class="sheet-sum">${t('sum.' + id)}</p>
            <ul class="item-grid">${SPECS[id].items.map(([key, cap]) => `
              <li class="item-card"><span class="item-label">${t('it.' + key)}${cap ? ` <b class="mono">${cap}</b>` : ''}</span><span class="item-ic">${icon(key)}</span></li>`).join('')}</ul>
            <p class="fine">${t('vs.note')}</p>
          </section>
        </div>
        <div class="sheet-foot"><button type="button" class="btn btn-signal btn-block" data-sheet-choose>${sheetState.label || t('vs.choose')}</button></div>
      </div>`;
  }

  function renderSheet() {
    const scroll = sheetEl.querySelector('.sheet-body');
    sheetEl.innerHTML = sheetHTML();
    if (scroll) sheetEl.querySelector('.sheet-body').scrollTop = 0;
  }

  function openSheet(id, opts = {}) {
    if (!sheetEl) {
      sheetEl = document.createElement('div');
      sheetEl.className = 'sheet-backdrop';
      document.body.appendChild(sheetEl);
      sheetEl.addEventListener('click', e => {
        if (e.target === sheetEl || e.target.closest('[data-sheet-close]')) return closeSheet();
        const tab = e.target.closest('[data-sheet-v]');
        if (tab) {
          sheetState.id = tab.dataset.sheetV;
          renderSheet();
          centerTabs(sheetEl);
          sheetEl.querySelector(`[data-sheet-v="${sheetState.id}"]`).focus({ preventScroll: true });
          return;
        }
        if (e.target.closest('[data-sheet-choose]')) {
          const { id: chosen, onChoose } = sheetState;
          closeSheet();
          if (onChoose) onChoose(chosen);
        }
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetEl && !sheetEl.hidden) closeSheet(); });
    }
    lastFocus = document.activeElement;
    sheetState = { id, onChoose: opts.onChoose, label: opts.label };
    renderSheet();
    sheetEl.hidden = false;
    centerTabs(sheetEl);
    document.documentElement.classList.add('sheet-open');
    const x = sheetEl.querySelector('.sheet-x');
    if (x) x.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheetEl) return;
    sheetEl.hidden = true;
    document.documentElement.classList.remove('sheet-open');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  // Garde l'onglet actif visible dans la barre défilante.
  function centerTabs(scope) {
    scope.querySelectorAll('.veh-tabs').forEach(bar => {
      const on = bar.querySelector('.is-on');
      if (on) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
    });
  }

  function swipe(scope, onSwipe) {
    let start = null;
    scope.addEventListener('touchstart', e => {
      start = e.target.closest('.veh-stage') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    scope.addEventListener('touchend', e => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
      start = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 'next' : 'prev');
    });
  }

  window.TK = Object.assign(window.TK || {}, {
    vehicles: { SPECS, art, icon, tabs, stage, dims, step, openSheet, closeSheet, centerTabs, swipe }
  });
})();
