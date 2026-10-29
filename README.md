# Takaata

Site web et application (PWA installable) de **Takaata**, plateforme de transport de marchandises à la demande à Abidjan.

## Contenu

- **Site vitrine** (`index.html`) : présentation, estimateur de prix, grille des véhicules, règles, chauffeurs, entreprises, FAQ. Bilingue FR / EN.
- **Application** (même page, routes `#app`, `#chauffeur`, `#admin`) :
  - **Client** : commande en 4 étapes (trajet, véhicule illustré avec ce qu'il peut contenir, chargement, prix et paiement), photos des objets et note vocale, jauge des chances d'acceptation du prix, nouvelles propositions après contre-offre, suivi, code de livraison à 4 chiffres, suivi partagé avec le destinataire (#suivi/…), annonces vocales et texte agrandi, économie de données et bandeau hors ligne, courses programmées chaque semaine, compte entreprise (facture mensuelle, membres, relevé CSV), signalement, note et reçu.
  - **Chauffeur** : solde prépayé (solde, réservé, disponible), recharges, demandes à proximité, accepter ou contre-proposer, réservation de 15 % avant attribution, demande en plein écran, scan du visage (inscription, mise en ligne, « Je pars maintenant », démarrage de la course), boutons Urgence et Partager ma position (chauffeur et client), 2 photos minimum à l'arrivée, note du client, parrainage chauffeur, navigation, photos prises en direct, saisie du code du client pour valider la livraison et être payé.
  - **Admin** : indicateurs, liste des courses, rapprochement du solde chauffeur, signalements.

Les règles viennent du business plan V3 : prix = max(plancher ; base + km × tarif) + options, commission 15 %, annulation gratuite avant attribution et pendant 5 minutes.

## Prototype

Les données sont stockées dans le navigateur (`localStorage`) et les chauffeurs et clients sont simulés. Prochaine étape : un backend Firebase (comptes par téléphone + OTP, Firestore, notifications), Google Maps et CinetPay pour le Mobile Money. La reconnaissance faciale est simulée : au lancement, un fournisseur spécialisé (par exemple Smile ID) comparera les visages.

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 (site) ou http://localhost:8000/#app (application).

## Mettre en ligne

Site 100 % statique : il suffit de déposer le dossier sur Netlify, Vercel, GitHub Pages ou Firebase Hosting. Le HTTPS est requis pour l'installation de l'app sur téléphone.

## Structure

```
index.html            site + conteneur de l'app
css/style.css         styles (thème clair et sombre)
js/data.js            véhicules, communes, calcul des prix
js/i18n.js            traductions FR / EN
js/store.js           commandes, offres, solde prépayé (logique métier)
js/ui.js              utilitaires d'affichage, carte schématique
js/media.js           appareil photo, scan du visage (simulé), note vocale
js/vehicles.js        choix du véhicule : caisse chargée, cotes, « Que peut-on charger ? »
js/site.js            site vitrine
js/app.js             application client / chauffeur / admin

manifest.webmanifest  installation PWA
sw.js                 fonctionnement hors ligne
tools/build_preview.py  génère dist/preview.html pour un aperçu hébergé
```
