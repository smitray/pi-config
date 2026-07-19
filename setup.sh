#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Installing extensions dev dependencies..."
cd extensions && npm install && cd ..

echo ""
echo "Installing tools via mise..."
mise install

echo ""
echo "Done. Restart pi to load new packages."
