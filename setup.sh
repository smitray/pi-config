#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Installing extensions dev dependencies..."
cd extensions && npm install

echo ""
echo "Done. Pi packages (llm-wiki, caveman, observational-memory) auto-install on first startup."
