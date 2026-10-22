# Image AWS Lambda untuk API Rexa (FastAPI + guardrail + tiruan SAP).
# Build dan deploy: powershell -ExecutionPolicy Bypass -File deploy\deploy_lambda.ps1
FROM public.ecr.aws/lambda/python:3.12

COPY requirements-lambda.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements-lambda.txt

# Data analitik hasil `python -m engine.pipeline` (hanya dibaca). File ini tidak ada di git, jadi build
# harus dijalankan dari laptop yang sudah menjalankan pipeline.
COPY data/processed/chibirex.duckdb ${LAMBDA_TASK_ROOT}/data/processed/chibirex.duckdb
COPY engine/ ${LAMBDA_TASK_ROOT}/engine/
COPY sap_mock/ ${LAMBDA_TASK_ROOT}/sap_mock/
COPY agent/ ${LAMBDA_TASK_ROOT}/agent/
COPY api/ ${LAMBDA_TASK_ROOT}/api/

CMD ["api.lambda_handler.handler"]
