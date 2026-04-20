# 🐳 Docker Deployment Instructions - HAN-View React v2.1.0

**Quick Start Guide for Production Deployment**

---

## 📋 Prerequisites

### 1. Install Docker

```bash
# Check if Docker is installed
docker --version

# If not installed, install Docker:
# - macOS: https://docs.docker.com/desktop/install/mac-install/
# - Linux: https://docs.docker.com/engine/install/
# - Windows: https://docs.docker.com/desktop/install/windows-install/
```

### 2. Verify Docker is Running

```bash
# Start Docker service
docker info

# If not running, start Docker Desktop (Mac/Windows) or:
sudo systemctl start docker  # Linux
```

---

## 🚀 Deployment Steps

### Step 1: Navigate to Project Directory

```bash
cd /Users/kimkwangil/Documents/project_03/hanview-react-app-v3
```

### Step 2: Build Docker Image

```bash
# Build the Docker image (takes 2-5 minutes)
docker build -t hanview-react-app:2.1.0 -t hanview-react-app:latest .

# Verify build succeeded
docker images | grep hanview
```

**Expected Output:**

```
hanview-react-app   2.1.0    abc123    2 minutes ago    50MB
hanview-react-app   latest   abc123    2 minutes ago    50MB
```

### Step 3: Test Container Locally

```bash
# Run container on port 8080
docker run -d -p 8080:80 --name hanview-test hanview-react-app:2.1.0

# Check if container is running
docker ps

# Test in browser
open http://localhost:8080
# OR
curl http://localhost:8080/health
```

**Expected:** "healthy" response

### Step 4: Verify Application Works

1. Open http://localhost:8080 in your browser
2. Load a HWPX file
3. Test undo/redo (Ctrl+Z / Ctrl+Y)
4. Test editing features
5. Check browser console for errors (F12)

### Step 5: Stop Test Container

```bash
# Stop and remove test container
docker stop hanview-test
docker rm hanview-test
```

---

## 🌐 Production Deployment Options

### Option A: Docker Compose (Recommended)

**1. Deploy with Docker Compose:**

```bash
# Start application in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

**2. Access Application:**

- **URL:** http://localhost:8080
- **Health Check:** http://localhost:8080/health

**3. Stop Application:**

```bash
docker-compose down
```

---

### Option B: Docker Run Command

**1. Run Container:**

```bash
docker run -d \
  --name hanview-react-app \
  -p 8080:80 \
  --restart unless-stopped \
  hanview-react-app:2.1.0
```

**2. View Logs:**

```bash
docker logs -f hanview-react-app
```

**3. Stop Container:**

```bash
docker stop hanview-react-app
docker rm hanview-react-app
```

---

### Option C: Docker Swarm (For Clusters)

**1. Initialize Swarm:**

```bash
docker swarm init
```

**2. Deploy as Service:**

```bash
docker service create \
  --name hanview-app \
  --replicas 3 \
  --publish 8080:80 \
  hanview-react-app:2.1.0
```

**3. Scale Service:**

```bash
docker service scale hanview-app=5
```

**4. Remove Service:**

```bash
docker service rm hanview-app
```

---

### Option D: Push to Container Registry

**1. Docker Hub:**

```bash
# Tag image
docker tag hanview-react-app:2.1.0 yourusername/hanview-react-app:2.1.0

# Login to Docker Hub
docker login

# Push image
docker push yourusername/hanview-react-app:2.1.0
```

**2. AWS ECR:**

```bash
# Create repository
aws ecr create-repository --repository-name hanview-react-app

# Get login command
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag hanview-react-app:2.1.0 \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/hanview-react-app:2.1.0

docker push \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/hanview-react-app:2.1.0
```

**3. Google Container Registry (GCR):**

```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Tag and push
docker tag hanview-react-app:2.1.0 \
  gcr.io/your-project-id/hanview-react-app:2.1.0

docker push gcr.io/your-project-id/hanview-react-app:2.1.0
```

**4. Azure Container Registry (ACR):**

```bash
# Login to ACR
az acr login --name yourregistry

# Tag and push
docker tag hanview-react-app:2.1.0 \
  yourregistry.azurecr.io/hanview-react-app:2.1.0

docker push yourregistry.azurecr.io/hanview-react-app:2.1.0
```

---

## 🔧 Configuration Options

### Environment Variables

Create a `.env` file:

```env
# Application settings
NODE_ENV=production
VITE_ENABLE_DEBUG_MODE=false
VITE_LOG_LEVEL=error

# API configuration (if needed)
VITE_API_BASE_URL=https://api.your-domain.com

# Feature flags
VITE_ENABLE_AI=true
VITE_ENABLE_AUTOSAVE=true
```

Run with environment file:

```bash
docker run -d \
  --name hanview-react-app \
  --env-file .env \
  -p 8080:80 \
  hanview-react-app:2.1.0
```

### Port Mapping

Change external port:

```bash
# Run on port 3000 instead of 8080
docker run -d -p 3000:80 hanview-react-app:2.1.0

# Run on port 80 (requires sudo/root)
docker run -d -p 80:80 hanview-react-app:2.1.0
```

### Volume Mounting (for persistent data)

```bash
docker run -d \
  -p 8080:80 \
  -v /path/to/data:/data \
  hanview-react-app:2.1.0
```

---

## 🔐 SSL/HTTPS Configuration

### Option 1: nginx Reverse Proxy with Let's Encrypt

**1. Create nginx SSL configuration:**

```nginx
# nginx-ssl.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://hanview-app:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

**2. Run with SSL:**

```bash
docker run -d \
  --name nginx-proxy \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/nginx-ssl.conf:/etc/nginx/conf.d/default.conf \
  -v /path/to/ssl:/etc/nginx/ssl \
  --link hanview-app \
  nginx:alpine
```

### Option 2: Caddy (Automatic HTTPS)

**Caddyfile:**

```
your-domain.com {
    reverse_proxy hanview-app:80
}
```

**Run Caddy:**

```bash
docker run -d \
  --name caddy \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data \
  --link hanview-app \
  caddy
```

---

## 📊 Monitoring & Maintenance

### View Container Logs

```bash
# Real-time logs
docker logs -f hanview-react-app

# Last 100 lines
docker logs --tail 100 hanview-react-app

# With timestamps
docker logs --timestamps hanview-react-app
```

### Check Container Stats

```bash
# Live resource usage
docker stats hanview-react-app

# Memory and CPU usage
docker stats --no-stream hanview-react-app
```

### Execute Commands in Container

```bash
# Open shell in container
docker exec -it hanview-react-app sh

# Check nginx configuration
docker exec hanview-react-app nginx -t

# View running processes
docker exec hanview-react-app ps aux
```

### Health Checks

```bash
# Check health endpoint
curl http://localhost:8080/health

# Docker health status
docker inspect --format='{{.State.Health.Status}}' hanview-react-app
```

---

## 🔄 Updates & Rollbacks

### Update to New Version

**1. Build new version:**

```bash
# Pull latest code
git pull origin main

# Build new image
docker build -t hanview-react-app:2.2.0 .
```

**2. Stop old container:**

```bash
docker stop hanview-react-app
docker rm hanview-react-app
```

**3. Start new container:**

```bash
docker run -d \
  --name hanview-react-app \
  -p 8080:80 \
  --restart unless-stopped \
  hanview-react-app:2.2.0
```

### Rollback to Previous Version

```bash
# Stop current container
docker stop hanview-react-app
docker rm hanview-react-app

# Start previous version
docker run -d \
  --name hanview-react-app \
  -p 8080:80 \
  --restart unless-stopped \
  hanview-react-app:2.1.0
```

---

## 🐛 Troubleshooting

### Issue: Container Won't Start

**Check logs:**

```bash
docker logs hanview-react-app
```

**Check if port is in use:**

```bash
# macOS/Linux
lsof -i :8080

# Kill process using port
kill -9 <PID>
```

### Issue: Build Fails

**Clear Docker cache:**

```bash
# Remove old images
docker system prune -a

# Rebuild without cache
docker build --no-cache -t hanview-react-app:2.1.0 .
```

### Issue: Application Not Loading

**Check nginx configuration:**

```bash
docker exec hanview-react-app nginx -t
```

**Check file permissions:**

```bash
docker exec hanview-react-app ls -la /usr/share/nginx/html
```

### Issue: High Memory Usage

**Set memory limits:**

```bash
docker run -d \
  --name hanview-react-app \
  -p 8080:80 \
  --memory="512m" \
  --memory-swap="1g" \
  hanview-react-app:2.1.0
```

---

## 📋 Quick Reference

### Useful Commands

```bash
# List all containers
docker ps -a

# List all images
docker images

# Remove container
docker rm -f hanview-react-app

# Remove image
docker rmi hanview-react-app:2.1.0

# Clean up unused resources
docker system prune -a

# Check Docker disk usage
docker system df

# Export container
docker save hanview-react-app:2.1.0 > hanview-app.tar

# Import container
docker load < hanview-app.tar
```

---

## 🎯 Production Checklist

Before deploying to production:

- [ ] Docker is installed and running
- [ ] Application tested locally (http://localhost:8080)
- [ ] HWPX files load correctly
- [ ] Undo/redo works (Ctrl+Z / Ctrl+Y)
- [ ] No console errors in browser (F12)
- [ ] Health check returns "healthy"
- [ ] SSL/HTTPS configured (if public)
- [ ] Environment variables set correctly
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Rollback procedure tested

---

## 🚀 Quick Deploy Command

**For immediate deployment:**

```bash
# One-command deployment
cd /Users/kimkwangil/Documents/project_03/hanview-react-app-v3 && \
docker build -t hanview-react-app:2.1.0 . && \
docker run -d \
  --name hanview-react-app \
  -p 8080:80 \
  --restart unless-stopped \
  hanview-react-app:2.1.0 && \
echo "✅ Deployment complete! Access at: http://localhost:8080"
```

**Or with Docker Compose:**

```bash
cd /Users/kimkwangil/Documents/project_03/hanview-react-app-v3 && \
docker-compose up -d && \
echo "✅ Deployment complete! Access at: http://localhost:8080"
```

---

## 📞 Support

If you encounter issues:

1. Check logs: `docker logs hanview-react-app`
2. Check health: `curl http://localhost:8080/health`
3. Review documentation: `DEPLOYMENT_GUIDE.md`
4. Check browser console (F12)

---

## 🎉 Deployment Complete!

Your application should now be running at:

- **HTTP:** http://localhost:8080
- **Health Check:** http://localhost:8080/health

**Next Steps:**

1. Test the application thoroughly
2. Configure SSL if deploying publicly
3. Set up monitoring
4. Configure backups
5. Document your deployment

**Good luck with your deployment!** 🚀
