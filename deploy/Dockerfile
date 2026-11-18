# Satu tahap build untuk seluruh monorepo, lalu dua target:
#   app   → API NestJS (+ tooling migrasi/seed)
#   panel → file statis panel dilayani nginx, /api diproksikan ke service "api"
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM build AS app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM nginx:1.27-alpine AS panel
COPY deploy/nginx-panel.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/panel/dist /usr/share/nginx/html
