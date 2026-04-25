from __future__ import annotations

import io
import logging
import urllib.request
import uuid
from typing import Optional

from flask import Flask, Response, jsonify, request
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
        file_obj = None

        if request.is_json:
            payload = request.get_json(silent=True) or {}
            file_url = payload.get("file_url") or payload.get("s3_url")
            if file_url:
                try:
                    req = urllib.request.Request(
                        file_url, headers={"User-Agent": "Mozilla/5.0"}
                    )
                    with urllib.request.urlopen(req) as resp:
                        data_bytes = resp.read()
                except Exception as exc:
                    LOG.exception("Failed to download file from URL")
                    return jsonify(
                        {
                            "error": "failed to download file from URL",
                            "detail": str(exc),
                        }
                    ), 400

        if data_bytes is None and "file" in request.files:
            file_obj = request.files["file"]
            try:
                data_bytes = file_obj.read()
            except Exception as exc:
                LOG.exception("Failed to read uploaded file")
                return jsonify(
                    {"error": "failed to read uploaded file", "detail": str(exc)}
                ), 400

        if data_bytes is None and request.data and not request.is_json:
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

        # Block until the Celery task finishes (timeout in seconds)
        TIMEOUT_SECONDS = 10
        try:
            task_result = async_result.get(timeout=TIMEOUT_SECONDS)
        except Exception as exc:
            LOG.exception("Task failed or timed out: %s", exc)
            # Optionally clean up stored input key
            try:
                redis_client.delete(key)
            except Exception:
                LOG.exception("Failed to delete input redis key after timeout/failure")
            return jsonify(
                {"error": "task failed or timed out", "detail": str(exc)}
            ), 500

        # Expect the task to return a dict containing 'output_key'
        output_key = None
        if isinstance(task_result, dict):
            output_key = (
                task_result.get("output_key")
                or task_result.get("outputKey")
                or task_result.get("output")
            )
        if not output_key:
            LOG.error("Task completed but did not return output_key: %s", task_result)
            return jsonify(
                {"error": "no output produced", "task_result": task_result}
            ), 500

        try:
            output_bytes = redis_client.get(output_key)
        except Exception as exc:
            LOG.exception("Failed to fetch output from redis: %s", exc)
            return jsonify({"error": "failed to fetch output", "detail": str(exc)}), 500

        if not output_bytes:
            return jsonify(
                {"error": "output not found in redis", "output_key": output_key}
            ), 404

        # Optionally delete stored keys to clean up
        try:
            redis_client.delete(key)
        except Exception:
            pass

        filename = getattr(file_obj, "filename", None) or f"{output_key}.wav"

        # Return the watermarked audio directly in the response
        return Response(
            output_bytes,
            mimetype="audio/wav",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @app.route("/decode", methods=["POST"])
    def decode_audio():

        data_bytes: Optional[bytes] = None

        if request.is_json:
            payload = request.get_json(silent=True) or {}
            file_url = payload.get("file_url") or payload.get("s3_url")
            if file_url:
                try:
                    req = urllib.request.Request(
                        file_url, headers={"User-Agent": "Mozilla/5.0"}
                    )
                    with urllib.request.urlopen(req) as resp:
                        data_bytes = resp.read()
                except Exception as exc:
                    LOG.exception("Failed to download file from URL")
                    return jsonify(
                        {
                            "error": "failed to download file from URL",
                            "detail": str(exc),
                        }
                    ), 400

        if data_bytes is None and "file" in request.files:
            file_obj = request.files["file"]
            try:
                data_bytes = file_obj.read()
            except Exception as exc:
                LOG.exception("Failed to read uploaded file")
                return jsonify(
                    {"error": "failed to read uploaded file", "detail": str(exc)}
                ), 400

        if data_bytes is None and request.data and not request.is_json:
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
            async_result = celery_app.send_task("decoder.compute", args=[key])
            task_id = getattr(async_result, "id", None)
        except Exception as exc:
            LOG.exception("Failed to send task to celery")
            try:
                redis_client.delete(key)
            except Exception:
                LOG.exception("Failed to delete redis key after send_task failure")
            return jsonify({"error": "failed to enqueue task", "detail": str(exc)}), 500

        # Block until the Celery task finishes (timeout in seconds)
        TIMEOUT_SECONDS = 10
        try:
            task_result = async_result.get(timeout=TIMEOUT_SECONDS)
        except Exception as exc:
            LOG.exception("Task failed or timed out: %s", exc)
            # Optionally clean up stored input key
            try:
                redis_client.delete(key)
            except Exception:
                LOG.exception("Failed to delete input redis key after timeout/failure")
            return jsonify(
                {"error": "task failed or timed out", "detail": str(exc)}
            ), 500

        message = None
        if isinstance(task_result, dict):
            message = task_result.get("message")

        return jsonify({"message": message, "task_id": task_id}), 200

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
