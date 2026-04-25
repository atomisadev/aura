from __future__ import annotations

import sys

import librosa
import redis as redis_lib

import web
from celeredis import BROKER_URL, RESULT_BACKEND
from celeredis import app as celery_app
from WaterMarker import WaterMarker


def init_clients():
    clients = {
        "broker": redis_lib.from_url(BROKER_URL),
        "result": redis_lib.from_url(RESULT_BACKEND),
    }

    return clients


def main() -> None:
    clients = init_clients()
    try:
        worker_ping = celery_app.control.ping(timeout=1.0)
        if worker_ping:
            print("Live Celery workers responded:", worker_ping)
        else:
            print(
                "No Celery worker responses (no workers running or not reachable).",
                file=sys.stderr,
            )
    except Exception as e:
        print("Error while pinging Celery workers:", e, file=sys.stderr)

    web.logging.basicConfig(level=web.logging.INFO)
    flask_app = web.create_app()
    # Development server - for production run behind a WSGI server
    flask_app.run(host="0.0.0.0", port=5000, debug=False)


if __name__ == "__main__":
    main()
