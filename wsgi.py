"""Точка входа для production-сервера (gunicorn, uWSGI и т.п.).

  gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app

Перед запуском задайте переменные окружения (см. docs/ДЕПЛОЙ-В-ИНТЕРНЕТЕ-RU.md).
"""

from app import app

__all__ = ["app"]
