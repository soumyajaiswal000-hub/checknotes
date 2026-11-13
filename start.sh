#!/usr/bin/env bash
# Start the Notes & Daily Checklist App and open in browser
PORT=8080

# Move to the script's directory
cd "$(dirname "$0")"

echo "🚀 Starting Notes & Daily Checklist App..."
echo "📍 Workspace: $(pwd)"

# Attempt to open browser after short delay
(sleep 1 && open "http://localhost:${PORT}" 2>/dev/null || open "http://127.0.0.1:${PORT}" 2>/dev/null) &

# Run server
python3 server.py ${PORT}
