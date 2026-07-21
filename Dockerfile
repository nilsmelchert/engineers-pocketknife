# syntax=docker/dockerfile:1

# ---- Build stage ----------------------------------------------------------
# Node 24 matches the GitHub Pages CI (.github/workflows/deploy.yml).
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Build the static site (tsc --noEmit && vite build → /app/dist).
COPY . .
RUN npm run build

# ---- Serve stage ----------------------------------------------------------
FROM nginx:1.27-alpine AS serve

# Static site config (gzip, SPA fallback, asset caching).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ship only the built assets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
