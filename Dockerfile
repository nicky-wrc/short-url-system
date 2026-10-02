FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY frontend frontend
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/package.json package.json
COPY --from=build --chown=node:node /app/backend/package.json backend/package.json
COPY --from=build --chown=node:node /app/backend/dist backend/dist
COPY --from=build --chown=node:node /app/backend/migrations backend/migrations
COPY --from=build --chown=node:node /app/backend/certs backend/certs
COPY --from=build --chown=node:node /app/frontend/dist frontend/dist
USER node
EXPOSE 3000
CMD ["sh", "-c", "node backend/dist/migrate.js && node backend/dist/server.js"]
