from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import UTC, datetime

import librosa
import numpy as np
import redis as redis_lib
from scipy.fft import irfft, rfft
from scipy.linalg import hadamard

import web
from celeredis import BROKER_URL, RESULT_BACKEND
from celeredis import app as celery_app
from WatermarkConfig import WatermarkConfig


def init_clients():
    clients = {
        "broker": redis_lib.from_url(BROKER_URL),
        "result": redis_lib.from_url(RESULT_BACKEND),
    }

    return clients


@dataclass(frozen=True)
class AudioEncoder:
    name: str = "python-app"

    def run(self) -> str:
        timestamp = datetime.now(UTC).isoformat(timespec="seconds")

        # Load the file and resample it
        audio, sr = librosa.load("src/test.wav", sr=WatermarkConfig.sample_rate)

        # FFT to convert to frequency bins
        freq_data = rfft(audio[: WatermarkConfig.chunk_size])

        return f"{self.name} is running through Bun at {timestamp}"


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

    app = AudioEncoder()
    print(app.run())

    web.logging.basicConfig(level=web.logging.INFO)
    flask_app = web.create_app()
    # Development server - for production run behind a WSGI server
    flask_app.run(host="0.0.0.0", port=5000, debug=False)


if __name__ == "__main__":
    main()
