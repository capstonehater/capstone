FROM node:22-bookworm-slim AS build
WORKDIR /app/ims-frontend
COPY ims-frontend/package*.json ./
RUN npm ci
COPY ims-frontend/ ./
ARG API_UPSTREAM_URL=http://edge:8080/backend
ENV NEXT_PUBLIC_API_BASE_URL=/backend API_UPSTREAM_URL=${API_UPSTREAM_URL} NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/ims-frontend
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/ims-frontend ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
