# Matchmaking + relay server for sample-3d online royale.
# Build from the repo root (it needs games/sample-3d/src/net/protocol.ts):
#   docker build -f games/sample-3d/server/Dockerfile -t lawn-gnome-mm .
FROM node:22-alpine AS build
WORKDIR /app/games/sample-3d/server
COPY games/sample-3d/server/package.json ./
RUN npm install --no-audit --no-fund
COPY games/sample-3d/src/net/protocol.ts /app/games/sample-3d/src/net/protocol.ts
COPY games/sample-3d/server/tsconfig.json ./
COPY games/sample-3d/server/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /srv
COPY --from=build /app/games/sample-3d/server/node_modules ./node_modules
COPY --from=build /app/games/sample-3d/server/dist/server.mjs ./server.mjs
USER node
EXPOSE 8080
# SIGTERM drains: no new matches, running ones finish (see src/index.ts).
CMD ["node", "server.mjs"]
