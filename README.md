# Flask Music Player

## Project structure

- `app.py` - Flask backend and API routes
- `templates/index.html` - main UI markup
- `static/css/styles.css` - dark responsive styling
- `static/js/app.js` - frontend logic (fetch + player + queue)
- `uploads/` - uploaded audio files
- `instance/tracks.json` - persisted track metadata
- `instance/queue.json` - persisted queue

## Setup

1. Create and activate virtual environment (optional but recommended).
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the app:

```bash
python app.py
```

4. Open:

`http://127.0.0.1:5000/`

## Desktop build (Windows)

The project includes desktop packaging files:

- `desktop.py` - starts Flask and opens a native window
- `Sapphire.spec` - PyInstaller spec
- `build.bat` - one-click build script
- `requirements-desktop.txt` - dependencies for desktop build

Run:

```bash
build.bat
```

Result:

- `dist/Sapphire/Sapphire.exe`

## Deploy as a public website (not only localhost)

Sapphire can run behind HTTPS on a VPS (Linux) with PostgreSQL, optional S3 storage, and gunicorn. See **`docs/ДЕПЛОЙ-В-ИНТЕРНЕТЕ-RU.md`** (Russian). Production deps: `pip install -r requirements-prod.txt`, then e.g. `gunicorn -w 4 -b 127.0.0.1:8000 wsgi:app` behind Caddy/nginx.

Set `FLASK_SECRET_KEY`, `SESSION_COOKIE_SECURE=true`, and `SAPPHIRE_BEHIND_PROXY=true` when using a reverse proxy.

## Notes

- Allowed uploads: `.mp3`, `.wav`
- Max upload size: 25 MB
- Missing metadata falls back to filename / "Unknown artist"
