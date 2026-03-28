# Development Guide

## Project Overview

File Scanner & Tagger is an Electron-based desktop application for macOS that provides intelligent file scanning, tagging, and organization through smart folders.

## Architecture

### Technology Stack

- **Electron**: Desktop application framework
- **Node.js**: Backend processing and file operations
- **HTML/CSS/JavaScript**: Frontend UI
- **Tesseract.js**: OCR engine
- **pdf-parse**: PDF text extraction
- **exif-parser**: Image metadata extraction
- **electron-store**: Persistent data storage

### Application Structure

```
file-scanner/
├── src/
│   ├── main.js           # Electron main process (backend)
│   ├── preload.js        # Secure IPC bridge
│   ├── fileScanner.js    # File analysis engine
│   ├── tagManager.js     # Tag & smart folder management
│   ├── index.html        # UI structure
│   ├── styles.css        # UI styling
│   └── renderer.js       # UI logic (frontend)
├── assets/               # Icons and resources
├── package.json          # Dependencies and build config
└── README.md            # Documentation
```

## Core Components

### 1. Main Process (main.js)

The main process manages:
- Application lifecycle
- Window creation
- IPC handlers for file operations
- Integration between FileScanner and TagManager

**Key Responsibilities:**
- Handle file/directory selection dialogs
- Route scanning requests to FileScanner
- Route tagging requests to TagManager
- Manage application state

### 2. FileScanner (fileScanner.js)

Handles all file analysis:
- File metadata extraction
- Content analysis
- OCR processing
- Tag suggestion algorithm

**Key Methods:**
- `scanFile()`: Scan a single file
- `scanFiles()`: Scan multiple files
- `scanDirectory()`: Recursively scan directories
- `suggestTags()`: Generate tag suggestions
- `extractMetadata()`: Extract EXIF, PDF metadata
- `extractContent()`: Read file content
- `performOCR()`: OCR on images

**Constants:**
- `MAX_CONTENT_LENGTH`: Max characters to extract (10,000)
- `MAX_FILE_SIZE_FOR_CONTENT`: Max file size for content extraction (50MB)

### 3. TagManager (tagManager.js)

Manages tags and macOS integration:
- Tag persistence (electron-store)
- Finder tag synchronization
- Smart folder creation

**Key Methods:**
- `applyTags()`: Apply tags to a file
- `getTags()`: Get tags for a file
- `applyFinderTags()`: Sync with macOS Finder
- `createSmartFolder()`: Create macOS smart folder
- `generateTagPlist()`: Generate macOS plist format

**Security Features:**
- Uses `execFile` instead of `exec` to prevent shell injection
- XML escaping for plist generation
- AppleScript string escaping

### 4. Preload Script (preload.js)

Secure bridge between renderer and main process:
- Uses `contextBridge` for secure IPC
- Exposes limited API to renderer
- No direct Node.js access from UI

### 5. Renderer Process (renderer.js)

Frontend logic:
- UI state management
- Event handlers
- API calls to main process
- File list rendering
- Tag management UI

## Development Workflow

### Setup Development Environment

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Enable logging
npm run dev -- --enable-logging
```

### Code Style

- Use ES6+ features
- Async/await for asynchronous operations
- Proper error handling with try/catch
- Descriptive variable and function names
- Comments for complex logic

### Security Best Practices

1. **Never use shell commands with user input directly**
   - ✅ Use `execFile` with array arguments
   - ❌ Don't use `exec` with string interpolation

2. **Always escape special characters**
   - XML escaping for plist files
   - AppleScript string escaping
   - Path sanitization

3. **Validate file sizes before reading**
   - Check file size before loading into memory
   - Use streaming for large files

4. **Use contextBridge for IPC**
   - Never expose Node.js APIs directly
   - Limit exposed functions

### Adding New Features

#### Adding a New File Type

1. Update `extractMetadata()` in fileScanner.js
2. Update `extractContent()` for text extraction
3. Add MIME type detection
4. Update tag suggestion logic

#### Adding a New Tag Source

1. Update `suggestTags()` in fileScanner.js
2. Add extraction logic
3. Test with various file types

#### Adding UI Features

1. Update `index.html` for structure
2. Update `styles.css` for styling
3. Update `renderer.js` for logic
4. Add IPC handlers in `main.js` if needed

## Testing

### Manual Testing Checklist

- [ ] File selection works
- [ ] Directory scanning works
- [ ] Tags are suggested correctly
- [ ] Tags sync with Finder
- [ ] Smart folders are created
- [ ] OCR works on images
- [ ] PDF parsing works
- [ ] UI is responsive
- [ ] No console errors

### Test Files to Use

- PDF with metadata
- JPEG with EXIF data
- Large text file (>10MB)
- Image with text (for OCR)
- Nested directory structure
- Files with special characters in names

### Security Testing

Run CodeQL before committing:
```bash
# CodeQL scanning happens automatically in CI
```

## Building

### Development Build

```bash
npm run dev
```

### Production Build

```bash
# Build for macOS
npm run build:mac

# Output in dist/ folder
```

### Distribution

The built app includes:
- DMG installer
- ZIP archive
- Code signing (if configured)

## Debugging

### Enable DevTools

Development mode automatically opens DevTools. For production:

```javascript
// In main.js
mainWindow.webContents.openDevTools();
```

### Logging

```javascript
// Main process
console.log('Main:', data);

// Renderer process
console.log('Renderer:', data);

// Check logs
npm run dev -- --enable-logging
```

### Common Issues

**Problem: Tags not syncing**
- Check macOS permissions
- Verify xattr is available
- Test AppleScript manually

**Problem: OCR not working**
- Check internet connection (first run)
- Verify Tesseract.js installation
- Check image format compatibility

**Problem: High memory usage**
- Check file size limits
- Verify streaming is used for large files
- Profile with Chrome DevTools

## Code Review Checklist

Before submitting changes:

- [ ] No security vulnerabilities
- [ ] No shell injection risks
- [ ] Proper error handling
- [ ] Memory leaks prevented
- [ ] UI feedback for all actions
- [ ] Code is commented
- [ ] Constants for magic numbers
- [ ] No console.log in production code

## Performance Optimization

### Best Practices

1. **Lazy Loading**: Load OCR worker only when needed
2. **Batching**: Process files in batches
3. **Caching**: Cache processed results
4. **Streaming**: Use streams for large files
5. **Debouncing**: Debounce UI updates

### Profiling

Use Chrome DevTools:
- Memory profiler for leaks
- Performance profiler for bottlenecks
- Network tab for external requests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run security checks
5. Submit pull request

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Tesseract.js Guide](https://tesseract.projectnaptha.com/)
- [macOS Plist Format](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/AboutInformationPropertyListFiles.html)
- [AppleScript Guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/introduction/ASLR_intro.html)

## License

MIT License - see LICENSE file for details.
