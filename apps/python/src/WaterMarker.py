from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime

import dotenv
import librosa
import numpy as np
import soundfile as sf
from numpy.random import Generator
from scipy.fft import irfft, rfft
from scipy.linalg import hadamard

from WatermarkConfig import WatermarkConfig

dotenv.load_dotenv()

if os.getenv("SECRET_KEY") is None:
    raise ValueError("SECRET_KEY environment variable not set. Check your env")


@dataclass(frozen=True)
class WaterMarker:
    name: str = "AURA"

    matrix: np.ndarray = field(init=False, repr=False)
    pn_mask: np.ndarray = field(init=False, repr=False)
    secret_rows: np.ndarray = field(init=False, repr=False)
    rng: Generator = field(init=False, repr=False)
    start_ind: int = field(init=False, repr=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "matrix", hadamard(WatermarkConfig.hadamard_size))

        mask_rng = np.random.default_rng(
            seed=int(os.getenv("SECRET_KEY", "676767676767"))
        )
        mask = mask_rng.choice([1, -1], size=WatermarkConfig.hadamard_size)
        object.__setattr__(self, "pn_mask", mask)

        indices = np.arange(WatermarkConfig.hadamard_size)
        mask_rng.shuffle(indices)

        secret_rows = self.matrix[indices[: WatermarkConfig.num_bits]]
        object.__setattr__(
            self,
            "secret_rows",
            secret_rows,
        )

        object.__setattr__(self, "rng", mask_rng)

        start_ind = self.rng.integers(
            0, WatermarkConfig.chunk_size // 2 + 1 - WatermarkConfig.hadamard_size
        )
        object.__setattr__(self, "start_ind", start_ind)

    def encode_chunk(self) -> str:
        timestamp = datetime.now(UTC).isoformat(timespec="seconds")

        # Load the file and resample it
        audio, _sr = librosa.load("input/test2.wav", sr=WatermarkConfig.sample_rate)

        chunk_size = WatermarkConfig.chunk_size
        num_chunks = len(audio) // chunk_size
        if num_chunks == 0:
            return "The file is too short to encode"

        # Create bit string based off character
        char = ord(WatermarkConfig.hidden_character)
        bits = [int(char) for char in format(char, f"0{WatermarkConfig.num_bits}b")]
        signs = [1 if bit == 1 else -1 for bit in bits]

        # Combine the rows into one code
        combined_code = np.zeros(WatermarkConfig.hadamard_size)
        for i in range(WatermarkConfig.num_bits):
            combined_code += signs[i] * self.secret_rows[i]

        masked_watermark = combined_code * self.pn_mask

        full_audio = np.copy(audio)

        for chunk_idx in range(num_chunks):
            start_pos = chunk_idx * chunk_size
            end_pos = start_pos + chunk_size
            chunk_audio = full_audio[start_pos:end_pos]

            # FFT to convert to frequency bins
            freq_data = rfft(chunk_audio)
            magnitudes = np.abs(freq_data)  # type: ignore[assignment]
            phases = np.angle(freq_data)  # type: ignore[assignment]

            # Convert to log domain to preserve orthogonality and prevent massive
            # spectral peaks from dominating the correlation noise floor
            end_ind = self.start_ind + WatermarkConfig.hadamard_size
            band_mags = magnitudes[self.start_ind : end_ind]
            log_mags = np.log(np.maximum(band_mags, 1e-10))

            # Increase alpha multiplier locally to ensure watermark survives
            # the host signal variance and quantization
            effective_alpha = WatermarkConfig.gain_alpha * 10
            log_mags += masked_watermark * effective_alpha

            magnitudes[self.start_ind : end_ind] = np.exp(log_mags)

            # Reconstruct audio chunk into time domain using inverse FFT
            new_freq_data = magnitudes * np.exp(1j * phases)
            new_chunk_audio = irfft(new_freq_data)

            full_audio[start_pos:end_pos] = new_chunk_audio

        # Force the audio back into the safe -1 to 1 range
        full_audio = np.clip(
            full_audio,
            -1.0,
            1.0,
        )

        sf.write(
            "output/watermarked_output.wav", full_audio, WatermarkConfig.sample_rate
        )

        return f"{self.name} successfully watermarked! {timestamp}"

    def decode_chunk(self) -> str:

        # Load the file and resample it
        audio, _sr = librosa.load(
            "output/watermarked_output.wav", sr=WatermarkConfig.sample_rate
        )

        chunk_size = WatermarkConfig.chunk_size
        num_chunks = len(audio) // chunk_size

        if num_chunks == 0:
            return "The file is too short to decode"

        total_correlations = np.zeros(WatermarkConfig.num_bits)

        for chunk_idx in range(num_chunks):
            start_pos = chunk_idx * chunk_size
            end_pos = start_pos + chunk_size
            chunk_audio = audio[start_pos:end_pos]

            # FFT to convert to frequency bins
            freq_data = rfft(chunk_audio)
            magnitudes = np.abs(freq_data)  # type: ignore[assignment]

            # Decode in the log domain to match encoding
            log_mags = np.log(np.maximum(magnitudes, 1e-10))

            # Flatten the host audio spectrum using a moving average
            window_size = 15
            window = np.ones(window_size) / window_size
            smoothed_log_mags = np.convolve(log_mags, window, mode="same")

            extracted_signal = log_mags - smoothed_log_mags

            # Extract the watermark from the frequency domain
            received_signal = extracted_signal[
                self.start_ind : self.start_ind + WatermarkConfig.hadamard_size
            ]

            received_signal = (received_signal - np.mean(received_signal)) / (
                np.std(received_signal) + 1e-10
            )

            # Unmask the PN Mask
            unmasked_signal = received_signal * self.pn_mask

            # Search for each bit using hadamard rows
            for i in range(WatermarkConfig.num_bits):
                # Multiply by the secret row used for the bit, cancelling out all other rows
                correlation = np.sum(unmasked_signal * self.secret_rows[i])
                total_correlations[i] += correlation

        decoded_bits = []
        for i in range(WatermarkConfig.num_bits):
            avg_corr = total_correlations[i] / num_chunks
            # print(f"Bit {i}: average correlation = {avg_corr}")
            # If correlation is positive, bit is 1. If negative, bit is 0.

            if abs(avg_corr) < 20:
                return f"The file was not encoded with {self.name}"

            decoded_bits.append("1" if avg_corr > 0 else "0")

        # Reconstruct the character from the bits
        bit_string = "".join(decoded_bits)
        try:
            decoded_char = chr(int(bit_string, 2))
        except ValueError:
            decoded_char = "X"

        return f"{self.name} decoded value {decoded_char} from file."
