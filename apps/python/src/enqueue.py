import numpy as np

from .celeredis import app


def send_job(signal):
    return app.send_task("encoder.compute", args=[signal])


if __name__ == "__main__":
    x = np.random.random(1024)
    async_result = send_job(x)
    print("Task id:", getattr(async_result, "id", None))
    print("Waiting for result (timeout=10s)...")
    try:
        print("Result:", async_result.get(timeout=10))
    except Exception as e:
        print("Failed to fetch result within timeout or error occurred:", e)
