#!/usr/bin/env python3
"""Télécharge le fond de carte des départements dans data/departements.geojson.

Source : https://github.com/gregoiredavid/france-geojson (version simplifiée)
"""
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson"
OUT = Path(__file__).resolve().parent.parent / "data" / "departements.geojson"

OUT.parent.mkdir(parents=True, exist_ok=True)
with urllib.request.urlopen(URL) as r:
    OUT.write_bytes(r.read())
print(f"OK → {OUT} ({OUT.stat().st_size / 1024:.0f} Ko)")
