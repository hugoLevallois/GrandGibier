# Grands gibiers — prélèvements par département (1973–2025)

Carte interactive (Leaflet + D3) des prélèvements de grand gibier par département, avec animation temporelle, courbe d'évolution, top 10 et thème clair/sombre.

## Mise en route
1. `python scripts/fetch_geo.py` : télécharge le fond de carte `data/departements.geojson` (à faire une fois ; à défaut, la page le charge depuis GitHub au chargement).
2. `python scripts/build_data.py` : régénère `data/prelevements.json` depuis `data/raw/*.json`.
3. `python -m http.server` puis ouvrir http://localhost:8000
4. Publication : pousser sur GitHub, Settings → Pages → branche `main`.

## Structure
- `index.html`, `css/style.css`
- `js/charts.js` (D3 : échelle, courbe, légende), `js/map.js` (Leaflet + état partagé)
- `data/raw/cerf.json` : export data.gouv.fr ; `data/prelevements.json` format compact `especes[espèce][département] = [valeur par année]` (null = pas de donnée) et `nationales[espèce] = [valeur par année]`

## Limites des données
- Espèces : cerf, chamois, chevreuil, isard, sanglier (départemental) et mouflon (national uniquement : absent de la carte, visible dans la courbe « France entière »). On peut en cocher plusieurs : la carte affiche leur somme par département, le graphique une courbe par espèce.
- Pour ajouter une espèce : déposer son export dans `data/raw/` puis relancer `build_data.py`.
- Corse (2A/2B) absente ; beaucoup de départements manquent les premières années (gris = pas de donnée, distinct de 0).
- Mesure : prélèvements totaux. Valeur étrange non corrigée : 1999, département 45 (réalisations > attributions).
- Échelle de couleurs fixe sur toutes les années (racine carrée) pour comparer les années entre elles.

Source : data.gouv.fr — Évolution des tableaux de chasse départementaux du grand gibier. Fond : gregoiredavid/france-geojson.
