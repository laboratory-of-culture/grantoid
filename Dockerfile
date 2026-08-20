# Two stages: build with dev dependencies, run without them.
FROM node:22-slim AS build
WORKDIR /app

# Prisma needs OpenSSL to pick an engine; without it the client fails at first
# query rather than at build, which is the worst time to find out.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
# Prompts are read from disk at request time so an edit is an isolated diff and
# the recorded fingerprint means something. They have to ship.
COPY agents ./agents
COPY packages ./packages
COPY scripts ./scripts

EXPOSE 3000
CMD ["npm", "run", "start"]
