from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import librosa
import numpy as np
from scipy.fft import irfft, rfft
from scipy.linalg import hadamard

from WatermarkConfig import WatermarkConfig


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
    app = AudioEncoder()
    print(app.run())


if __name__ == "__main__":
    main()
