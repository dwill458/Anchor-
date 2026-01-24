# Anchor AI Service Dockerfile
# Structure-preserving sigil enhancement using ControlNet

FROM python:3.11-slim

# Install system dependencies for OpenCV and Cairo
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libcairo2-dev \
    libgirepository1.0-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ src/
COPY main.py .

# Environment variables
ENV PYTHONPATH=/app
ENV AI_SERVICE_HOST=0.0.0.0
ENV AI_SERVICE_PORT=8001

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8001/health')" || exit 1

# Run the service
CMD ["python", "main.py"]
