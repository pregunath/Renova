#!/bin/bash
# Author: Om Sanghvi
# Automated deployment script for Renova project
set -e

echo "====================================="
echo "Starting deployment process..."
echo "====================================="

# Navigate to project directory
cd /home/vm-user/sdmay26-16

# Pull latest changes (reset to remote main to avoid diverged branch issues)
echo "Pulling latest changes from git..."
git fetch origin main
git reset --hard origin/main

# Stop and remove existing containers (including orphans)
echo "Stopping existing containers..."
sudo docker-compose down --remove-orphans

# Kill anything still holding port 8080 (e.g. crashed/orphaned containers)
echo "Ensuring port 8080 is free..."
sudo fuser -k 8080/tcp || true

# Remove old images to force rebuild
echo "Removing old images..."
sudo docker-compose rm -f

# Build and start containers
echo "Building and starting containers..."
sudo docker-compose up -d --build

# Show container status
echo "====================================="
echo "Deployment complete! Container status:"
echo "====================================="
sudo docker-compose ps

# Show logs for verification
echo "====================================="
echo "Recent logs:"
echo "====================================="
sudo docker-compose logs --tail=50
