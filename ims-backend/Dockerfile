FROM node:22-bookworm-slim AS build
WORKDIR /app/ims-backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY ims-backend/package*.json ./
RUN npm ci --include=dev
COPY ims-backend/prisma ./prisma
COPY ims-backend/scripts/ensure-prisma-client.cjs ./scripts/ensure-prisma-client.cjs
COPY ims-backend/src ./src
COPY ims-backend/tsconfig*.json ims-backend/nest-cli.json ./
RUN npm run prisma:generate && npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/python
ENV PATH="/opt/python/bin:${PATH}" NODE_ENV=production PORT=4000
COPY python/requirements.txt /tmp/forecast-requirements.txt
COPY ["AI-Store Reco/requirements.txt", "/tmp/store-requirements.txt"]
RUN pip install --no-cache-dir -r /tmp/forecast-requirements.txt -r /tmp/store-requirements.txt
WORKDIR /app/ims-backend
COPY --from=build --chown=node:node /app/ims-backend ./
COPY --chown=node:node python/*.py /app/python/
COPY --chown=node:node python/raw-materials-and-products.csv /app/python/
COPY --chown=node:node ["AI-Store Reco/*.py", "/app/AI-Store Reco/"]
RUN mkdir -p '/app/ims-backend/profile picture' /app/ims-backend/product-images \
    /var/lib/ims/tmp /var/lib/ims/models \
    && chown -R node:node /var/lib/ims '/app/ims-backend/profile picture' /app/ims-backend/product-images
ENV TMPDIR=/var/lib/ims/tmp FORECAST_MODEL_CACHE_DIR=/var/lib/ims/models
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
