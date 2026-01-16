# Quick Start Guide

## Get Started in 3 Steps

### 1. Install Dependencies

```bash
cd apps/file-scanner
npm install
```

This will install:
- Electron (desktop app framework)
- Tesseract.js (OCR engine)
- PDF parsing libraries
- EXIF metadata extractor
- And other dependencies

### 2. Run the App

```bash
npm run dev
```

The app will launch on your Mac. You'll see the main window with three panels:
- **Left**: Controls and options
- **Center**: File list
- **Right**: File details and tag management

### 3. Scan Your First Files

1. Click **"Select Files"** or **"Select Directory"**
2. Choose files to scan
3. Wait for scanning to complete
4. Click on a file to see details
5. Review suggested tags
6. Click "Apply" to tag the file

## Basic Workflow

### Scanning Files

**Single Files:**
- Click "Select Files"
- Choose one or more files
- Files will be scanned and appear in the list

**Entire Directories:**
- Click "Select Directory"
- Choose a folder
- Enable "Recursive Scan" to include subdirectories
- All files will be scanned automatically

### Scan Options

- **Analyze Content**: Extract and analyze text from files
- **Use OCR**: Perform OCR on images (slower but more accurate)
- **Extract Metadata**: Get EXIF, PDF metadata, etc.
- **Recursive Scan**: Scan subdirectories when scanning folders

### Tagging Files

1. **Select a file** from the list
2. **Review auto-suggested tags** based on file analysis
3. **Add custom tags**:
   - Click suggested tags to add them
   - Type custom tags (comma-separated)
4. **Click "Apply"** to save tags
5. Tags sync with macOS Finder automatically!

### Creating Smart Folders

Smart folders automatically organize files based on tags:

1. Click **"Create Smart Folder"**
2. Enter a **folder name**
3. Specify **tags** (comma-separated)
4. Optional: Add filters (file type, date)
5. Click **"Create"**

Smart folders appear in:
- Finder → Your Home → Library → Saved Searches
- Can be added to Finder sidebar

## Tips & Tricks

### Best Practices

1. **Start Small**: Scan a small folder first to understand the app
2. **Use Descriptive Tags**: Tags like "invoice-2024" are better than just "doc"
3. **Review Suggestions**: Auto-tags are smart but review them before applying
4. **Create Tag Hierarchies**: Use prefixes like "year-2024", "type-invoice"
5. **Disable OCR Initially**: Only enable for images with text

### Performance

- **Large Files**: Files over 50MB skip content extraction
- **OCR Speed**: OCR is slow, use only when needed
- **Batch Processing**: Process files in smaller batches
- **Recursive Scans**: Be cautious with deep directory trees

### macOS Integration

- **Finder Tags**: Tags sync automatically with Finder
- **Spotlight**: Tagged files are searchable via Spotlight
- **Smart Folders**: Appear as saved searches in Finder
- **Colors**: Tag colors in Finder match macOS system colors

## Keyboard Shortcuts

- `Cmd+O`: Select files
- `Cmd+Shift+O`: Select directory
- `Cmd+N`: Create smart folder
- `Cmd+Q`: Quit app

## Common Issues

### Tags Don't Appear in Finder
- Grant permissions when prompted
- Restart Finder: `killall Finder` in Terminal
- Check that file path is accessible

### Scanning is Slow
- Disable OCR option
- Process smaller batches
- Check "Analyze Content" only if needed

### OCR Not Working
- Internet required for first-time language download
- Check that files are valid images
- Try different image formats

## What Gets Tagged?

The app suggests tags based on:

1. **File Type**: image, video, document, pdf, etc.
2. **File Name**: Patterns like "invoice", "receipt", dates
3. **Directory**: Parent folder names
4. **Content**: Keywords from file content
5. **Metadata**: Camera model, PDF author, etc.
6. **Date**: Year, recency (recent, old)
7. **Size**: small, medium, large

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Experiment with smart folder criteria
- Build a tagging system that works for you
- Create smart folders for common searches

## Need Help?

- Check the [README.md](README.md) for troubleshooting
- Review example tag suggestions
- Start with simple tags and build complexity

Happy organizing! 🎉
