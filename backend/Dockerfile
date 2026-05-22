# Dockerfile za Railway / Render / Fly.io deployment
# Uključuje LibreOffice koji je potreban za DOCX → PDF konverziju

FROM python:3.11-slim

# Instaliraj LibreOffice + sve sistemske zavisnosti
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Kopiraj requirements i instaliraj Python pakete
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiraj cijeli backend
COPY . .

# Kreiraj direktorije za generisane fajlove (Railway volume će biti montiran ovdje)
RUN mkdir -p /app/generated /app/templates

# Railway koristi $PORT env varijablu
ENV PORT=8000
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Pokreni FastAPI server
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT}
