FROM node:20-alpine

ARG COMMIT_HASH=public
ENV COMMIT_HASH=${COMMIT_HASH}

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

# Start ponder
CMD ["sh", "-c", "npx ponder start --schema schema-${COMMIT_HASH}"]