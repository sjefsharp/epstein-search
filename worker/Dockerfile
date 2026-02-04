FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 10000) + '/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Port (Render sets this via env, but Node needs explicit PORT env)
ENV PORT=10000
EXPOSE 10000

# Start server
CMD ["node", "dist/index.js"]
