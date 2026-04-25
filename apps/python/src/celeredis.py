from celery import Celery

BROKER_URL = "redis://localhost:6379/0"
RESULT_BACKEND = "redis://localhost:6379/1"

app = Celery("apps.python", broker=BROKER_URL, backend=RESULT_BACKEND)

app.conf.update(
    task_serializer="pickle",
    result_serializer="pickle",
    accept_content=["pickle", "json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_time_limit=300,
)
