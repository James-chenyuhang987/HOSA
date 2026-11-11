FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOSA_HOST=0.0.0.0

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

EXPOSE 8787
CMD ["npm", "run", "server"]
