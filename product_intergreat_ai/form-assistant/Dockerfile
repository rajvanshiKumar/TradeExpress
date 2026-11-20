FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir . && useradd -r -u 10001 appuser
USER appuser
EXPOSE 8100
HEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8100/health')" || exit 1
CMD ["uvicorn", "app.main:app_factory", "--factory", "--host", "0.0.0.0", "--port", "8100"]
