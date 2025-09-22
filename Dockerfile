FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Expose ports
EXPOSE 42069 3003

# Start both Ponder and API
CMD ["sh", "-c", "npm start & npm run api"]