from .celeredis import app


@app.task(bind=True, name="encoder.compute")
def compute_encode(self, data):
    # TODO: Import encoding algorithm from other file
    # result = fft.custom_fft(data)

    # return result
    raise NotImplementedError("Encoding algorithm not implemented yet")
