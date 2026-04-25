from __future__ import annotations

import io
import logging
import uuid
from typing import Optional

from flask import Flask, jsonify, request
from werkzeug.datastructures import FileStorage

from celeredis import RESULT_BACKEND
from celeredis import app as celery_app

try:
    import redis as redis_lib
except Exception:
    redis_lib = None

LOG = logging.getLogger(__name__)
LOG.addHandler(logging.NullHandler())


DATA_TTL_SECONDS = 60 * 60
REDIS_KEY_PREFIX = "aura:audio:"


def create_app() -> Flask:
    app = Flask(__name__)

    if redis_lib is None:
        LOG.error(
            "redis package is not available; web endpoints that store blobs will fail"
        )

    @app.route("/upload", methods=["POST"])
    def upload_audio():

        data_bytes: Optional[bytes] = None

        if "file" in request.files:
            file_obj: FileStorage = request.files["file"]
            try:
                data_bytes = file_obj.read()
            except Exception as exc:
                LOG.exception("Failed to read uploaded file")
                return jsonify(
                    {"error": "failed to read uploaded file", "detail": str(exc)}
                ), 400

        if data_bytes is None and request.data:
            data_bytes = request.data

        if not data_bytes:
            return jsonify({"error": "no audio provided"}), 400

        if redis_lib is None:
            return jsonify({"error": "redis client not available on server"}), 500

        try:
            redis_client = redis_lib.from_url(RESULT_BACKEND)
        except Exception as exc:
            LOG.exception("Failed to create redis client from RESULT_BACKEND")
            return jsonify(
                {"error": "failed to connect to redis", "detail": str(exc)}
            ), 500

        key = REDIS_KEY_PREFIX + uuid.uuid4().hex
        try:
            redis_client.set(name=key, value=data_bytes, ex=DATA_TTL_SECONDS)
        except Exception as exc:
            LOG.exception("Failed to store audio blob in redis")
            return jsonify({"error": "failed to store audio", "detail": str(exc)}), 500

        try:
            async_result = celery_app.send_task("encoder.compute", args=[key])
            task_id = getattr(async_result, "id", None)
        except Exception as exc:
            LOG.exception("Failed to send task to celery")
            try:
                redis_client.delete(key)
            except Exception:
                LOG.exception("Failed to delete redis key after send_task failure")
            return jsonify({"error": "failed to enqueue task", "detail": str(exc)}), 500

        return jsonify({"task_id": task_id, "data_key": key}), 200

    @app.route("/test", methods=["POST"])
    def send_test():
        value = None
        if request.is_json:
            payload = request.get_json(silent=True) or {}
            value = payload.get("value")
        if value is None:
            value = request.form.get("value")
        if value is None:
            value = request.args.get("value", "hello")

        try:
            async_result = celery_app.send_task("test.ping", args=[value])
            task_id = getattr(async_result, "id", None)
        except Exception as exc:
            LOG.exception("Failed to enqueue test.ping")
            return jsonify(
                {"error": "failed to enqueue test task", "detail": str(exc)}
            ), 500

        return jsonify({"task_id": task_id, "value": value}), 202

    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    flask_app = create_app()
    # Development server - for production run behind a WSGI server
    flask_app.run(host="0.0.0.0", port=5000, debug=False)
