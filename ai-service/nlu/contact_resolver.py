"""Resolve voice aliases to phone identifiers from local JSON."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path


def _data_path() -> Path:
    env = os.environ.get("CONTACTS_JSON_PATH", "").strip()
    if env:
        return Path(env)
    base = Path(__file__).resolve().parent.parent / "data" / "contacts.json"
    return base


def _load_map() -> dict[str, str]:
    path = _data_path()
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k).lower(): str(v) for k, v in raw.items()}


def _looks_like_number(value: str) -> bool:
    s = value.strip()
    return bool(re.match(r"^\+?\d[\d\s\-]{5,}$", s))


def resolve(alias: str | None) -> str | None:
    """Résout un alias en identifiant.

    - Si l'alias est déjà un numéro : on le normalise.
    - Sinon (nom de contact) : renvoie None si l'alias n'est pas dans la map.
      La résolution nom -> numéro doit se faire sur l'appareil (vrai carnet
      d'adresses), JAMAIS via une table de numéros personnels codée en dur côté
      serveur — sous peine d'envoyer l'argent au mauvais numéro. `contacts.json`
      reste vide par défaut (réservé aux éventuels alias de facturiers via
      CONTACTS_JSON_PATH).
    """
    if not alias or not str(alias).strip():
        return None
    s = str(alias).strip()
    if _looks_like_number(s):
        return re.sub(r"[\s\-]", "", s)
    m = _load_map()
    return m.get(s.lower())
