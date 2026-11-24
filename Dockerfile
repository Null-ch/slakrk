FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json tsconfig.server.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY server ./server
RUN npm run build && npx --no-install tsc -p tsconfig.server.json

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir /data && chown node:node /data
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 8080
CMD ["node", "--experimental-strip-types", "server/index.mts"]
