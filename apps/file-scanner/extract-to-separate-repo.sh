#!/bin/bash

# Script to extract file-scanner app to a separate repository
# Usage: ./extract-to-separate-repo.sh /path/to/new/repo

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/new/repository"
  echo "Example: $0 ~/Projects/file-scanner-app"
  exit 1
fi

NEW_REPO_PATH="$1"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Extracting file-scanner app to: $NEW_REPO_PATH"

# Create the new directory
mkdir -p "$NEW_REPO_PATH"

# Copy all files from apps/file-scanner to the new location
echo "Copying files..."
cp -r "$SCRIPT_DIR"/* "$NEW_REPO_PATH/"

# Initialize git repository
cd "$NEW_REPO_PATH"
echo "Initializing git repository..."
git init

# Create initial commit
echo "Creating initial commit..."
git add .
git commit -m "Initial commit: File Scanner & Tagger app

Extracted from foiledbymath-site repository.

Features:
- Intelligent file scanning with OCR support
- Auto-tagging based on file analysis
- macOS Finder integration
- Smart folder creation
"

echo ""
echo "✅ Success! File Scanner app extracted to: $NEW_REPO_PATH"
echo ""
echo "Next steps:"
echo "  cd $NEW_REPO_PATH"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "To push to GitHub:"
echo "  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
echo "  git branch -M main"
echo "  git push -u origin main"
