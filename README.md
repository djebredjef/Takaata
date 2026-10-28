# Takaata

Site web et application (PWA installable) de **Takaata**, plateforme de transport de marchandises à la demande à Abidjan.

## Contenu

- **Site vitrine** (`index.html`) : présentation, estimateur de prix, grille des véhicules, règles, chauffeurs, entreprises, FAQ. Bilingue FR / EN.
- **Application** (même page, routes `#app`, `#chauffeur`, `#admin`) :
  - **Client** : commande en 4 étapes (trajet, véhicule illustré avec ce qu'il peut contenir, chargement, prix et paiement), offres et contre-offres des chauffeurs, suivi, photos, signalement, confirmation de livraison, note et reçu.
  - **Chauffeur** : solde prépayé (solde, réservé, disponible), recharges, demandes à proximité, accepter ou contre-proposer, réservation de 15 % avant attribution, débit unique à la livraison (espèces) ou reversement net (Mobile Money).
  - **Admin** : indicateurs, liste des courses, rapprochement du solde chauffeur, signalements.

Les règles viennent du business plan V3 : prix = max(plancher ; base + km × tarif) + options, commission 15 %, annulation gratuite avant attribution et pendant 5 minutes.

## Prototype

Les données sont stockées dans le navigateur (`localStorage`) et les chauffeurs et clients sont simulés. Prochaine étape : un backend Firebase (comptes par téléphone + OTP, Firestore, notifications), Google Maps et CinetPay pour le Mobile Money.

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
js/vehicles.js        choix du véhicule : caisse chargée, cotes, « Que peut-on charger ? »
js/site.js            site vitrine
js/app.js             application client / chauffeur / admin

manifest.webmanifest  installation PWA
sw.js                 fonctionnement hors ligne
tools/build_preview.py  génère dist/preview.html pour un aperçu hébergé
```
