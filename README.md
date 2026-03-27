# Flask Music Player

Dark-themed Flask music player with uploads, metadata extraction, queue, and bottom playback controls.

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

## Notes

- Allowed uploads: `.mp3`, `.wav`
- Max upload size: 25 MB
- Missing metadata falls back to filename / "Unknown artist"
