FROM node:20-alpine AS base
WORKDIR /app
RUN chown -R node:node /app


FROM base AS development
USER node

COPY --chown=node:node package.json package-lock.json* ./

RUN npm ci --no-audit --no-fund
COPY --chown=node:node . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]



FROM development AS builder

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ENV NODE_ENV=production

RUN npm run build



FROM node:20-alpine AS production


WORKDIR /app
RUN chown -R node:node /app

USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --chown=node:node --from=builder /app/build ./build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["npm", "run", "start"]
