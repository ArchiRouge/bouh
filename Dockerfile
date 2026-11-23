FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY client ./client
COPY server ./server
ENV PORT=8080 DATA_FILE=/data/players.json
EXPOSE 8080
CMD ["node", "server/server.js"]
