FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

# Create data directory for SQLite persistence
RUN mkdir -p /data

ENV PORT=8080
ENV DB_PATH=/data/campusclash.db

EXPOSE 8080

CMD ["node", "server.js"]
