# build stage
FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV npm_config_optional=true

# Accept build arg for API URL
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

COPY package*.json ./
RUN npm ci --include=dev \
 && npm rebuild @next/swc-linux-x64-gnu --force || true \
 && npm rebuild @next/swc-linux-x64-musl --force || true \
 && npm install --no-save --no-package-lock --no-audit lightningcss-linux-x64-gnu || \
    npm install --no-save --no-package-lock --no-audit lightningcss-linux-x64-musl || true

COPY . .
RUN npm run build

# run stage
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

EXPOSE 3000
USER node
CMD ["npm", "run", "start"]
