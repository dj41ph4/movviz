# syntax=docker/dockerfile:1

# ---- Dependencies ----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# ---- Build -----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache cmake build-base python3
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Install the download engine's own runtime dependencies.
RUN cd engine && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund)

# ---- Runtime ---------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    MOVVIZ_WEB_PORT=9810 \
    MOVVIZ_ENGINE_PORT=9820 \
    PORT=9810 \
    HOSTNAME=0.0.0.0 \
    MOVVIZ_CONFIG_DIR=/config \
    MOVVIZ_DATA_DIR=/data \
    MOVVIZ_CONTAINER=1

# Non-root runtime user — default uid/gid, remapped at container start to
# whatever PUID/PGID the NAS admin sets (see docker-entrypoint.sh) so writes
# to bind-mounted NAS folders actually match their real owner.
RUN addgroup -g 1001 movviz && adduser -u 1001 -G movviz -S movviz
# su-exec drops from root (needed at start to chown/switch user) to movviz
# right before running the app — same pattern as most NAS-friendly images.
RUN apk add --no-cache su-exec

# Standalone server + assets only (small image).
COPY --from=builder --chown=movviz:movviz /app/.next/standalone ./
COPY --from=builder --chown=movviz:movviz /app/.next/static ./.next/static
COPY --from=builder --chown=movviz:movviz /app/public ./public
# Download engine, bundled next to server.js so the web app spawns it on boot.
COPY --from=builder --chown=movviz:movviz /app/engine ./engine

RUN mkdir -p /config /data && chown movviz:movviz /config /data
# /config = app config & state · /data = media root (torrents + library)
VOLUME ["/config", "/data"]

COPY packaging/docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
# Stays root here on purpose — the entrypoint fixes ownership then drops to
# movviz (remapped to PUID/PGID) via su-exec before actually running node.
ENTRYPOINT ["docker-entrypoint.sh"]

# 9810 = web UI. 51413-51414 = BitTorrent peer ports (movies/series instances) —
# forward these on your router/NAS firewall too, or downloads stay stuck on
# outbound-only connections and end up much slower.
EXPOSE 9810 51413-51414/tcp 51413-51414/udp
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:9810/api/healthz || exit 1

CMD ["node", "server.js"]
