from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from tkinter.constants import N

import dotenv
import librosa
import numpy as np
from scipy.fft import irfft, rfft
from scipy.linalg import hadamard

from WatermarkConfig import WatermarkConfig

dotenv.load_dotenv()

if os.getenv("SECRET_KEY") is None:
    raise ValueError("SECRET_KEY environment variable not set. Check your env")


@dataclass(frozen=True)
class AudioEncoder:
    name: str = "python-app"

    matrix: np.ndarray = field(init=False, repr=False)
    pn_mask: np.ndarray = field(init=False, repr=False)
    secret_indices: np.ndarray = field(init=False, repr=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "matrix", hadamard(WatermarkConfig.hadamard_size))

        mask_rng = np.random.default_rng(
            seed=int(os.getenv("SECRET_KEY", "676767676767"))
        )
        mask = mask_rng.choice([1, -1], size=WatermarkConfig.hadamard_size)
        object.__setattr__(self, "pn_mask", mask)

        indices = np.arange(WatermarkConfig.hadamard_size)
        mask_rng.shuffle(indices)
        object.__setattr__(
            self,
            "secret_indices",
            indices[: WatermarkConfig.num_bits],
        )

    def encode_chunk(self) -> str:
        timestamp = datetime.now(UTC).isoformat(timespec="seconds")

        # Load the file and resample it
        audio, _sr = librosa.load("src/test.wav", sr=WatermarkConfig.sample_rate)

        # FFT to convert to frequency bins
        freq_data = rfft(audio[: WatermarkConfig.chunk_size])
        magnitudes = np.abs(freq_data)  # type: ignore[assignment]
        phases = np.angle(freq_data)  # type: ignore[assignment]

        # Create bit string based off character
        char = ord(WatermarkConfig.hidden_character)
        bits = [int(char) for char in format(char, f"0{WatermarkConfig.num_bits}b")]
        signs = [1 if bit == 1 else -1 for bit in bits]

        # Take the secret indices and pull the targetted rows from matrix
        secret_rows = self.matrix[self.secret_indices]

        # Combine the rows into one code
        combined_code = np.zeros(WatermarkConfig.hadamard_size)
        for i in range(WatermarkConfig.num_bits):
            combined_code += signs[i] * secret_rows[i]

        # Reconstruct audio chunk into time domain using inverse FFT
        new_freq_data = magnitudes * np.exp(1j * phases)
        new_audio_chunk = irfft(new_freq_data)

        return f"{self.name} is running through Bun at {timestamp}"


def main() -> None:
    app = AudioEncoder()
    print(app.encode_chunk())


if __name__ == "__main__":
    main()
