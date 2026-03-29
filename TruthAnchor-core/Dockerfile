FROM python:3.12-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && \
    rm -rf /var/lib/apt/lists/*

# Python 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드
COPY halluguard/ ./halluguard/
COPY api.py .

# NLI 모델 사전 다운로드 (빌드 시 캐싱)
RUN python -c "
try:
    from sentence_transformers import CrossEncoder
    CrossEncoder('cross-encoder/nli-deberta-v3-base')
    print('NLI model downloaded')
except Exception as e:
    print(f'NLI model download skipped: {e}')
"

EXPOSE 8200

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8200"]
