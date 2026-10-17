# Docs: HTML build-time'da üretilir (Node), nginx ile servis edilir.
# Araç referansı yayınlanmış MCP paketinden üretildiği için build, npm kaydına erişir.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# 127.0.0.1, `localhost` değil: Alpine'de localhost önce ::1'e çözülebiliyor.
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1/health || exit 1
