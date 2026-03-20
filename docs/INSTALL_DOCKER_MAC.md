# 🐳 Docker Installation Guide for macOS

## Quick Installation

### Option 1: Docker Desktop (Recommended)

1. **Download Docker Desktop for Mac:**
   - Visit: https://www.docker.com/products/docker-desktop
   - Or direct download: https://desktop.docker.com/mac/main/arm64/Docker.dmg (Apple Silicon)
   - Or: https://desktop.docker.com/mac/main/amd64/Docker.dmg (Intel)

2. **Install:**
   ```bash
   # Open the downloaded .dmg file
   # Drag Docker to Applications folder
   # Launch Docker from Applications
   ```

3. **Verify Installation:**
   ```bash
   docker --version
   docker-compose --version
   ```

### Option 2: Homebrew (Alternative)

```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Docker
brew install --cask docker

# Launch Docker Desktop
open /Applications/Docker.app
```

---

## After Docker is Installed

### Deploy the Application

**Option A: Using Docker Compose (Easiest)**
```bash
cd /Users/kimkwangil/Documents/project_03/hanview-react-app-v3
docker-compose up -d
```

**Option B: Using the Deploy Script**
```bash
cd /Users/kimkwangil/Documents/project_03/hanview-react-app-v3
chmod +x deploy-docker.sh
./deploy-docker.sh
```

**Option C: Manual Docker Commands**
```bash
# Build the image
docker build -t hanview-react-app:2.1.0 .

# Stop and remove old container (if exists)
docker stop hanview-react-app 2>/dev/null || true
docker rm hanview-react-app 2>/dev/null || true

# Run the container
docker run -d \
  --name hanview-react-app \
  -p 8080:80 \
  --restart unless-stopped \
  hanview-react-app:2.1.0

# Check status
docker ps
```

---

## Access the Application

After deployment:
- **URL:** http://localhost:8080
- **Health Check:** http://localhost:8080/health

---

## Useful Docker Commands

```bash
# View running containers
docker ps

# View logs
docker logs hanview-react-app
docker logs -f hanview-react-app  # Follow logs

# Stop container
docker stop hanview-react-app

# Start container
docker start hanview-react-app

# Restart container
docker restart hanview-react-app

# Remove container
docker rm -f hanview-react-app

# View resource usage
docker stats hanview-react-app
```

---

## Troubleshooting

### Docker Desktop Won't Start
```bash
# Reset Docker
rm -rf ~/Library/Containers/com.docker.docker
rm -rf ~/Library/Application\ Support/Docker\ Desktop

# Reinstall Docker Desktop
```

### Permission Issues
```bash
# Add yourself to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

### Port 8080 Already in Use
```bash
# Find what's using port 8080
lsof -ti:8080

# Kill the process
kill $(lsof -ti:8080)

# Or use a different port in docker-compose.yml
# Change "8080:80" to "8081:80"
```

---

## Alternative: Deploy Without Docker

If you can't install Docker, you can deploy using the production build directly:

### Option 1: Static Web Server
```bash
# Install a static web server
npm install -g serve

# Serve the production build
serve -s dist -l 8080
```

### Option 2: Nginx (Manual)
```bash
# Build the app
npm run build

# Copy dist/ folder to your web server
# Configure nginx to serve from /dist
```

### Option 3: Deploy to Cloud
See `DOCKER_DEPLOYMENT_INSTRUCTIONS.md` for:
- Vercel (easiest, no Docker needed)
- Netlify
- AWS
- Azure
- GCP

---

## Next Steps

1. Install Docker Desktop from the link above
2. Wait for Docker to start (may take 2-3 minutes)
3. Run the deployment commands
4. Access your app at http://localhost:8080

**For detailed deployment options, see:**
- `DOCKER_DEPLOYMENT_INSTRUCTIONS.md` - Complete Docker guide
- `PRODUCTION_DEPLOYMENT_READY.md` - Quick start guide
