// Traductions FR / EN. Les clés statiques du site sont posées via data-i18n.
(function () {
  const fr = {
    'nav.how': 'Comment ça marche', 'nav.vehicles': 'Véhicules et prix', 'nav.drivers': 'Chauffeurs',
    'nav.business': 'Entreprises', 'nav.faq': 'FAQ', 'nav.open': "Ouvrir l'app",

    'hero.eyebrow': 'Transport de marchandises à la demande · Abidjan',
    'hero.title': 'Le bon véhicule, au prix que vous acceptez.',
    'hero.lead': "Déménagement, meubles, vivriers, colis volumineux : publiez votre demande, recevez les offres de chauffeurs vérifiés et choisissez celle qui vous convient.",
    'hero.ctaClient': 'Commander un transport', 'hero.ctaDriver': 'Devenir chauffeur partenaire',

    'need.moving': 'Déménagement', 'need.furniture': 'Meubles', 'need.food': 'Vivriers',
    'need.shop': 'Approvisionnement de commerce', 'need.parcel': 'Colis volumineux',
    'needd.moving': 'Studio, appartement, partiel ou complet', 'needd.furniture': 'Achat en magasin, menuisier, livraison',
    'needd.food': 'Marché, grossiste, sacs et cageots', 'needd.shop': 'Stock, boissons, marchandises',
    'needd.parcel': 'Électroménager, cartons, matériel',

    'quote.title': 'Bon de transport · estimation', 'quote.from': 'Départ', 'quote.to': 'Arrivée',
    'quote.vehicle': 'Véhicule', 'quote.distance': 'Distance estimée', 'quote.floor': 'Prix plancher',
    'quote.reference': 'Prix de référence',
    'quote.note': 'Hors options (manutention, étages, emballage). Vous proposez votre prix ; les chauffeurs acceptent ou font une contre-offre.',
    'quote.go': 'Publier cette demande',

    'how.eyebrow': 'Prix négocié, en quatre étapes', 'how.title': 'Vous proposez, les chauffeurs répondent.',
    'how.s1t': 'Publication', 'how.s1': "Vous décrivez le trajet et le chargement. L'app suggère un prix de référence que vous pouvez ajuster.",
    'how.s2t': 'Offres', 'how.s2': 'Les chauffeurs à proximité acceptent votre prix ou envoient une contre-offre, jamais sous le plancher.',
    'how.s3t': 'Sélection', 'how.s3': 'Vous comparez prix, note du chauffeur et distance, puis vous choisissez.',
    'how.s4t': 'Départ', 'how.s4': "La course démarre une fois l'accord validé par les deux. Vous suivez chaque étape jusqu'à la livraison.",

    'veh.eyebrow': 'Grille de référence du pilote', 'veh.title': 'Quatre véhicules, une formule lisible.',
    'veh.formula': 'prix = max(plancher ; base + km × tarif) + options',
    'veh.colVehicle': 'Véhicule', 'veh.colLoad': 'Charge', 'veh.colBase': 'Base', 'veh.colKm': 'Par km',
    'veh.colFloor': 'Plancher', 'veh.colUse': 'Usage typique',
    'veh.fine': 'Montants en FCFA. Ce sont les hypothèses de départ du pilote ; elles seront ajustées avec les chauffeurs.',
    'veh.tricycle': 'Moto-tricycle', 'veh.van1t': 'Camionnette 1T', 'veh.truck3t': 'Camion 3T', 'veh.truck10t': 'Camion 10T',
    'use.tricycle': 'Petits colis, courses rapides', 'use.van1t': 'Meubles, déménagement partiel',
    'use.truck3t': 'Déménagement complet, vivriers', 'use.truck10t': 'Grossistes, entreprises',

    'rules.eyebrow': 'Tout est dit avant le départ', 'rules.title': "Des règles claires, pas de surprise à l'arrivée.",
    'rules.r1t': 'Manutention et étages', 'rules.r1': "Transport seul ou avec manutention. Vous déclarez objets, poids estimé, étages, ascenseur et nombre d'aides. Le prix détaillé est accepté avant le départ.",
    'rules.r2t': 'Attente', 'rules.r2': '30 minutes cumulées de chargement et déchargement incluses. Les embouteillages ne sont pas facturés comme attente.',
    'rules.r3t': 'Annulation', 'rules.r3': "Gratuite avant attribution, et pendant 5 minutes après si le chauffeur n'est pas parti. Une annulation due au chauffeur reste gratuite pour vous.",
    'rules.r4t': 'Photos et litiges', 'rules.r4': "Photos au départ et à l'arrivée, réserves enregistrées, signalement dans l'app. Le support prend le dossier en charge sous un jour ouvré.",
    'rules.r5t': 'Paiement', 'rules.r5': 'Espèces au chauffeur, ou Mobile Money : Orange Money, Wave, MTN MoMo.',
    'rules.r6t': 'Changements', 'rules.r6': "Nouvelle adresse ou volume en plus : un nouveau prix est accepté dans l'app avant exécution. Péages et stationnement remboursés sur justificatif.",

    'drv.eyebrow': 'Chauffeurs partenaires', 'drv.title': 'Gardez 85 % de chaque course.',
    'drv.b1': "Commission unique de 15 %, affichée avant d'accepter.",
    'drv.b2': 'Des demandes qualifiées près de vous, avec le chargement décrit.',
    'drv.b3': 'Vous acceptez le prix du client ou vous faites votre contre-offre.',
    'drv.b4': 'Historique de vos courses et de votre solde, traitement des litiges.',
    'drv.b5': "Formation gratuite à l'application dans votre commune.",
    'drv.cta': "Ouvrir l'espace chauffeur",
    'drv.exTitle': "Solde prépayé : exemple d'une course payée en espèces",
    'drv.ex1': 'Solde de départ', 'drv.ex2': 'Course acceptée à 8 000 : réservation 15 %', 'drv.reserved': 'réservé',
    'drv.ex3': 'Le client paie 8 000 en espèces', 'drv.inHand': 'en main',
    'drv.ex4': 'Livraison confirmée : commission débitée', 'drv.ex5': 'Nouveau solde',
    'drv.exNote': "Pas de commission si la course n'a pas lieu. En Mobile Money, Takaata retient la commission sur le paiement et vous reverse le net, sans toucher au solde.",

    'biz.eyebrow': 'TPME, commerces, grossistes', 'biz.title': 'Vos livraisons régulières, suivies au même endroit.',
    'biz.b1': 'Tableau de bord pour commander et suivre toutes vos livraisons.',
    'biz.b2': 'Relevé mensuel des commandes et facturation selon contrat.',
    'biz.b3': 'Remises de volume étudiées avec vous pendant le pilote.',
    'biz.formTitle': 'Parlons de vos besoins', 'biz.company': 'Entreprise', 'biz.phone': 'Téléphone',
    'biz.volume': 'Courses par mois (estimation)', 'biz.send': 'Envoyer',
    'biz.sent': "Merci. Votre demande est enregistrée sur cet appareil (prototype) : l'envoi à l'équipe sera actif au lancement.",

    'zone.eyebrow': 'Zone de lancement', 'zone.title': 'Le Grand Abidjan, commune par commune.',
    'zone.fine': "Le pilote démarre sur une zone limitée, puis s'étend selon la qualité de service.",

    'faq.title': 'Questions fréquentes',
    'faq.q1': 'Comment le prix est-il fixé ?', 'faq.a1': "L'app calcule un prix de référence selon le véhicule, la distance et vos options. Vous proposez votre prix, au-dessus du plancher. Les chauffeurs l'acceptent ou font une contre-offre, et vous choisissez.",
    'faq.q2': 'Comment payer ?', 'faq.a2': 'En espèces au chauffeur, ou par Mobile Money (Orange Money, Wave, MTN MoMo), selon les moyens disponibles au lancement.',
    'faq.q3': 'Mes biens sont-ils assurés ?', 'faq.a3': "Chaque course est documentée par des photos au départ et à l'arrivée et une preuve de livraison. En cas de dommage, le support traite le dossier selon les responsabilités établies. Aucune assurance tous risques n'est annoncée tant qu'un assureur ne l'a pas confirmée par écrit.",
    'faq.q4': 'Les chauffeurs sont-ils vérifiés ?', 'faq.a4': "Oui : pièce d'identité et véhicule sont contrôlés à l'inscription. Chaque course est notée par le client.",
    'faq.q5': 'Faut-il télécharger une application ?', 'faq.a5': "Non. Takaata s'ouvre dans le navigateur et s'installe sur l'écran d'accueil de votre téléphone, comme une application.",

    'inst.title': 'Takaata dans votre poche.', 'inst.lead': "Ajoutez l'application à votre écran d'accueil : commande, suivi et historique en un geste.",
    'inst.btn': "Installer l'application", 'inst.open': "Ouvrir l'app",
    'inst.hint': "Sur iPhone : bouton Partager, puis « Sur l'écran d'accueil ».",

    'foot.tag': 'Transport de marchandises à la demande à Abidjan.',
    'foot.note': 'Prototype de lancement. Tarifs et règles en cours de validation pendant le pilote.',

    // ---- Application ----
    'app.site': 'Site', 'role.client': 'Client', 'role.driver': 'Chauffeur', 'role.admin': 'Admin',
    'app.demo': 'Prototype : les données restent sur cet appareil.',
    'pay.cash': 'Espèces', 'pay.orange': 'Orange Money', 'pay.wave': 'Wave', 'pay.mtn': 'MTN MoMo',
    'status.open': "En attente d'offres", 'status.assigned': 'Chauffeur attribué', 'status.pickup': 'En route vers le chargement',
    'status.loading': 'Chargement', 'status.transit': 'En livraison', 'status.arrived': 'Arrivé à destination',
    'status.delivered': 'Livrée', 'status.cancelled': 'Annulée',

    'c.hello': "Que transportez-vous aujourd'hui ?",
    'c.active': 'En cours', 'c.resume': 'Voir',
    'c.history': 'Mes courses', 'c.noHistory': 'Aucune course pour le moment. Votre première commande apparaîtra ici.',

    'w.step': 'Étape {n} sur 4', 'w.s1': 'Trajet', 'w.s2': 'Véhicule', 'w.s3': 'Chargement', 'w.s4': 'Prix et paiement',
    'w.fromDetail': 'Quartier et repère au départ', 'w.toDetail': "Quartier et repère à l'arrivée",
    'w.detailPh': 'ex. Siporex, près de la pharmacie',
    'w.when': 'Quand ?', 'w.now': 'Dès que possible', 'w.later': 'Planifier', 'w.sameCommune': 'Trajet dans la même commune : distance estimée à {km} km.',
    'w.next': 'Continuer', 'w.prev': 'Retour', 'w.publish': 'Publier la demande', 'w.cancel': 'Abandonner',
    'w.service': 'Service', 'w.transportOnly': 'Transport seul', 'w.handling': 'Transport avec manutention',
    'w.items': 'Objets à transporter', 'w.itemsPh': 'ex. 1 réfrigérateur, 1 lit 2 places, 10 cartons',
    'w.weight': 'Poids estimé', 'w.floorsFrom': 'Étage au départ', 'w.floorsTo': "Étage à l'arrivée",
    'w.elevator': 'Ascenseur disponible', 'w.helpers': 'Manutentionnaires', 'w.packing': 'Emballage', 'w.dismantle': 'Démontage et remontage',
    'w.itemsRequired': 'Décrivez au moins un objet pour que les chauffeurs puissent évaluer la course.',
    'w.transport': 'Transport', 'w.options': 'Options', 'w.reference': 'Prix de référence', 'w.minimum': 'Minimum accepté',
    'w.yourPrice': 'Votre prix', 'w.payment': 'Paiement',
    'w.priceNote': 'Péages et stationnement remboursés sur justificatif, en plus du prix. 30 minutes de chargement et déchargement incluses.',
    'w.belowMin': 'Le prix ne peut pas descendre sous {min}.',
    'w.perHelper': '{p} par aide', 'w.perFloor': '{p} par étage sans ascenseur',

    'o.waiting': 'Les chauffeurs proches reçoivent votre demande…', 'o.offers': 'Offres reçues : {n}',
    'o.accepts': 'Accepte votre prix', 'o.counter': 'Contre-offre', 'o.choose': 'Choisir',
    'o.trips': '{n} courses', 'o.away': 'à {n} min', 'o.you': 'Vous (espace chauffeur)',
    'o.cancel': 'Annuler', 'o.cancelFree': 'Cette annulation est gratuite.',
    'o.cancelFee': 'Le chauffeur est en route : des frais de déplacement plafonnés peuvent être dus, sur preuve.',
    'o.confirmCancel': "Confirmer l'annulation", 'o.keep': 'Garder la course', 'o.yourPrice': 'Votre prix : {p}',

    't.driver': 'Votre chauffeur', 't.confirm': 'Confirmer la livraison',
    't.confirmHint': 'Vérifiez vos biens avant de confirmer. La confirmation clôt la course.',
    't.photosStart': 'Photos au départ', 't.photosEnd': "Photos à l'arrivée", 't.photosCount': '{n} photo(s)',
    't.report': 'Signaler un problème', 't.reportPh': 'Décrivez le problème : retard, dommage, prix…', 't.send': 'Envoyer au support',
    't.reported': 'Signalement envoyé. Le support vous répond sous un jour ouvré.',
    't.demoNext': 'Étape suivante (démo)', 't.agreed': 'Prix accepté', 't.call': 'Téléphone',

    'r.title': "Comment s'est passée la course ?", 'r.commentPh': 'Un mot pour le chauffeur (facultatif)',
    'r.send': 'Envoyer la note', 'r.thanks': 'Merci pour votre note.', 'r.receipt': 'Reçu de course', 'r.again': 'Recommander avec ce chauffeur',

    'd.wallet': 'Solde prépayé', 'd.balance': 'Solde', 'd.reserved': 'Réservé', 'd.available': 'Disponible',
    'd.recharge': 'Recharger', 'd.low': 'Solde disponible bas : rechargez pour accepter de nouvelles courses.',
    'd.requests': 'Demandes à proximité', 'd.noRequests': 'Aucune demande pour le moment. Les nouvelles demandes apparaissent ici.',
    'd.myCourse': 'Ma course', 'd.ledger': 'Mouvements du solde', 'd.noLedger': 'Aucun mouvement.',
    'd.accept': 'Accepter {p}', 'd.counter': 'Contre-offre', 'd.send': 'Envoyer',
    'd.commission': 'Commission 15 % : {c}', 'd.need': 'Il vous manque {m} de solde disponible pour cette course.',
    'd.wrongVehicle': 'Véhicule demandé : {v}', 'd.offerSent': 'Offre envoyée : {p}. En attente du client.',
    'd.declined': 'Le client a choisi une autre offre. Réservation libérée.',
    'd.next.assigned': 'Je pars vers le chargement', 'd.next.pickup': 'Arrivé, je charge', 'd.next.loading': 'Chargé, je pars livrer',
    'd.next.transit': 'Arrivé à destination', 'd.waitClient': 'En attente de la confirmation du client.',
    'd.clientConfirm': 'Le client confirme (démo)',
    'd.cashHint': 'Encaissez {p} en espèces. Commission débitée à la livraison : {c}.',
    'd.mmHint': 'Paiement {m} : reversement net de {n} après la livraison.',
    'd.vehicle': 'Mon véhicule', 'd.digital': 'Gains Mobile Money reversés', 'd.minPrice': 'Minimum : {p}',
    'd.client': 'Client',

    'l.recharge': 'Recharge', 'l.reserve': 'Réservation commission', 'l.release': 'Réservation libérée',
    'l.debit': 'Commission débitée', 'l.payout': 'Reversement Mobile Money (net)',

    'a.done': 'Courses livrées', 'a.gmv': 'Montant des courses', 'a.comm': 'Commissions Takaata',
    'a.avg': 'Prix moyen', 'a.open': 'Demandes ouvertes', 'a.cancel': 'Annulations',
    'a.orders': 'Toutes les courses', 'a.colId': 'N°', 'a.colRoute': 'Trajet', 'a.colVehicle': 'Véhicule',
    'a.colPrice': 'Prix', 'a.colPay': 'Paiement', 'a.colStatus': 'Statut', 'a.noOrders': 'Aucune course.',
    'a.recon': 'Rapprochement du solde chauffeur', 'a.reconRecharges': 'Recharges', 'a.reconDebits': 'Commissions débitées',
    'a.reconExpected': 'Solde attendu', 'a.reconActual': 'Solde enregistré', 'a.reconOk': 'Concordant', 'a.reconKo': 'Écart à analyser',
    'a.reports': 'Signalements', 'a.noReports': 'Aucun signalement.',
    'a.reset': 'Réinitialiser la démo', 'a.resetConfirm': 'Effacer toutes les données de démo ?', 'a.resetYes': 'Effacer', 'a.resetNo': 'Annuler',

    'toast.published': 'Demande publiée', 'toast.recharged': 'Solde rechargé : {p}', 'toast.assigned': 'Chauffeur attribué : {n}',
    'toast.cancelled': 'Course annulée', 'toast.delivered': 'Livraison confirmée', 'toast.reset': 'Données de démo réinitialisées',
    'toast.accepted': 'Le client a accepté votre offre', 'toast.newOffer': 'Nouvelle offre de {n}'
  };

  const en = {
    'nav.how': 'How it works', 'nav.vehicles': 'Vehicles & prices', 'nav.drivers': 'Drivers',
    'nav.business': 'Business', 'nav.faq': 'FAQ', 'nav.open': 'Open the app',

    'hero.eyebrow': 'On-demand goods transport · Abidjan',
    'hero.title': 'The right vehicle, at a price you agree to.',
    'hero.lead': 'Moving house, furniture, food produce, bulky parcels: post your request, get offers from verified drivers and pick the one that suits you.',
    'hero.ctaClient': 'Book a transport', 'hero.ctaDriver': 'Become a partner driver',

    'need.moving': 'Moving', 'need.furniture': 'Furniture', 'need.food': 'Food produce',
    'need.shop': 'Shop restocking', 'need.parcel': 'Bulky parcels',
    'needd.moving': 'Studio, flat, partial or full move', 'needd.furniture': 'Store purchase, carpenter, delivery',
    'needd.food': 'Market, wholesaler, sacks and crates', 'needd.shop': 'Stock, drinks, goods',
    'needd.parcel': 'Appliances, boxes, equipment',

    'quote.title': 'Waybill · estimate', 'quote.from': 'From', 'quote.to': 'To',
    'quote.vehicle': 'Vehicle', 'quote.distance': 'Estimated distance', 'quote.floor': 'Minimum price',
    'quote.reference': 'Reference price',
    'quote.note': 'Options not included (handling, floors, packing). You propose your price; drivers accept it or send a counter-offer.',
    'quote.go': 'Post this request',

    'how.eyebrow': 'Negotiated price, in four steps', 'how.title': 'You propose, drivers respond.',
    'how.s1t': 'Post', 'how.s1': 'Describe the trip and the load. The app suggests a reference price you can adjust.',
    'how.s2t': 'Offers', 'how.s2': 'Nearby drivers accept your price or send a counter-offer, never below the minimum.',
    'how.s3t': 'Choose', 'how.s3': "Compare price, driver rating and distance, then choose.",
    'how.s4t': 'Go', 'how.s4': 'The trip starts once both sides confirm the deal. You follow each step until delivery.',

    'veh.eyebrow': 'Pilot reference rates', 'veh.title': 'Four vehicles, one clear formula.',
    'veh.formula': 'price = max(minimum ; base + km × rate) + options',
    'veh.colVehicle': 'Vehicle', 'veh.colLoad': 'Load', 'veh.colBase': 'Base', 'veh.colKm': 'Per km',
    'veh.colFloor': 'Minimum', 'veh.colUse': 'Typical use',
    'veh.fine': 'Amounts in FCFA. These are the starting assumptions of the pilot and will be adjusted with drivers.',
    'veh.tricycle': 'Cargo tricycle', 'veh.van1t': '1-tonne van', 'veh.truck3t': '3-tonne truck', 'veh.truck10t': '10-tonne truck',
    'use.tricycle': 'Small parcels, quick runs', 'use.van1t': 'Furniture, partial moves',
    'use.truck3t': 'Full moves, food produce', 'use.truck10t': 'Wholesalers, companies',

    'rules.eyebrow': 'Everything agreed before departure', 'rules.title': 'Clear rules, no surprises on arrival.',
    'rules.r1t': 'Handling and floors', 'rules.r1': 'Transport only or with handling. You declare items, estimated weight, floors, lift and number of helpers. The detailed price is agreed before departure.',
    'rules.r2t': 'Waiting time', 'rules.r2': '30 minutes of loading and unloading included in total. Traffic jams are not charged as waiting time.',
    'rules.r3t': 'Cancellation', 'rules.r3': "Free before a driver is assigned, and for 5 minutes after if the driver hasn't set off. A cancellation caused by the driver is always free for you.",
    'rules.r4t': 'Photos and disputes', 'rules.r4': 'Photos at pickup and drop-off, reservations recorded, in-app reporting. Support takes up the case within one business day.',
    'rules.r5t': 'Payment', 'rules.r5': 'Cash to the driver, or Mobile Money: Orange Money, Wave, MTN MoMo.',
    'rules.r6t': 'Changes', 'rules.r6': 'New address or extra volume: a new price is agreed in the app first. Tolls and parking refunded on receipt.',

    'drv.eyebrow': 'Partner drivers', 'drv.title': 'Keep 85% of every trip.',
    'drv.b1': 'A single 15% commission, shown before you accept.',
    'drv.b2': 'Qualified requests near you, with the load described.',
    'drv.b3': "Accept the customer's price or send your own counter-offer.",
    'drv.b4': 'History of your trips and balance, dispute handling.',
    'drv.b5': 'Free app training in your district.',
    'drv.cta': 'Open the driver space',
    'drv.exTitle': 'Prepaid balance: example of a cash trip',
    'drv.ex1': 'Starting balance', 'drv.ex2': 'Trip accepted at 8,000: 15% held', 'drv.reserved': 'held',
    'drv.ex3': 'Customer pays 8,000 in cash', 'drv.inHand': 'in hand',
    'drv.ex4': 'Delivery confirmed: commission debited', 'drv.ex5': 'New balance',
    'drv.exNote': "No commission if the trip doesn't happen. With Mobile Money, Takaata keeps the commission from the payment and pays you the net amount, without touching your balance.",

    'biz.eyebrow': 'SMEs, shops, wholesalers', 'biz.title': 'Your regular deliveries, tracked in one place.',
    'biz.b1': 'A dashboard to order and track all your deliveries.',
    'biz.b2': 'Monthly statement and invoicing under contract.',
    'biz.b3': 'Volume discounts worked out with you during the pilot.',
    'biz.formTitle': "Let's talk about your needs", 'biz.company': 'Company', 'biz.phone': 'Phone',
    'biz.volume': 'Trips per month (estimate)', 'biz.send': 'Send',
    'biz.sent': 'Thank you. Your request is saved on this device (prototype): sending it to the team goes live at launch.',

    'zone.eyebrow': 'Launch area', 'zone.title': 'Greater Abidjan, district by district.',
    'zone.fine': 'The pilot starts in a limited area, then expands as service quality allows.',

    'faq.title': 'Frequently asked questions',
    'faq.q1': 'How is the price set?', 'faq.a1': 'The app calculates a reference price from the vehicle, distance and your options. You propose your price, above the minimum. Drivers accept it or counter, and you choose.',
    'faq.q2': 'How do I pay?', 'faq.a2': 'In cash to the driver, or by Mobile Money (Orange Money, Wave, MTN MoMo), depending on what is available at launch.',
    'faq.q3': 'Are my goods insured?', 'faq.a3': 'Every trip is documented with photos at pickup and drop-off and a proof of delivery. If something is damaged, support handles the case based on established responsibility. No all-risk insurance is announced until an insurer confirms it in writing.',
    'faq.q4': 'Are drivers verified?', 'faq.a4': 'Yes: ID and vehicle are checked at sign-up. Every trip is rated by the customer.',
    'faq.q5': 'Do I need to download an app?', 'faq.a5': "No. Takaata opens in your browser and installs on your phone's home screen like an app.",

    'inst.title': 'Takaata in your pocket.', 'inst.lead': 'Add the app to your home screen: booking, tracking and history in one tap.',
    'inst.btn': 'Install the app', 'inst.open': 'Open the app',
    'inst.hint': 'On iPhone: tap Share, then “Add to Home Screen”.',

    'foot.tag': 'On-demand goods transport in Abidjan.',
    'foot.note': 'Launch prototype. Prices and rules are being validated during the pilot.',

    'app.site': 'Website', 'role.client': 'Customer', 'role.driver': 'Driver', 'role.admin': 'Admin',
    'app.demo': 'Prototype: data stays on this device.',
    'pay.cash': 'Cash', 'pay.orange': 'Orange Money', 'pay.wave': 'Wave', 'pay.mtn': 'MTN MoMo',
    'status.open': 'Waiting for offers', 'status.assigned': 'Driver assigned', 'status.pickup': 'Heading to pickup',
    'status.loading': 'Loading', 'status.transit': 'On the way', 'status.arrived': 'Arrived at destination',
    'status.delivered': 'Delivered', 'status.cancelled': 'Cancelled',

    'c.hello': 'What are you moving today?',
    'c.active': 'In progress', 'c.resume': 'View',
    'c.history': 'My trips', 'c.noHistory': 'No trips yet. Your first booking will show up here.',

    'w.step': 'Step {n} of 4', 'w.s1': 'Route', 'w.s2': 'Vehicle', 'w.s3': 'Load', 'w.s4': 'Price & payment',
    'w.fromDetail': 'Neighbourhood and landmark at pickup', 'w.toDetail': 'Neighbourhood and landmark at drop-off',
    'w.detailPh': 'e.g. Siporex, next to the pharmacy',
    'w.when': 'When?', 'w.now': 'As soon as possible', 'w.later': 'Schedule', 'w.sameCommune': 'Trip within the same district: estimated at {km} km.',
    'w.next': 'Continue', 'w.prev': 'Back', 'w.publish': 'Post the request', 'w.cancel': 'Discard',
    'w.service': 'Service', 'w.transportOnly': 'Transport only', 'w.handling': 'Transport with handling',
    'w.items': 'Items to move', 'w.itemsPh': 'e.g. 1 fridge, 1 double bed, 10 boxes',
    'w.weight': 'Estimated weight', 'w.floorsFrom': 'Floor at pickup', 'w.floorsTo': 'Floor at drop-off',
    'w.elevator': 'Lift available', 'w.helpers': 'Helpers', 'w.packing': 'Packing', 'w.dismantle': 'Dismantling and reassembly',
    'w.itemsRequired': 'Describe at least one item so drivers can assess the trip.',
    'w.transport': 'Transport', 'w.options': 'Options', 'w.reference': 'Reference price', 'w.minimum': 'Minimum accepted',
    'w.yourPrice': 'Your price', 'w.payment': 'Payment',
    'w.priceNote': 'Tolls and parking refunded on receipt, on top of the price. 30 minutes of loading and unloading included.',
    'w.belowMin': 'The price cannot go below {min}.',
    'w.perHelper': '{p} per helper', 'w.perFloor': '{p} per floor without lift',

    'o.waiting': 'Nearby drivers are receiving your request…', 'o.offers': 'Offers received: {n}',
    'o.accepts': 'Accepts your price', 'o.counter': 'Counter-offer', 'o.choose': 'Choose',
    'o.trips': '{n} trips', 'o.away': '{n} min away', 'o.you': 'You (driver space)',
    'o.cancel': 'Cancel', 'o.cancelFree': 'This cancellation is free.',
    'o.cancelFee': 'The driver is on the way: capped travel costs may apply, with proof.',
    'o.confirmCancel': 'Confirm cancellation', 'o.keep': 'Keep the trip', 'o.yourPrice': 'Your price: {p}',

    't.driver': 'Your driver', 't.confirm': 'Confirm delivery',
    't.confirmHint': 'Check your goods before confirming. Confirming closes the trip.',
    't.photosStart': 'Pickup photos', 't.photosEnd': 'Drop-off photos', 't.photosCount': '{n} photo(s)',
    't.report': 'Report a problem', 't.reportPh': 'Describe the problem: delay, damage, price…', 't.send': 'Send to support',
    't.reported': 'Report sent. Support will reply within one business day.',
    't.demoNext': 'Next step (demo)', 't.agreed': 'Agreed price', 't.call': 'Phone',

    'r.title': 'How was the trip?', 'r.commentPh': 'A word for the driver (optional)',
    'r.send': 'Send rating', 'r.thanks': 'Thanks for your rating.', 'r.receipt': 'Trip receipt', 'r.again': 'Book this driver again',

    'd.wallet': 'Prepaid balance', 'd.balance': 'Balance', 'd.reserved': 'Held', 'd.available': 'Available',
    'd.recharge': 'Top up', 'd.low': 'Low available balance: top up to accept new trips.',
    'd.requests': 'Nearby requests', 'd.noRequests': 'No requests right now. New requests show up here.',
    'd.myCourse': 'My trip', 'd.ledger': 'Balance activity', 'd.noLedger': 'No activity yet.',
    'd.accept': 'Accept {p}', 'd.counter': 'Counter-offer', 'd.send': 'Send',
    'd.commission': '15% commission: {c}', 'd.need': 'You need {m} more available balance for this trip.',
    'd.wrongVehicle': 'Vehicle requested: {v}', 'd.offerSent': 'Offer sent: {p}. Waiting for the customer.',
    'd.declined': 'The customer chose another offer. Hold released.',
    'd.next.assigned': 'Heading to pickup', 'd.next.pickup': 'Arrived, loading', 'd.next.loading': 'Loaded, delivering',
    'd.next.transit': 'Arrived at destination', 'd.waitClient': 'Waiting for the customer to confirm.',
    'd.clientConfirm': 'Customer confirms (demo)',
    'd.cashHint': 'Collect {p} in cash. Commission debited on delivery: {c}.',
    'd.mmHint': '{m} payment: net payout of {n} after delivery.',
    'd.vehicle': 'My vehicle', 'd.digital': 'Mobile Money earnings paid out', 'd.minPrice': 'Minimum: {p}',
    'd.client': 'Customer',

    'l.recharge': 'Top-up', 'l.reserve': 'Commission held', 'l.release': 'Hold released',
    'l.debit': 'Commission debited', 'l.payout': 'Mobile Money payout (net)',

    'a.done': 'Delivered trips', 'a.gmv': 'Trip value', 'a.comm': 'Takaata commissions',
    'a.avg': 'Average price', 'a.open': 'Open requests', 'a.cancel': 'Cancellations',
    'a.orders': 'All trips', 'a.colId': 'No.', 'a.colRoute': 'Route', 'a.colVehicle': 'Vehicle',
    'a.colPrice': 'Price', 'a.colPay': 'Payment', 'a.colStatus': 'Status', 'a.noOrders': 'No trips.',
    'a.recon': 'Driver balance reconciliation', 'a.reconRecharges': 'Top-ups', 'a.reconDebits': 'Commissions debited',
    'a.reconExpected': 'Expected balance', 'a.reconActual': 'Recorded balance', 'a.reconOk': 'Matches', 'a.reconKo': 'Gap to investigate',
    'a.reports': 'Reports', 'a.noReports': 'No reports.',
    'a.reset': 'Reset demo', 'a.resetConfirm': 'Erase all demo data?', 'a.resetYes': 'Erase', 'a.resetNo': 'Cancel',

    'toast.published': 'Request posted', 'toast.recharged': 'Balance topped up: {p}', 'toast.assigned': 'Driver assigned: {n}',
    'toast.cancelled': 'Trip cancelled', 'toast.delivered': 'Delivery confirmed', 'toast.reset': 'Demo data reset',
    'toast.accepted': 'The customer accepted your offer', 'toast.newOffer': 'New offer from {n}'
  };

  const dict = { fr, en };
  let lang = 'fr';

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) ?? fr[key] ?? key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function applyStatic(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-toggle]').forEach(b => { b.textContent = lang === 'fr' ? 'EN' : 'FR'; });
  }

  window.TK = Object.assign(window.TK || {}, {
    t, applyStatic,
    getLang: () => lang,
    setLang: l => { lang = dict[l] ? l : 'fr'; }
  });
})();
