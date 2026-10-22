"""Entry point AWS Lambda (container image, lihat Dockerfile): `CMD ["api.lambda_handler.handler"]`.

Mangum menerjemahkan event Lambda Function URL ke ASGI. Lifespan dimatikan karena Mangum menjalankannya di
setiap invocation (DuckDB ±300 MB akan dibuka ulang di setiap request); sebagai gantinya `siapkan()` dipanggil
sekali saat cold start dan koneksinya dipakai ulang selama instance Lambda hidup.
"""

from mangum import Mangum

from api.main import app, siapkan

siapkan(app)
handler = Mangum(app, lifespan="off")
