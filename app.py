import os
import uuid
from urllib.parse import quote_plus
from urllib.request import urlopen
import json
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory, url_for
from mutagen import File as MutagenFile
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
ALLOWED_EXTENSIONS = {"mp3", "wav"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 мегобайтов есть-же

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

Path(app.instance_path).mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

TRACKS_FILE = Path(app.instance_path) / "tracks.json"
QUEUE_FILE = Path(app.instance_path) / "queue.json"
PLAYLISTS_FILE = Path(app.instance_path) / "playlists.json"

#доделай я хз как дальше
def ensure_json_file(path: Path, default_value):
    if not path.exists():
        path.write_text(json.dumps(default_value, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path, default_value):
    ensure_json_file(path, default_value)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        path.write_text(json.dumps(default_value, ensure_ascii=False, indent=2), encoding="utf-8")
        return default_value


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def format_duration(seconds: float) -> str:
    total = int(seconds or 0)
    minutes = total // 60
    remainder = total % 60
    return f"{minutes}:{remainder:02d}"


def parse_filename_metadata(original_name: str):
    stem = Path(original_name).stem
    if " - " in stem:
        artist, title = stem.split(" - ", 1)
        return title.strip() or stem, artist.strip() or "Неизвестный чел"
    return stem, "Неизвестный чел"


def normalize_tag_value(value):
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        if not value:
            return ""
        return normalize_tag_value(value[0])
    text = getattr(value, "text", None)
    if isinstance(text, (list, tuple)) and text:
        return str(text[0]).strip()
    return str(value).strip()


def pick_tag(tags, keys, default=""):
    for key in keys:
        raw = None
        if hasattr(tags, "get"):
            raw = tags.get(key)
        if raw is None and hasattr(tags, "__contains__") and key in tags:
            raw = tags[key]
        value = normalize_tag_value(raw)
        if value:
            return value
    return default


def fetch_cover_url(artist: str, title: str):
    search_term = quote_plus(f"{artist} {title}".strip())
    if not search_term:
        return ""
    try:
        with urlopen(f"https://itunes.apple.com/search?term={search_term}&entity=song&limit=1", timeout=4) as response:
            payload = json.loads(response.read().decode("utf-8"))
            results = payload.get("results", [])
            if results:
                return results[0].get("artworkUrl100", "").replace("100x100bb", "300x300bb")
    except Exception:
        return ""
    return ""


def extract_track_metadata(filepath: Path, original_name: str):
    audio = MutagenFile(filepath)
    fallback_title, fallback_artist = parse_filename_metadata(original_name)

    if audio is None:
        return {
            "title": fallback_title,
            "artist": fallback_artist,
            "duration": 0,
        }

    title = fallback_title
    artist = fallback_artist
    duration = float(getattr(getattr(audio, "info", None), "length", 0) or 0)

    tags = getattr(audio, "tags", None)
    if tags:
        title = pick_tag(tags, ["title", "TIT2", "\xa9nam"], title)
        artist = pick_tag(tags, ["artist", "TPE1", "albumartist", "TPE2", "\xa9ART"], artist)

    return {
        "title": title.strip() or fallback_title,
        "artist": artist.strip() or fallback_artist or "Unknown artist",
        "duration": duration,
    }


def get_tracks():
    return read_json(TRACKS_FILE, [])


def save_tracks(tracks):
    write_json(TRACKS_FILE, tracks)


def get_queue():
    return read_json(QUEUE_FILE, [])


def save_queue(queue):
    write_json(QUEUE_FILE, queue)


def get_playlists():
    return read_json(PLAYLISTS_FILE, [])


def save_playlists(playlists):
    write_json(PLAYLISTS_FILE, playlists)

#какие расширения у файла брат?
def infer_audio_mime(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "wav":
        return "audio/wav"
    return "audio/mpeg"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/tracks", methods=["GET"])
def tracks():
    return jsonify(get_tracks())


@app.route("/tracks/<track_id>", methods=["DELETE"])
def delete_track(track_id):
    tracks_data = get_tracks()
    track_to_delete = next((item for item in tracks_data if item.get("id") == track_id), None)
    if not track_to_delete:
        return jsonify({"error": "Track not found"}), 404

    updated_tracks = [item for item in tracks_data if item.get("id") != track_id]
    save_tracks(updated_tracks)

    queue_data = get_queue()
    updated_queue = [item for item in queue_data if item.get("id") != track_id]
    save_queue(updated_queue)

    playlists = get_playlists()
    for playlist in playlists:
        playlist["tracks"] = [item for item in playlist.get("tracks", []) if item.get("id") != track_id]
    save_playlists(playlists)

    target_file = UPLOAD_DIR / track_to_delete.get("filename", "")
    if target_file.exists():
        try:
            target_file.unlink()
        except OSError:
            return jsonify({"error": "Track metadata removed, but file deletion failed"}), 500

    return jsonify({"ok": True, "track_id": track_id, "queue": updated_queue, "playlists": playlists}), 200


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    music_file = request.files["file"]
    if not music_file.filename:
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(music_file.filename):
        return jsonify({"error": "Only MP3 and WAV are allowed"}), 400

    cleaned_name = secure_filename(music_file.filename)
    unique_name = f"{uuid.uuid4().hex}_{cleaned_name}"
    target_path = UPLOAD_DIR / unique_name
    music_file.save(target_path)

    metadata = extract_track_metadata(target_path, cleaned_name)
    track_id = uuid.uuid4().hex
    track_payload = {
        "id": track_id,
        "filename": unique_name,
        "original_filename": cleaned_name,
        "title": metadata["title"],
        "artist": metadata["artist"],
        "duration": int(metadata["duration"]),
        "duration_label": format_duration(metadata["duration"]),
        "audio_url": url_for("audio", filename=unique_name),
        "search_hint": quote_plus(f"{metadata['artist']} {metadata['title']}"),
        "cover_url": fetch_cover_url(metadata["artist"], metadata["title"]),
    }

    tracks_data = get_tracks()
    tracks_data.append(track_payload)
    save_tracks(tracks_data)
    return jsonify(track_payload), 201


@app.route("/queue", methods=["GET", "POST"])
def queue():
    if request.method == "GET":
        return jsonify(get_queue())

    payload = request.get_json(silent=True) or {}
    action = payload.get("action")
    track_id = payload.get("track_id")
    queue_data = get_queue()
    tracks_data = get_tracks()
    tracks_map = {item["id"]: item for item in tracks_data}

    if action == "add":
        if track_id not in tracks_map:
            return jsonify({"error": "Track not found"}), 404
        queue_item = tracks_map[track_id].copy()
        queue_item["queue_item_id"] = uuid.uuid4().hex
        queue_data.append(queue_item)
        save_queue(queue_data)
        return jsonify(queue_data), 200

    if action == "remove":
        queue_item_id = payload.get("queue_item_id")
        if not queue_item_id:
            return jsonify({"error": "queue_item_id is required for removal"}), 400
        queue_data = [item for item in queue_data if item.get("queue_item_id") != queue_item_id]
        save_queue(queue_data)
        return jsonify(queue_data), 200

    if action == "replace":
        incoming = payload.get("queue", [])
        if not isinstance(incoming, list):
            return jsonify({"error": "queue must be a list"}), 400
        save_queue(incoming)
        return jsonify(incoming), 200

    return jsonify({"error": "Unsupported action"}), 400


@app.route("/playlists", methods=["GET", "POST"])
def playlists():
    if request.method == "GET":
        return jsonify(get_playlists())

    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    cover_url = str(payload.get("cover_url", "")).strip()
    if not name:
        return jsonify({"error": "Playlist name is required"}), 400

    data = get_playlists()
    playlist = {
        "id": uuid.uuid4().hex,
        "name": name,
        "cover_url": cover_url,
        "tracks": [],
    }
    data.append(playlist)
    save_playlists(data)
    return jsonify(playlist), 201


@app.route("/playlists/<playlist_id>", methods=["DELETE"])
def delete_playlist(playlist_id):
    data = get_playlists()
    playlist = next((item for item in data if item.get("id") == playlist_id), None)
    if not playlist:
        return jsonify({"error": "Playlist not found"}), 404

    updated = [item for item in data if item.get("id") != playlist_id]
    save_playlists(updated)
    return jsonify({"ok": True, "playlist_id": playlist_id, "playlists": updated}), 200


@app.route("/playlists/<playlist_id>/tracks", methods=["POST"])
def add_track_to_playlist(playlist_id):
    payload = request.get_json(silent=True) or {}
    track_id = payload.get("track_id")
    if not track_id:
        return jsonify({"error": "track_id is required"}), 400

    tracks_map = {item["id"]: item for item in get_tracks()}
    track = tracks_map.get(track_id)
    if not track:
        return jsonify({"error": "Track not found"}), 404

    data = get_playlists()
    playlist = next((item for item in data if item.get("id") == playlist_id), None)
    if not playlist:
        return jsonify({"error": "Playlist not found"}), 404

    existing_ids = {item.get("id") for item in playlist.get("tracks", [])}
    if track_id not in existing_ids:
        playlist.setdefault("tracks", []).append(track)
        if not playlist.get("cover_url"):
            playlist["cover_url"] = track.get("cover_url", "")
        save_playlists(data)

    return jsonify(playlist), 200


@app.route("/audio/<path:filename>")
def audio(filename):
    safe_name = os.path.basename(filename)
    audio_path = UPLOAD_DIR / safe_name
    if not audio_path.exists():
        return jsonify({"error": "File not found"}), 404

    return send_from_directory(
        directory=str(UPLOAD_DIR),
        path=safe_name,
        mimetype=infer_audio_mime(safe_name),
        as_attachment=False,
        conditional=True,
    )


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": f"File too large. Max size is {MAX_FILE_SIZE // (1024 * 1024)}MB"}), 413


@app.route("/health-image", methods=["GET"])
def health_image():
    with urlopen("data:text/plain,ok") as response:
        return jsonify({"status": response.read().decode("utf-8")})


if __name__ == "__main__":
    app.run(debug=True)
