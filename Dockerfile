FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY assets ./assets
COPY img ./img
COPY *.html *.css ./
COPY script.js registry.js registry-config.js admin.js api-client.js ./
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
