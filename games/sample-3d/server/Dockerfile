# Matchmaking + relay server for sample-3d online royale.
# Build from the repo root (it needs games/sample-3d/src/net/protocol.ts and textFilter.ts):
#   docker build -f games/sample-3d/server/Dockerfile -t lawn-gnome-mm .
FROM node:22-alpine AS build
WORKDIR /app/games/sample-3d/server
COPY games/sample-3d/server/package.json ./
RUN npm install --no-audit --no-fund
COPY games/sample-3d/src/net/protocol.ts games/sample-3d/src/net/textFilter.ts /app/games/sample-3d/src/net/
# src/net/textFilter.ts imports 'obscenity': let it resolve from the server's node_modules.
RUN ln -s /app/games/sample-3d/server/node_modules /app/games/sample-3d/node_modules
COPY games/sample-3d/server/tsconfig.json ./
COPY games/sample-3d/server/src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /srv
COPY games/sample-3d/server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/games/sample-3d/server/dist/server.mjs ./server.mjs
USER node
EXPOSE 8080
# SIGTERM drains: no new matches, running ones finish (see src/index.ts).
CMD ["node", "server.mjs"]
