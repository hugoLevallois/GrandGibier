#!/usr/bin/env python3
"""Convertit les exports data.gouv.fr (tableaux de chasse) en un fichier compact
data/prelevements.json lu par la carte.

Usage :
    python scripts/build_data.py [entrée.json] [sortie.json]

Par défaut : fusionne tous les .json de data/raw/ (un fichier par espèce) et écrit
data/prelevements.json. Pour ajouter une espèce, déposez simplement son export dans data/raw/.

Deux formats d'export sont gérés :
  - départemental (champ "departement") -> especes[espèce][département] = [valeur par année]
  - national uniquement (ex. mouflon)   -> nationales[espèce] = [valeur par année]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Noms affichés (clé = valeur du champ "espece" dans l'export)
LABELS = {"cerf elaphe": "cerf"}


def main():
    if len(sys.argv) > 1:
        sources = [Path(sys.argv[1])]
    else:
        sources = sorted((ROOT / "data" / "raw").glob("*.json"))
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "data" / "prelevements.json"
    if not sources:
        sys.exit("Aucun fichier .json trouvé dans data/raw/")

    rows = []
    for src in sources:
        rows.extend(json.loads(src.read_text(encoding="utf-8")))

    y0 = min(r["annee"] for r in rows)
    n = max(r["annee"] for r in rows) - y0 + 1
    years = list(range(y0, y0 + n))

    especes, nationales = {}, {}
    for r in rows:
        name = LABELS.get(r["espece"], r["espece"])
        if "departement" in r:
            code = str(r["departement"]).zfill(2)  # garde les zéros initiaux ("01")
            arr = especes.setdefault(name, {}).setdefault(code, [None] * n)
            arr[r["annee"] - y0] = r.get("departemental_prélèvements_totaux")
        else:
            arr = nationales.setdefault(name, [None] * n)
            arr[r["annee"] - y0] = r.get("national_prélèvements_totaux")

    out = {
        "mesure": "prélèvements totaux",
        "source": "https://www.data.gouv.fr/datasets/evolution-des-tableaux-de-chasse-departementaux-du-grand-gibier-en-france-donnees-depuis-1973-2",
        "years": years,
        "especes": {k: dict(sorted(v.items())) for k, v in sorted(especes.items())},
        "nationales": dict(sorted(nationales.items())),
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"{len(rows)} lignes → {out_path} ({out_path.stat().st_size / 1024:.0f} Ko)")
    print(f"Années {years[0]}–{years[-1]}")
    print("Départementales :", {k: len(v) for k, v in out["especes"].items()})
    print("Nationales seulement :", list(out["nationales"]))


if __name__ == "__main__":
    main()
