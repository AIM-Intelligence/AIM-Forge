FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git tini procps gcc \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager) for virtualenv management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && ln -s /root/.local/bin/uv /usr/local/bin/uv

# Python dependencies
WORKDIR /app
COPY packages/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY packages/backend /app

# Create projects directory
RUN mkdir -p /app/projects

# Set volumes for persistence
VOLUME ["/app/projects"]

EXPOSE 8000

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]