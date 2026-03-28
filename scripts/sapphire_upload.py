#!/usr/bin/env python3
"""
Логин в Sapphire API и загрузка трека одной командой (cookie обрабатывается сама).

Пример:
  python scripts/sapphire_upload.py --file track.mp3
  python scripts/sapphire_upload.py -b https://example.com -u admin -p secret -f track.wav

Переменные окружения (если флаги не заданы):
  SAPPHIRE_BASE_URL, SAPPHIRE_USERNAME, SAPPHIRE_PASSWORD
"""

from __future__ import annotations

import argparse
import json
import os
import sys

try:
    import requests
except ImportError:
    print("Нужен пакет requests: pip install requests", file=sys.stderr)
    sys.exit(1)


def main() -> int:
    p = argparse.ArgumentParser(description="Sapphire: логин + загрузка файла")
    p.add_argument(
        "--base-url",
        "-b",
        default=os.environ.get("SAPPHIRE_BASE_URL", "http://127.0.0.1:5000"),
        help="Базовый URL сервера",
    )
    p.add_argument("-u", "--username", default=os.environ.get("SAPPHIRE_USERNAME", "admin"))
    p.add_argument("-p", "--password", default=os.environ.get("SAPPHIRE_PASSWORD", ""))
    p.add_argument("-f", "--file", required=True, help="Путь к .mp3 или .wav")
    args = p.parse_args()

    if not args.password:
        print("Укажите пароль: -p или SAPPHIRE_PASSWORD", file=sys.stderr)
        return 1

    base = args.base_url.rstrip("/")
    s = requests.Session()

    r = s.post(
        f"{base}/api/auth/login",
        json={"username": args.username, "password": args.password},
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    if r.status_code != 200:
        try:
            err = r.json().get("error", r.text)
        except Exception:
            err = r.text
        print(f"Логин не удался ({r.status_code}): {err}", file=sys.stderr)
        return 1

    me = s.get(f"{base}/api/auth/session", timeout=30)
    me.raise_for_status()
    print("Сессия получена:", json.dumps(me.json(), ensure_ascii=False))

    path = args.file
    with open(path, "rb") as f:
        up = s.post(f"{base}/upload", files={"file": (os.path.basename(path), f)}, timeout=300)

    if up.status_code not in (200, 201):
        try:
            err = up.json().get("error", up.text)
        except Exception:
            err = up.text
        print(f"Загрузка не удалась ({up.status_code}): {err}", file=sys.stderr)
        return 1

    print("Трек загружен:", json.dumps(up.json(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
