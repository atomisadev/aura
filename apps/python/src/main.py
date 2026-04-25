from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class PythonWorkspaceApp:
    name: str = "python-app"

    def run(self) -> str:
        timestamp = datetime.now(UTC).isoformat(timespec="seconds")
        return f"{self.name} is running through Bun at {timestamp}"


def main() -> None:
    app = PythonWorkspaceApp()
    print(app.run())


if __name__ == "__main__":
    main()
