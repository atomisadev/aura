from __future__ import annotations

from WaterMarker import WaterMarker


def main() -> None:
    app = WaterMarker()
    print(app.encode_chunk())
    print(app.decode_chunk())


if __name__ == "__main__":
    main()
