import sys

from celeredis import app


def send_ping(value):
    return app.send_task("test.ping", args=[value])


if __name__ == "__main__":
    value = sys.argv[1] if len(sys.argv) > 1 else "hello"

    async_result = send_ping(value)
    print("Sent 'test.ping' task id:", getattr(async_result, "id", None))
    print("Waiting for result (timeout=10s)...")
    try:
        print("Result:", async_result.get(timeout=10))
    except Exception as e:
        print("Failed to fetch result within timeout or error occurred:", e)
