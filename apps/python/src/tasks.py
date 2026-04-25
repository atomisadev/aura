from __future__ import annotations

import io
import logging
import os
import uuid
from typing import Any, Dict, Optional, Tuple

import redis as redis_lib
from celery import states
from celery.exceptions import Ignore

from celeredis import RESULT_BACKEND, app
from WaterMarker import WaterMarker

LOG = logging.getLogger(__name__)
if not LOG.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    LOG.addHandler(handler)
LOG.setLevel(os.environ.get("LOG_LEVEL", "INFO"))


INPUT_DIR = "input"
OUTPUT_DIR = "output"
INPUT_FILENAME = "test2.wav"  # WaterMarker.encode_chunk expects input/test2.wav
OUTPUT_FILENAME = "watermarked_output.wav"  # WaterMarker writes to output/this file
OUTPUT_KEY_PREFIX = "aura:audio:out:"  # prefix for storing results in Redis
DEFAULT_TTL = 60 * 60  # 1 hour TTL for stored blobs


def _ensure_dirs() -> None:
    os.makedirs(INPUT_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def _create_redis_client():
    if redis_lib is None:
        LOG.error("redis package not installed; cannot create Redis client")
        return None
    try:
        client = redis_lib.from_url(RESULT_BACKEND)
        return client
    except Exception as exc:
        LOG.exception("Failed to create redis client from RESULT_BACKEND: %s", exc)
        return None


def _fetch_from_redis(client: "redis_lib.Redis", key: str):
    try:
        data = client.get(key)
        if data is None:
            LOG.warning("No data found in redis for key %s", key)
            return None
        return data
    except Exception:
        LOG.exception("Failed to fetch key %s from redis", key)
        return None


def _store_to_redis(
    client: "redis_lib.Redis", data: bytes, ttl: int = DEFAULT_TTL
) -> str:
    out_key = OUTPUT_KEY_PREFIX + uuid.uuid4().hex
    try:
        client.set(name=out_key, value=data, ex=ttl)
        return out_key
    except Exception:
        LOG.exception("Failed to store output to redis under key %s", out_key)
        raise


@app.task(bind=True, name="encoder.compute")
def compute_encode(self, payload: Any) -> Dict[str, Any]:
    LOG.info("Task encoder.compute started (id=%s)", getattr(self.request, "id", None))

    _ensure_dirs()

    input_bytes: Optional[bytes] = None
    input_redis_key: Optional[str] = None
    filename_hint: Optional[str] = None

    if isinstance(payload, dict):
        input_redis_key = (
            payload.get("redis_key") or payload.get("data_key") or payload.get("key")
        )
        filename_hint = payload.get("filename") or payload.get("name")
    elif isinstance(payload, str):
        # Treat as redis key
        input_redis_key = payload
    elif isinstance(payload, (bytes, bytearray)):
        input_bytes = bytes(payload)
    else:
        LOG.warning("Unsupported payload type: %s", type(payload))
        try:
            if hasattr(payload, "read"):
                input_bytes = payload.read()
        except Exception:
            input_bytes = None

    redis_client = _create_redis_client()

    if input_bytes is None and input_redis_key:
        if redis_client is None:
            LOG.error("No redis client available to fetch key %s", input_redis_key)
            self.update_state(
                state=states.FAILURE, meta={"exc": "redis client unavailable"}
            )
            raise Ignore()
        data = _fetch_from_redis(redis_client, input_redis_key)
        if data is None:
            LOG.error("No data at redis key %s", input_redis_key)
            self.update_state(
                state=states.FAILURE, meta={"exc": f"no data at key {input_redis_key}"}
            )
            raise Ignore()
        input_bytes = data

    if input_bytes is None:
        LOG.error("No audio payload available to process")
        self.update_state(state=states.FAILURE, meta={"exc": "no input audio"})
        raise Ignore()

    # Write input bytes to the file path expected by WaterMarker
    input_path = os.path.join(INPUT_DIR, INPUT_FILENAME)
    try:
        with open(input_path, "wb") as f:
            f.write(input_bytes)
        LOG.info("Wrote input audio to %s", input_path)
    except Exception:
        LOG.exception("Failed to write input bytes to %s", input_path)
        self.update_state(
            state=states.FAILURE, meta={"exc": "failed to write input file"}
        )
        raise Ignore()

    try:
        wm = WaterMarker()
    except Exception:
        LOG.exception(
            "Failed to initialize WaterMarker (check SECRET_KEY and dependencies)"
        )
        self.update_state(
            state=states.FAILURE, meta={"exc": "watermarker init failure"}
        )
        raise Ignore()

    try:
        result_message = wm.encode_chunk()
        LOG.info("WaterMarker.encode_chunk completed: %s", result_message)
    except Exception:
        LOG.exception("WaterMarker.encode_chunk failed")
        self.update_state(
            state=states.FAILURE, meta={"exc": "watermarker encode failure"}
        )
        raise Ignore()

    output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILENAME)
    try:
        with open(output_path, "rb") as f:
            output_bytes = f.read()
    except Exception:
        LOG.exception("Failed to read output file %s", output_path)
        self.update_state(
            state=states.FAILURE, meta={"exc": "failed to read output file"}
        )
        raise Ignore()

    if redis_client is None:
        LOG.warning("Redis client unavailable; not storing output to redis.")
        return {
            "task_id": getattr(self.request, "id", None),
            "input_key": input_redis_key,
            "output_path": output_path,
            "message": result_message,
        }

    try:
        out_key = _store_to_redis(redis_client, output_bytes)
        LOG.info("Stored output to redis key %s", out_key)
    except Exception as exc:
        LOG.exception("Failed to store output to redis: %s", exc)
        self.update_state(state=states.FAILURE, meta={"exc": "failed to store output"})
        raise Ignore()

    try:
        if input_redis_key:
            redis_client.delete(input_redis_key)
            LOG.info("Deleted input redis key %s after processing", input_redis_key)
    except Exception:
        LOG.exception("Failed to delete input redis key %s", input_redis_key)

    return {
        "task_id": getattr(self.request, "id", None),
        "input_key": input_redis_key,
        "output_key": out_key,
        "message": result_message,
    }


@app.task(bind=True, name="decoder.compute")
def compute_decode(self, payload: Any) -> Dict[str, Any]:
    LOG.info("Task decoder.compute started (id=%s)", getattr(self.request, "id", None))

    _ensure_dirs()

    input_bytes: Optional[bytes] = None
    input_redis_key: Optional[str] = None

    if isinstance(payload, dict):
        input_redis_key = (
            payload.get("redis_key") or payload.get("data_key") or payload.get("key")
        )
    elif isinstance(payload, str):
        # Treat as redis key
        input_redis_key = payload
    elif isinstance(payload, (bytes, bytearray)):
        input_bytes = bytes(payload)
    else:
        LOG.warning("Unsupported payload type: %s", type(payload))
        try:
            if hasattr(payload, "read"):
                input_bytes = payload.read()
        except Exception:
            input_bytes = None

    redis_client = _create_redis_client()

    if input_bytes is None and input_redis_key:
        if redis_client is None:
            LOG.error("No redis client available to fetch key %s", input_redis_key)
            self.update_state(
                state=states.FAILURE, meta={"exc": "redis client unavailable"}
            )
            raise Ignore()
        data = _fetch_from_redis(redis_client, input_redis_key)
        if data is None:
            LOG.error("No data at redis key %s", input_redis_key)
            self.update_state(
                state=states.FAILURE, meta={"exc": f"no data at key {input_redis_key}"}
            )
            raise Ignore()
        input_bytes = data

    if input_bytes is None:
        LOG.error("No audio payload available to process")
        self.update_state(state=states.FAILURE, meta={"exc": "no input audio"})
        raise Ignore()

    # Write input bytes to the file path expected by WaterMarker for decoding
    input_path = os.path.join(OUTPUT_DIR, OUTPUT_FILENAME)
    try:
        with open(input_path, "wb") as f:
            f.write(input_bytes)
        LOG.info("Wrote input audio to %s", input_path)
    except Exception:
        LOG.exception("Failed to write input bytes to %s", input_path)
        self.update_state(
            state=states.FAILURE, meta={"exc": "failed to write input file"}
        )
        raise Ignore()

    try:
        wm = WaterMarker()
    except Exception:
        LOG.exception(
            "Failed to initialize WaterMarker (check SECRET_KEY and dependencies)"
        )
        self.update_state(
            state=states.FAILURE, meta={"exc": "watermarker init failure"}
        )
        raise Ignore()

    try:
        result_message = wm.decode_chunk()
        LOG.info("WaterMarker.decode_chunk completed: %s", result_message)
    except Exception:
        LOG.exception("WaterMarker.decode_chunk failed")
        self.update_state(
            state=states.FAILURE, meta={"exc": "watermarker decode failure"}
        )
        raise Ignore()

    try:
        if input_redis_key and redis_client:
            redis_client.delete(input_redis_key)
            LOG.info("Deleted input redis key %s after processing", input_redis_key)
    except Exception:
        LOG.exception("Failed to delete input redis key %s", input_redis_key)

    return {
        "task_id": getattr(self.request, "id", None),
        "input_key": input_redis_key,
        "message": result_message,
    }
