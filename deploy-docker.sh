#!/bin/bash

# 🚀 Quick Docker Deployment Script
# HAN-View React App v2.1.0

set -e  # Exit on error

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║      HAN-View React App - Docker Deployment              ║"
echo "║                 Version 2.1.0                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker is installed: $(docker --version)"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running!"
    echo "Please start Docker Desktop or run: sudo systemctl start docker"
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Step 1: Build Docker image
echo "📦 Step 1/4: Building Docker image..."
echo "This may take 2-5 minutes..."
docker build -t hanview-react-app:2.1.0 -t hanview-react-app:latest .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully"
echo ""

# Step 2: Stop and remove existing container (if exists)
echo "🔄 Step 2/4: Cleaning up existing containers..."
if docker ps -a | grep -q hanview-react-app; then
    echo "Stopping existing container..."
    docker stop hanview-react-app 2>/dev/null || true
    echo "Removing existing container..."
    docker rm hanview-react-app 2>/dev/null || true
fi
echo "✅ Cleanup complete"
echo ""

# Step 3: Start new container
echo "🚀 Step 3/4: Starting new container..."
docker run -d \
  --name hanview-react-app \
  -p 8080:80 \
  --restart unless-stopped \
  hanview-react-app:2.1.0

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container!"
    exit 1
fi

echo "✅ Container started successfully"
echo ""

# Step 4: Verify deployment
echo "🔍 Step 4/4: Verifying deployment..."
sleep 3  # Wait for container to fully start

# Check if container is running
if ! docker ps | grep -q hanview-react-app; then
    echo "❌ Container is not running!"
    echo "Check logs with: docker logs hanview-react-app"
    exit 1
fi

echo "✅ Container is running"

# Check health endpoint
echo "Checking health endpoint..."
HEALTH_CHECK=$(curl -s http://localhost:8080/health 2>/dev/null || echo "failed")

if [ "$HEALTH_CHECK" = "healthy" ]; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check returned: $HEALTH_CHECK"
    echo "Application may still be starting..."
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                 🎉 DEPLOYMENT SUCCESSFUL! 🎉              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Deployment Summary:"
echo "  • Container Name: hanview-react-app"
echo "  • Image: hanview-react-app:2.1.0"
echo "  • Port: 8080"
echo "  • Status: Running"
echo ""
echo "🌐 Access your application:"
echo "  • Application: http://localhost:8080"
echo "  • Health Check: http://localhost:8080/health"
echo ""
echo "📝 Useful Commands:"
echo "  • View logs:    docker logs -f hanview-react-app"
echo "  • Stop app:     docker stop hanview-react-app"
echo "  • Restart app:  docker restart hanview-react-app"
echo "  • Check stats:  docker stats hanview-react-app"
echo ""
echo "📚 Full documentation: DOCKER_DEPLOYMENT_INSTRUCTIONS.md"
echo ""
