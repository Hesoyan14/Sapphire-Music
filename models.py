"""SQLAlchemy-модели: пользователи, треки, плейлисты, очередь."""

from __future__ import annotations

from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    tracks = db.relationship("Track", back_populates="owner", lazy=True, cascade="all, delete-orphan")
    playlists = db.relationship("Playlist", back_populates="owner", lazy=True, cascade="all, delete-orphan")
    queue_items = db.relationship("QueueItem", back_populates="user", lazy=True, cascade="all, delete-orphan")


class Track(db.Model):
    __tablename__ = "tracks"

    id = db.Column(db.String(40), primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = db.Column(db.String(512), nullable=False, unique=True, index=True)
    storage_key = db.Column(db.String(1024), nullable=True)
    original_filename = db.Column(db.String(512), nullable=False)
    title = db.Column(db.String(512), nullable=False)
    artist = db.Column(db.String(512), nullable=False)
    duration = db.Column(db.Integer, default=0, nullable=False)
    cover_url = db.Column(db.Text, nullable=True)

    owner = db.relationship("User", back_populates="tracks")
    playlist_links = db.relationship("PlaylistTrack", back_populates="track", cascade="all, delete-orphan")
    queue_refs = db.relationship("QueueItem", back_populates="track", cascade="all, delete-orphan")


class Playlist(db.Model):
    __tablename__ = "playlists"

    id = db.Column(db.String(40), primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(256), nullable=False)
    cover_url = db.Column(db.Text, nullable=True)

    owner = db.relationship("User", back_populates="playlists")
    entries = db.relationship(
        "PlaylistTrack",
        back_populates="playlist",
        order_by="PlaylistTrack.position",
        cascade="all, delete-orphan",
    )


class PlaylistTrack(db.Model):
    __tablename__ = "playlist_tracks"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.String(40), db.ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    track_id = db.Column(db.String(40), db.ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False, default=0)

    playlist = db.relationship("Playlist", back_populates="entries")
    track = db.relationship("Track", back_populates="playlist_links")

    __table_args__ = (UniqueConstraint("playlist_id", "track_id", name="uq_playlist_track"),)


class QueueItem(db.Model):
    __tablename__ = "queue_items"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    queue_item_id = db.Column(db.String(64), nullable=False, unique=True, index=True)
    track_id = db.Column(db.String(40), db.ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False, default=0)

    user = db.relationship("User", back_populates="queue_items")
    track = db.relationship("Track", back_populates="queue_refs")
