from celeredis import app


@app.task(name="test.ping")
def ping(value):
    return f"pong: {value}"
