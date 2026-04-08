FROM node:20-slim

WORKDIR /app

# Copy shared constants
COPY shared/ ./shared/
COPY package.json ./package.json

# Copy server
COPY server/package.json ./server/package.json
COPY server/src/ ./server/src/

# Install server dependencies
WORKDIR /app/server
RUN npm install --production

EXPOSE 3001

CMD ["node", "src/index.js"]
