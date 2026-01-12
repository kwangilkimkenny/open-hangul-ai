# 🚀 HAN-View React App - Production Dockerfile
# Multi-stage build for optimal image size
# Version: 2.1.0

# ============================================
# Stage 1: Build the application
# ============================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production + dev for build)
RUN npm ci

# Copy source files
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV VITE_ENABLE_DEBUG_MODE=false
ENV VITE_LOG_LEVEL=error

# Build the application
RUN npm run build

# List build output (for verification)
RUN ls -lah dist/

# ============================================
# Stage 2: Production image with nginx
# ============================================
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;

    # SPA routing - serve index.html for all routes
    location / {
        try_files \$uri \$uri/ /index.html;

        # Cache static assets
        location ~* \\.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy (if needed)
    # location /api/ {
    #     proxy_pass http://backend:3000/;
    #     proxy_set_header Host \$host;
    #     proxy_set_header X-Real-IP \$remote_addr;
    # }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add labels for metadata
LABEL maintainer="ISM Team <support@ism-team.com>"
LABEL version="2.1.0"
LABEL description="HAN-View React App - HWPX Document Viewer"

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
