from dataclasses import dataclass


@dataclass(frozen=True)
class WatermarkConfig:
    sample_rate: int = 44100
    hadamard_size: int = 1024
    chunk_size: int = 4096
    gain_alpha: float = 0.005
    target_freq_range: tuple = (12000, 15000)
    hidden_character: str = "A"
    num_bits: int = 8
