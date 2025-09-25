FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Expose port
EXPOSE 42069

# Run schema migration on container start
ENTRYPOINT ["node", "schema-manager.js"]

# Start ponder
CMD ["npm", "start"]