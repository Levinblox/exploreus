# Container for the Hono API server. Includes ffmpeg for video transcoding.
# Render / Fly / any Docker host will run this.

FROM node:20-slim

# ffmpeg for the video transcode step
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only production deps. tsx + the AWS/Neon/Hono libs are in deps.
# Using `npm install` (not `npm ci`) because some transitive deps are
# platform-optional and the macOS-generated lockfile misses Linux variants.
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Server source. We deliberately don't copy the Next.js app since the iOS
# bundle hosts the frontend and the API is the only thing we deploy.
COPY server ./server
COPY tsconfig.json ./

# Render/Fly inject $PORT — our server reads it.
ENV NODE_ENV=production
EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
