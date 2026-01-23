# Extracting to a Separate Repository

This directory contains a complete, self-contained File Scanner & Tagger application that can be moved to its own repository.

## Quick Extract (Recommended)

Use the provided script:

```bash
cd apps/file-scanner
./extract-to-separate-repo.sh ~/Projects/file-scanner-app
```

This will:
1. Copy all files to the new location
2. Initialize a new git repository
3. Create an initial commit
4. Provide instructions for pushing to GitHub

## Manual Extract

If you prefer to do it manually:

```bash
# Copy the directory
cp -r apps/file-scanner /path/to/new/file-scanner-repo
cd /path/to/new/file-scanner-repo

# Remove the extraction helper files (optional)
rm extract-to-separate-repo.sh
rm EXTRACT.md

# Initialize git
git init
git add .
git commit -m "Initial commit: File Scanner & Tagger app"

# Connect to GitHub (create repo on GitHub first)
git remote add origin https://github.com/YOUR_USERNAME/file-scanner.git
git branch -M main
git push -u origin main
```

## After Extraction

Once extracted, you can work on the app independently:

```bash
cd /path/to/new/file-scanner-repo
npm install
npm run dev
```

See [README.md](README.md) for full documentation.
See [QUICKSTART.md](QUICKSTART.md) for a quick start guide.
See [DEVELOPMENT.md](DEVELOPMENT.md) for development guidelines.

## Note

This app is completely self-contained with:
- All source code in `src/`
- All dependencies in `package.json`
- Complete documentation
- Build configuration

It has no dependencies on the parent `foiledbymath-site` repository.
