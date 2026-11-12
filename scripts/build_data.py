#!/usr/bin/env python3
"""Convertit le JSON data.gouv.fr (tableaux de chasse départementaux)
en un fichier compact data/prelevements.json lu par la carte.

Usage :
    python scripts/build_data.py [entrée.json] [sortie.json]

Par défaut : prend le premier .json de data/raw/ et écrit data/prelevements.json.
Pour ajouter une espèce, déposez simplement un autre export dans data/raw/ :
tous les fichiers sont fusionnés.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MESURE = "departemental_prélèvements_totaux"


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

    years = sorted({r["annee"] for r in rows})
    y0 = years[0]
    n = years[-1] - y0 + 1
    years = list(range(y0, y0 + n))

    especes = {}
    for r in rows:
        code = str(r["departement"]).zfill(2)  # garde les zéros initiaux ("01")
        v = r.get(MESURE)
        arr = especes.setdefault(r["espece"], {}).setdefault(code, [None] * n)
        arr[r["annee"] - y0] = v

    out = {
        "mesure": MESURE,
        "source": "https://www.data.gouv.fr/datasets/evolution-des-tableaux-de-chasse-departementaux-du-grand-gibier-en-france-donnees-depuis-1973-2",
        "years": years,
        "especes": {k: dict(sorted(v.items())) for k, v in sorted(especes.items())},
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    nb_dep = {k: len(v) for k, v in out["especes"].items()}
    print(f"{len(rows)} lignes → {out_path} ({out_path.stat().st_size / 1024:.0f} Ko)")
    print(f"Années {years[0]}–{years[-1]} ; départements par espèce : {nb_dep}")


if __name__ == "__main__":
    main()
