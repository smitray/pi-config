#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Installing extensions dev dependencies..."
cd extensions && npm install

echo ""
echo "Done. Pi package (observational-memory) auto-installs on first startup."
