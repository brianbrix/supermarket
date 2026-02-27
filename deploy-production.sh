#!/bin/bash

# Deployment script for Supermarket Application
# This script adds the supermarket application to your existing Traefik setup

set -e

echo "🚀 Starting Supermarket Deployment..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script should be run as root or with sudo"
    exit 1
fi

# Check if Traefik network exists
if ! docker network inspect hotspot_default >/dev/null 2>&1; then
    echo "❌ Network 'hotspot_default' not found!"
    echo "Please ensure your Traefik/phpnuxbill deployment is running."
    echo ""
    echo "To check existing networks, run: docker network ls"
    exit 1
fi

echo "✅ Found existing hotspot_default network"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    echo "Please create .env.production from .env.production template"
    exit 1
fi

# Load environment variables
set -a
source .env.production
set +a

echo "✅ Environment variables loaded"

# Pull latest images
echo "📦 Pulling Docker images..."
docker compose -f docker-compose.production.yml pull || echo "⚠️  Some images need to be built"

# Build images
echo "🔨 Building application images..."
docker compose -f docker-compose.production.yml build --no-cache

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.production.yml down

# Start services
echo "🎬 Starting services..."
docker compose -f docker-compose.production.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗃️  Running database migrations..."
docker compose -f docker-compose.production.yml exec -T supermarket_backend php artisan migrate --force

# Clear and cache config
echo "🧹 Optimizing application..."
docker compose -f docker-compose.production.yml exec -T supermarket_backend php artisan config:cache
docker compose -f docker-compose.production.yml exec -T supermarket_backend php artisan route:cache
docker compose -f docker-compose.production.yml exec -T supermarket_backend php artisan view:cache

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
docker compose -f docker-compose.production.yml ps
echo ""
echo "🌐 Your supermarket application should be available at:"
echo "   - https://shop.afyaquik.com"
echo ""
echo "📝 Note: Your existing phpnuxbill deployment at hotspot.afyaquik.com remains unchanged"
echo ""
echo "📝 Useful commands:"
echo "   - View logs: docker compose -f docker-compose.production.yml logs -f"
echo "   - Stop supermarket: docker compose -f docker-compose.production.yml down"
echo "   - Restart supermarket: docker compose -f docker-compose.production.yml restart"
echo ""
