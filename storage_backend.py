"""Сохранение аудио: локальная папка или S3-совместимое хранилище (R2, MinIO, AWS)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import BinaryIO, Optional, Tuple

from werkzeug.datastructures import FileStorage


def s3_configured() -> bool:
    return bool(os.environ.get("S3_BUCKET") and os.environ.get("S3_ACCESS_KEY") and os.environ.get("S3_SECRET_KEY"))


def _s3_client():
    import boto3

    endpoint = os.environ.get("S3_ENDPOINT") or None
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        region_name=os.environ.get("S3_REGION") or "auto",
    )


def save_upload_stream(
    unique_filename: str,
    stream: BinaryIO,
    upload_dir: Path,
) -> Tuple[str, Optional[str]]:
    """
    Возвращает (filename для /audio/..., storage_key или None).
    При настроенном S3 файл только в бакете; иначе — только на диске upload_dir.
    """
    bucket = os.environ.get("S3_BUCKET")
    key_prefix = (os.environ.get("S3_KEY_PREFIX") or "uploads").strip("/")

    if s3_configured() and bucket:
        storage_key = f"{key_prefix}/{unique_filename}"
        client = _s3_client()
        stream.seek(0)
        extra = {}
        ext = unique_filename.rsplit(".", 1)[-1].lower()
        if ext == "wav":
            extra["ContentType"] = "audio/wav"
        else:
            extra["ContentType"] = "audio/mpeg"
        client.upload_fileobj(stream, bucket, storage_key, ExtraArgs=extra)
        return unique_filename, storage_key

    stream.seek(0)
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / unique_filename).write_bytes(stream.read())
    return unique_filename, None


def save_upload_filestorage(unique_filename: str, file_storage: FileStorage, upload_dir: Path) -> Tuple[str, Optional[str]]:
    return save_upload_stream(unique_filename, file_storage.stream, upload_dir)


def delete_audio_file(filename: str, storage_key: Optional[str], upload_dir: Path) -> None:
    local = upload_dir / filename
    if local.exists():
        try:
            local.unlink()
        except OSError:
            pass
    if storage_key and s3_configured():
        bucket = os.environ["S3_BUCKET"]
        try:
            _s3_client().delete_object(Bucket=bucket, Key=storage_key)
        except Exception:
            pass


def presigned_audio_url(storage_key: Optional[str], expires: int = 3600) -> Optional[str]:
    if not storage_key or not s3_configured():
        return None
    bucket = os.environ["S3_BUCKET"]
    client = _s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": storage_key},
        ExpiresIn=expires,
    )
