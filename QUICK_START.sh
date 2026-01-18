#!/bin/bash
# Quick Start Script for Anchor App

echo "🚀 Starting Anchor App..."
echo ""

# Check if we're in the right directory
if [ ! -d "apps/mobile" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Please run this script from the Anchor- root directory"
    exit 1
fi

# Function to start backend
start_backend() {
    echo "📡 Starting backend server..."
    cd backend
    npm run dev &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    cd ..
}

# Function to start frontend
start_frontend() {
    echo "📱 Starting Expo frontend..."
    cd apps/mobile

    # Try offline mode to avoid network issues
    npx expo start --offline --clear

    cd ../..
}

# Main execution
echo "Choose an option:"
echo "1. Start both frontend and backend"
echo "2. Start frontend only (Expo)"
echo "3. Start backend only (API server)"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        start_backend
        sleep 3
        start_frontend
        ;;
    2)
        start_frontend
        ;;
    3)
        start_backend
        echo "✅ Backend running. Press Ctrl+C to stop."
        wait $BACKEND_PID
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
