import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import urlopen
import json
import base64
import tempfile

from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, session, url_for
from mutagen import File as MutagenFile
from sqlalchemy import event, func
from sqlalchemy.engine import Engine
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from models import QueueItem, Playlist, PlaylistTrack, Track, User, db
from storage_backend import delete_audio_file, presigned_audio_url, save_upload_stream, s3_configured

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
ALLOWED_EXTENSIONS = {"mp3", "wav"}
MAX_FILE_SIZE = 25 * 1024 * 1024

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "sapphire-dev-secret-change-for-production")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
if os.environ.get("SESSION_COOKIE_SECURE", "").lower() in ("1", "true", "yes"):
    app.config["SESSION_COOKIE_SECURE"] = True

if os.environ.get("SAPPHIRE_BEHIND_PROXY", "").lower() in ("1", "true", "yes"):
    from werkzeug.middleware.proxy_fix import ProxyFix

    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=1,
        x_proto=1,
        x_host=1,
        x_port=1,
        x_prefix=1,
    )

Path(app.instance_path).mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_instance_db = Path(app.instance_path) / "sapphire.db"
_default_sqlite = "sqlite:///" + str(_instance_db.resolve()).replace("\\", "/")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", _default_sqlite)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)


@event.listens_for(Engine, "connect")
def _sqlite_enable_fk(dbapi_connection, _connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


def ensure_json_file(path: Path, default_value):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(default_value, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path, default_value):
    ensure_json_file(path, default_value)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        path.write_text(json.dumps(default_value, ensure_ascii=False, indent=2), encoding="utf-8")
        return default_value


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
    artist_text = str(artist or "").strip()
    title_text = str(title or "").strip()
    terms = [
        f"{artist_text} {title_text}".strip(),
        title_text,
        artist_text,
    ]
    for term in terms:
        if not term:
            continue
        try:
            search_term = quote_plus(term)
            with urlopen(f"https://itunes.apple.com/search?term={search_term}&entity=song&limit=1", timeout=0.6) as response:
                payload = json.loads(response.read().decode("utf-8"))
                results = payload.get("results", [])
                if results:
                    return results[0].get("artworkUrl100", "").replace("100x100bb", "300x300bb")
        except Exception:
            continue
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


def extract_embedded_cover_data_url(filepath: Path) -> str:
    try:
        audio = MutagenFile(filepath)
    except Exception:
        return ""

    if audio is None:
        return ""

    tags = getattr(audio, "tags", None)
    if not tags:
        return ""

    candidates = []
    if hasattr(tags, "keys"):
        for key in tags.keys():
            key_str = str(key)
            if key_str.startswith("APIC") or key_str.lower() == "covr":
                value = tags.get(key)
                if value is not None:
                    candidates.append(value)

    for item in candidates:
        mime = "image/jpeg"
        raw = b""

        if hasattr(item, "data"):
            raw = getattr(item, "data", b"") or b""
            mime = str(getattr(item, "mime", mime) or mime)
        elif isinstance(item, (list, tuple)) and item:
            first = item[0]
            if isinstance(first, bytes):
                raw = first
                mime = "image/jpeg"
        elif isinstance(item, bytes):
            raw = item
            mime = "image/jpeg"

        if not raw:
            continue

        encoded = base64.b64encode(raw).decode("ascii")
        return f"data:{mime};base64,{encoded}"

    return ""


def infer_audio_mime(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "wav":
        return "audio/wav"
    return "audio/mpeg"


def get_current_user_id():
    if not session.get("logged_in"):
        return None
    uid = session.get("user_id")
    if uid is not None:
        return uid
    un = session.get("username")
    if un:
        u = User.query.filter_by(username=un).first()
        if u:
            session["user_id"] = u.id
            return u.id
    return None


def track_to_dict(track: Track):
    dur = float(track.duration or 0)
    return {
        "id": track.id,
        "filename": track.filename,
        "original_filename": track.original_filename,
        "title": track.title,
        "artist": track.artist,
        "duration": int(track.duration or 0),
        "duration_label": format_duration(dur),
        "audio_url": url_for("audio", filename=track.filename),
        "search_hint": quote_plus(f"{track.artist} {track.title}"),
        "cover_url": track.cover_url or "",
    }


def playlist_to_dict(playlist: Playlist):
    entries = sorted(playlist.entries, key=lambda e: e.position)
    return {
        "id": playlist.id,
        "name": playlist.name,
        "cover_url": playlist.cover_url or "",
        "tracks": [track_to_dict(e.track) for e in entries],
    }


def queue_rows_for_user(user_id: int):
    items = (
        QueueItem.query.filter_by(user_id=user_id)
        .order_by(QueueItem.position.asc())
        .all()
    )
    out = []
    for row in items:
        d = track_to_dict(row.track)
        d["queue_item_id"] = row.queue_item_id
        out.append(d)
    return out


def ensure_bootstrap_user():
    if User.query.count() > 0:
        return
    name = os.environ.get("SAPPHIRE_BOOTSTRAP_USERNAME", "admin")
    pwd = os.environ.get("SAPPHIRE_BOOTSTRAP_PASSWORD", "admin")
    user = User(username=name, password_hash=generate_password_hash(pwd))
    db.session.add(user)
    db.session.commit()


def migrate_legacy_json():
    """Импорт из tracks.json / playlists.json / queue.json при пустой БД (один раз)."""
    marker = Path(app.instance_path) / ".legacy_json_imported"
    if marker.exists():
        return
    if Track.query.count() > 0:
        marker.write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
        return

    user = User.query.filter_by(username=os.environ.get("SAPPHIRE_BOOTSTRAP_USERNAME", "admin")).first()
    if not user:
        return

    tracks_path = Path(app.instance_path) / "tracks.json"
    playlists_path = Path(app.instance_path) / "playlists.json"
    queue_path = Path(app.instance_path) / "queue.json"

    if not tracks_path.exists() and not playlists_path.exists() and not queue_path.exists():
        marker.write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")
        return

    tracks_data = read_json(tracks_path, []) if tracks_path.exists() else []
    if isinstance(tracks_data, list):
        for item in tracks_data:
            if not isinstance(item, dict) or not item.get("id"):
                continue
            fn = str(item.get("filename") or "").strip()
            if not fn:
                fn = f"{uuid.uuid4().hex}_legacy.mp3"
            sk = None
            path = UPLOAD_DIR / fn if fn else None
            if fn and path and path.exists():
                with open(path, "rb") as f:
                    _, sk = save_upload_stream(fn, f, UPLOAD_DIR)
            elif fn and not (path and path.exists()):
                pass
            tr = Track(
                id=item["id"],
                owner_id=user.id,
                filename=fn or f"missing_{item['id']}",
                storage_key=sk,
                original_filename=str(item.get("original_filename") or fn or "track"),
                title=str(item.get("title") or "Track"),
                artist=str(item.get("artist") or "Unknown artist"),
                duration=int(item.get("duration") or 0),
                cover_url=item.get("cover_url") or None,
            )
            db.session.add(tr)

    db.session.flush()

    playlists_data = read_json(playlists_path, []) if playlists_path.exists() else []
    if isinstance(playlists_data, list):
        for pl in playlists_data:
            if not isinstance(pl, dict) or not pl.get("id"):
                continue
            p = Playlist(id=pl["id"], owner_id=user.id, name=str(pl.get("name") or "Playlist"), cover_url=pl.get("cover_url") or None)
            db.session.add(p)
            for pos, t in enumerate(pl.get("tracks") or []):
                if not isinstance(t, dict) or not t.get("id"):
                    continue
                tid = t["id"]
                if Track.query.filter_by(id=tid, owner_id=user.id).first():
                    if not PlaylistTrack.query.filter_by(playlist_id=p.id, track_id=tid).first():
                        db.session.add(PlaylistTrack(playlist_id=p.id, track_id=tid, position=pos))

    db.session.flush()

    queue_data = read_json(queue_path, []) if queue_path.exists() else []
    if isinstance(queue_data, list):
        for pos, q in enumerate(queue_data):
            if not isinstance(q, dict) or not q.get("id"):
                continue
            tid = q["id"]
            if not Track.query.filter_by(id=tid, owner_id=user.id).first():
                continue
            qid = q.get("queue_item_id") or uuid.uuid4().hex
            db.session.add(QueueItem(user_id=user.id, queue_item_id=qid, track_id=tid, position=pos))

    db.session.commit()
    marker.write_text(datetime.now(timezone.utc).isoformat(), encoding="utf-8")


with app.app_context():
    db.create_all()
    ensure_bootstrap_user()
    migrate_legacy_json()


@app.before_request
def require_login():
    if request.endpoint is None:
        return None
    if request.endpoint in (
        "static",
        "index",
        "auth_session",
        "auth_login",
        "auth_logout",
        "auth_register",
        "health_image",
    ):
        return None
    if session.get("logged_in"):
        return None
    return jsonify({"error": "Unauthorized", "code": "auth_required"}), 401


@app.route("/api/auth/session", methods=["GET"])
def auth_session():
    return jsonify(
        {
            "authenticated": bool(session.get("logged_in")),
            "username": session.get("username") or "",
        }
    )


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        session["logged_in"] = True
        session["username"] = user.username
        session["user_id"] = user.id
        return jsonify({"ok": True, "username": user.username})
    return jsonify({"error": "Неверный логин или пароль"}), 401


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    if os.environ.get("SAPPHIRE_ALLOW_REGISTRATION", "").lower() not in ("1", "true", "yes"):
        return jsonify({"error": "Регистрация отключена"}), 403
    data = request.get_json(silent=True) or {}
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")
    if len(username) < 2 or len(password) < 4:
        return jsonify({"error": "Слишком короткий логин или пароль"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Такой пользователь уже есть"}), 409
    user = User(username=username, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    return jsonify({"ok": True, "username": username}), 201


@app.route("/")
def index():
    logged = bool(session.get("logged_in"))
    return render_template(
        "index.html",
        authed=logged,
        username=session.get("username") or "",
    )


@app.route("/tracks", methods=["GET"])
def tracks():
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    rows = Track.query.filter_by(owner_id=uid).order_by(Track.original_filename.asc()).all()
    changed = False
    cover_attempts = 0
    max_cover_attempts = 1

    for track in rows:
        title = str(track.title or Path(track.original_filename or "track").stem).strip()
        artist = str(track.artist or "Unknown artist").strip()
        if track.title != title:
            track.title = title
            changed = True
        if track.artist != artist:
            track.artist = artist
            changed = True

        if not track.cover_url:
            file_path = None
            if not track.storage_key:
                fp = UPLOAD_DIR / track.filename
                if fp.exists():
                    file_path = fp
            if file_path:
                local_cover = extract_embedded_cover_data_url(file_path)
                if local_cover:
                    track.cover_url = local_cover
                    changed = True
                    continue
            if cover_attempts < max_cover_attempts:
                cover_attempts += 1
                cover = fetch_cover_url(artist, title)
                if cover:
                    track.cover_url = cover
                    changed = True

    if changed:
        db.session.commit()

    return jsonify([track_to_dict(t) for t in rows])


@app.route("/tracks/<track_id>", methods=["DELETE"])
def delete_track(track_id):
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    track = Track.query.filter_by(id=track_id, owner_id=uid).first()
    if not track:
        return jsonify({"error": "Track not found"}), 404

    fn = track.filename
    sk = track.storage_key
    db.session.delete(track)
    db.session.commit()

    delete_audio_file(fn, sk, UPLOAD_DIR)

    q_updated = queue_rows_for_user(uid)
    playlists_out = [playlist_to_dict(p) for p in Playlist.query.filter_by(owner_id=uid).all()]
    return jsonify({"ok": True, "track_id": track_id, "queue": q_updated, "playlists": playlists_out}), 200


@app.route("/upload", methods=["POST"])
def upload():
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    music_file = request.files["file"]
    if not music_file.filename:
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(music_file.filename):
        return jsonify({"error": "Only MP3 and WAV are allowed"}), 400

    cleaned_name = secure_filename(music_file.filename)
    unique_name = f"{uuid.uuid4().hex}_{cleaned_name}"
    suffix = Path(cleaned_name).suffix or ".mp3"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = Path(tmp.name)
    try:
        music_file.save(str(tmp_path))
        metadata = extract_track_metadata(tmp_path, cleaned_name)
        local_cover = extract_embedded_cover_data_url(tmp_path)
        with open(tmp_path, "rb") as f:
            _, storage_key = save_upload_stream(unique_name, f, UPLOAD_DIR)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass

    track_id = uuid.uuid4().hex
    cover = local_cover or fetch_cover_url(metadata["artist"], metadata["title"])
    track = Track(
        id=track_id,
        owner_id=uid,
        filename=unique_name,
        storage_key=storage_key,
        original_filename=cleaned_name,
        title=metadata["title"],
        artist=metadata["artist"],
        duration=int(metadata["duration"]),
        cover_url=cover or None,
    )
    db.session.add(track)
    db.session.commit()
    return jsonify(track_to_dict(track)), 201


@app.route("/queue", methods=["GET", "POST"])
def queue():
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "GET":
        return jsonify(queue_rows_for_user(uid))

    payload = request.get_json(silent=True) or {}
    action = payload.get("action")
    track_id = payload.get("track_id")

    if action == "add":
        track = Track.query.filter_by(id=track_id, owner_id=uid).first()
        if not track:
            return jsonify({"error": "Track not found"}), 404
        max_pos = db.session.query(func.max(QueueItem.position)).filter_by(user_id=uid).scalar()
        next_pos = (max_pos if max_pos is not None else -1) + 1
        qid = uuid.uuid4().hex
        db.session.add(QueueItem(user_id=uid, queue_item_id=qid, track_id=track.id, position=next_pos))
        db.session.commit()
        return jsonify(queue_rows_for_user(uid)), 200

    if action == "remove":
        queue_item_id = payload.get("queue_item_id")
        if not queue_item_id:
            return jsonify({"error": "queue_item_id is required for removal"}), 400
        QueueItem.query.filter_by(user_id=uid, queue_item_id=queue_item_id).delete()
        db.session.commit()
        _reindex_queue(uid)
        return jsonify(queue_rows_for_user(uid)), 200

    if action == "replace":
        incoming = payload.get("queue", [])
        if not isinstance(incoming, list):
            return jsonify({"error": "queue must be a list"}), 400
        QueueItem.query.filter_by(user_id=uid).delete()
        for pos, item in enumerate(incoming):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            tid = item["id"]
            if not Track.query.filter_by(id=tid, owner_id=uid).first():
                continue
            qid = item.get("queue_item_id") or uuid.uuid4().hex
            db.session.add(QueueItem(user_id=uid, queue_item_id=qid, track_id=tid, position=pos))
        db.session.commit()
        return jsonify(queue_rows_for_user(uid)), 200

    return jsonify({"error": "Unsupported action"}), 400


def _reindex_queue(user_id: int):
    items = QueueItem.query.filter_by(user_id=user_id).order_by(QueueItem.position.asc()).all()
    for i, row in enumerate(items):
        row.position = i
    db.session.commit()


@app.route("/playlists", methods=["GET", "POST"])
def playlists():
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "GET":
        rows = Playlist.query.filter_by(owner_id=uid).order_by(Playlist.name.asc()).all()
        return jsonify([playlist_to_dict(p) for p in rows])

    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    cover_url = str(payload.get("cover_url", "")).strip()
    if not name:
        return jsonify({"error": "Playlist name is required"}), 400

    pl = Playlist(id=uuid.uuid4().hex, owner_id=uid, name=name, cover_url=cover_url or None)
    db.session.add(pl)
    db.session.commit()
    return jsonify(playlist_to_dict(pl)), 201


@app.route("/playlists/<playlist_id>", methods=["DELETE"])
def delete_playlist(playlist_id):
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    pl = Playlist.query.filter_by(id=playlist_id, owner_id=uid).first()
    if not pl:
        return jsonify({"error": "Playlist not found"}), 404

    db.session.delete(pl)
    db.session.commit()
    rest = [playlist_to_dict(p) for p in Playlist.query.filter_by(owner_id=uid).all()]
    return jsonify({"ok": True, "playlist_id": playlist_id, "playlists": rest}), 200


@app.route("/playlists/<playlist_id>/tracks", methods=["POST"])
def add_track_to_playlist(playlist_id):
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    track_id = payload.get("track_id")
    if not track_id:
        return jsonify({"error": "track_id is required"}), 400

    track = Track.query.filter_by(id=track_id, owner_id=uid).first()
    if not track:
        return jsonify({"error": "Track not found"}), 404

    pl = Playlist.query.filter_by(id=playlist_id, owner_id=uid).first()
    if not pl:
        return jsonify({"error": "Playlist not found"}), 404

    if PlaylistTrack.query.filter_by(playlist_id=pl.id, track_id=track_id).first():
        return jsonify(playlist_to_dict(pl)), 200

    max_pos = db.session.query(func.max(PlaylistTrack.position)).filter_by(playlist_id=pl.id).scalar()
    next_pos = (max_pos if max_pos is not None else -1) + 1
    db.session.add(PlaylistTrack(playlist_id=pl.id, track_id=track_id, position=next_pos))
    if not pl.cover_url:
        pl.cover_url = track.cover_url or ""
    db.session.commit()
    return jsonify(playlist_to_dict(pl)), 200


@app.route("/playlists/<playlist_id>/tracks/<track_id>", methods=["DELETE"])
def remove_track_from_playlist(playlist_id, track_id):
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    pl = Playlist.query.filter_by(id=playlist_id, owner_id=uid).first()
    if not pl:
        return jsonify({"error": "Playlist not found"}), 404

    row = PlaylistTrack.query.filter_by(playlist_id=pl.id, track_id=track_id).first()
    if not row:
        return jsonify({"error": "Track not in playlist"}), 404

    db.session.delete(row)
    db.session.flush()
    remaining = PlaylistTrack.query.filter_by(playlist_id=pl.id).order_by(PlaylistTrack.position.asc()).all()
    for i, e in enumerate(remaining):
        e.position = i
    if remaining:
        pl.cover_url = remaining[0].track.cover_url or ""
    else:
        pl.cover_url = ""
    db.session.commit()
    return jsonify(playlist_to_dict(Playlist.query.filter_by(id=playlist_id, owner_id=uid).first())), 200


@app.route("/audio/<path:filename>")
def audio(filename):
    uid = get_current_user_id()
    if uid is None:
        return jsonify({"error": "Unauthorized"}), 401

    safe_name = os.path.basename(filename)
    track = Track.query.filter_by(filename=safe_name).first()
    if not track or track.owner_id != uid:
        return jsonify({"error": "File not found"}), 404

    url = presigned_audio_url(track.storage_key)
    if url:
        return redirect(url)

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
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)
