# File Scanner & Tagger

A powerful macOS desktop application for intelligently scanning, analyzing, and tagging files to enable better organization through smart folders.

## Features

### 🔍 Intelligent File Scanning
- **File Name Analysis**: Automatically extract patterns and keywords from file names
- **Directory Structure Analysis**: Understand file organization from folder hierarchy
- **Metadata Extraction**: Extract EXIF data from images, PDF metadata, and more
- **Content Analysis**: Read and analyze text content from documents
- **OCR Support**: Extract text from images and scanned PDFs using Tesseract.js
- **Batch Processing**: Scan individual files or entire directories recursively

### 🏷️ Smart Tagging System
- **Auto-Tag Suggestions**: AI-powered tag suggestions based on file analysis
- **macOS Finder Integration**: Tags sync with macOS Finder for system-wide organization
- **Tag Management**: Easy-to-use interface for applying and managing tags
- **Tag Library**: Browse all tags in use across your files

### ✨ Smart Folders
- **Create Smart Folders**: Build dynamic folders based on tag criteria
- **macOS Integration**: Smart folders integrate with macOS Spotlight and Finder
- **Advanced Filtering**: Filter by tags, file type, date modified, and file size
- **Real-time Updates**: Smart folders automatically update as files are tagged

## Installation

### Prerequisites
- macOS 10.14 or later
- Node.js 16.x or later
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/acapretto/foiledbymath-site.git
cd foiledbymath-site/apps/file-scanner
```

2. Install dependencies:
```bash
npm install
```

3. Run the app in development mode:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build:mac
```

The built app will be in the `dist` folder.

## Usage

### Scanning Files

1. **Select Files**: Click "Select Files" to choose individual files to scan
2. **Select Directory**: Click "Select Directory" to scan an entire folder
3. **Configure Options**:
   - **Analyze Content**: Extract and analyze text content from files
   - **Use OCR**: Perform OCR on images and PDFs (slower but more thorough)
   - **Extract Metadata**: Extract EXIF, PDF metadata, and other file properties
   - **Recursive Scan**: Scan subdirectories when scanning a folder

### Managing Tags

1. **Select a File**: Click on any scanned file in the list
2. **Review Suggestions**: Check the auto-suggested tags based on file analysis
3. **Apply Tags**: 
   - Click on suggested tags to add them to the input field
   - Type custom tags separated by commas
   - Click "Apply" to save tags
4. **Finder Integration**: Tags are automatically synced with macOS Finder

### Creating Smart Folders

1. Click "Create Smart Folder"
2. Enter a folder name
3. Specify tag criteria (comma-separated)
4. Optionally set additional filters:
   - File type (e.g., `public.pdf`)
   - Modified after date
5. Click "Create"

Smart folders appear in macOS Finder under "Saved Searches" in your home directory.

## Tag Suggestions

The app automatically suggests tags based on:

- **File Type**: image, video, document, etc.
- **File Extension**: pdf, jpg, png, etc.
- **File Name Patterns**: invoice, receipt, contract, draft, final
- **Date Information**: year tags, recency (recent, this-month, old)
- **Directory Structure**: Tags from parent folder names
- **Content Keywords**: Most frequent words from file content
- **Metadata**: Camera make/model, PDF author, etc.
- **File Size**: small (<1MB), medium (1-10MB), large (>10MB)

## Technical Details

### Architecture

- **Electron**: Desktop application framework
- **Node.js**: Backend processing
- **Tesseract.js**: OCR engine for text extraction from images
- **pdf-parse**: PDF text and metadata extraction
- **exif-parser**: EXIF data extraction from images
- **electron-store**: Persistent tag database
- **macOS Integration**: AppleScript and xattr for Finder tags

### File Analysis Process

1. **Basic Information**: File name, size, dates, location
2. **MIME Type Detection**: Identify file type
3. **Metadata Extraction**: EXIF for images, metadata for PDFs
4. **Content Analysis**: Text extraction for readable formats
5. **OCR Processing**: Text extraction from images (if enabled)
6. **Tag Suggestion**: AI-powered analysis of all gathered information

### Data Storage

- Tags are stored in two places:
  1. Local database (electron-store) at `~/Library/Application Support/file-scanner-tagger/`
  2. macOS Finder tags (using xattr and AppleScript)

- Smart folder definitions are stored in:
  1. Local database for app reference
  2. `~/Library/Saved Searches/` for macOS Finder integration

## Keyboard Shortcuts

- `Cmd+O`: Open file selector
- `Cmd+Shift+O`: Open directory selector
- `Cmd+,`: Open preferences (future)
- `Cmd+N`: Create new smart folder

## Troubleshooting

### Tags Not Appearing in Finder
- Ensure you have macOS 10.14+ (Mojave or later)
- Grant necessary permissions when prompted
- Try restarting Finder: `killall Finder`

### OCR Not Working
- OCR requires downloading language data on first use
- Ensure you have an active internet connection
- Check that image files are not corrupted

### Performance Issues
- Disable OCR for faster scanning
- Reduce the scope of recursive directory scans
- Process files in smaller batches

## Development

### Project Structure
```
file-scanner/
├── src/
│   ├── main.js           # Electron main process
│   ├── preload.js        # Preload script for IPC
│   ├── fileScanner.js    # File scanning logic
│   ├── tagManager.js     # Tag management and Finder integration
│   ├── index.html        # Main UI
│   ├── styles.css        # Styling
│   └── renderer.js       # UI logic
├── assets/               # Icons and images
├── package.json
└── README.md
```

### Building from Source

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for macOS
npm run build:mac

# Build installer
npm run build
```

## Future Enhancements

- [ ] Import/export tag databases
- [ ] Batch tag operations
- [ ] Custom tag colors
- [ ] Fuzzy search and filtering
- [ ] Tag hierarchies and relationships
- [ ] Machine learning for better tag suggestions
- [ ] Support for cloud storage (Dropbox, Google Drive)
- [ ] Windows and Linux support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Credits

- Built with [Electron](https://www.electronjs.org/)
- OCR powered by [Tesseract.js](https://tesseract.projectnaptha.com/)
- Icons from system emoji

## Support

For issues and questions, please open an issue on GitHub.
