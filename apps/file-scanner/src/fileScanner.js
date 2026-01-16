const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const pdfParse = require('pdf-parse');
const exifParser = require('exif-parser');
const mime = require('mime-types');

// Constants
const MAX_CONTENT_LENGTH = 10000; // Maximum characters to read from file content
const MAX_FILE_SIZE_FOR_CONTENT = 50 * 1024 * 1024; // 50MB - max file size to read into memory

class FileScanner {
  constructor() {
    this.ocrWorker = null;
  }

  async initOCR() {
    if (!this.ocrWorker) {
      this.ocrWorker = await createWorker('eng');
    }
    return this.ocrWorker;
  }

  async scanFile(filePath, options = {}) {
    const {
      analyzeContent = true,
      useOCR = false,
      extractMetadata = true
    } = options;

    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const directory = path.dirname(filePath);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    const fileInfo = {
      path: filePath,
      name: fileName,
      extension,
      directory,
      mimeType,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      tags: [],
      metadata: {},
      content: null,
      ocrText: null
    };

    // Extract metadata
    if (extractMetadata) {
      fileInfo.metadata = await this.extractMetadata(filePath, mimeType, extension);
    }

    // Analyze content
    if (analyzeContent && !stats.isDirectory()) {
      fileInfo.content = await this.extractContent(filePath, mimeType, extension);
    }

    // Use OCR for images and PDFs if requested
    if (useOCR && this.isImageOrPDF(mimeType, extension)) {
      fileInfo.ocrText = await this.performOCR(filePath, mimeType, extension);
    }

    return fileInfo;
  }

  async scanFiles(filePaths, options = {}) {
    const results = [];
    for (const filePath of filePaths) {
      try {
        const result = await this.scanFile(filePath, options);
        results.push(result);
      } catch (error) {
        results.push({
          path: filePath,
          error: error.message
        });
      }
    }
    return results;
  }

  async scanDirectory(dirPath, options = {}) {
    const { recursive = true, maxDepth = 10 } = options;
    const results = [];

    const scanDir = async (currentPath, depth = 0) => {
      if (depth > maxDepth) return;

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        // Skip hidden files unless specified
        if (entry.name.startsWith('.') && !options.includeHidden) {
          continue;
        }

        try {
          const fileInfo = await this.scanFile(fullPath, options);
          results.push(fileInfo);

          if (entry.isDirectory() && recursive) {
            await scanDir(fullPath, depth + 1);
          }
        } catch (error) {
          console.error(`Error scanning ${fullPath}:`, error);
        }
      }
    };

    await scanDir(dirPath);
    return results;
  }

  async extractMetadata(filePath, mimeType, extension) {
    const metadata = {};

    try {
      // Extract EXIF data from images
      if (mimeType.startsWith('image/') && ['.jpg', '.jpeg', '.tiff'].includes(extension)) {
        const buffer = await fs.readFile(filePath);
        const parser = exifParser.create(buffer);
        const result = parser.parse();
        
        if (result.tags) {
          metadata.exif = {
            make: result.tags.Make,
            model: result.tags.Model,
            dateTime: result.tags.DateTime,
            orientation: result.tags.Orientation,
            software: result.tags.Software,
            imageWidth: result.tags.ImageWidth || result.imageSize?.width,
            imageHeight: result.tags.ImageHeight || result.imageSize?.height
          };
        }
      }

      // Extract PDF metadata
      if (extension === '.pdf') {
        const buffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(buffer);
        metadata.pdf = {
          title: pdfData.info?.Title,
          author: pdfData.info?.Author,
          subject: pdfData.info?.Subject,
          keywords: pdfData.info?.Keywords,
          creator: pdfData.info?.Creator,
          producer: pdfData.info?.Producer,
          creationDate: pdfData.info?.CreationDate,
          modDate: pdfData.info?.ModDate,
          pages: pdfData.numpages
        };
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
    }

    return metadata;
  }

  async extractContent(filePath, mimeType, extension) {
    try {
      // Check file size first to prevent memory exhaustion
      const stats = await fs.stat(filePath);
      if (stats.size > MAX_FILE_SIZE_FOR_CONTENT) {
        console.warn(`File ${filePath} is too large (${stats.size} bytes), skipping content extraction`);
        return null;
      }

      // Extract text from text files
      if (mimeType.startsWith('text/') || ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js'].includes(extension)) {
        const content = await fs.readFile(filePath, 'utf-8');
        return content.substring(0, MAX_CONTENT_LENGTH);
      }

      // Extract text from PDFs
      if (extension === '.pdf') {
        const buffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(buffer);
        return pdfData.text.substring(0, MAX_CONTENT_LENGTH);
      }
    } catch (error) {
      console.error('Error extracting content:', error);
    }

    return null;
  }

  isImageOrPDF(mimeType, extension) {
    return mimeType.startsWith('image/') || extension === '.pdf';
  }

  async performOCR(filePath, mimeType, extension) {
    try {
      const worker = await this.initOCR();
      
      if (extension === '.pdf') {
        // For PDFs, we'd need to convert to images first
        // This is a simplified version
        return null;
      }

      if (mimeType.startsWith('image/')) {
        const { data: { text } } = await worker.recognize(filePath);
        return text;
      }
    } catch (error) {
      console.error('Error performing OCR:', error);
    }

    return null;
  }

  suggestTags(fileInfo) {
    const tags = new Set();

    // Add tags based on file type
    if (fileInfo.mimeType) {
      const mainType = fileInfo.mimeType.split('/')[0];
      tags.add(mainType); // e.g., 'image', 'video', 'audio', 'text'
    }

    // Add tags based on extension
    if (fileInfo.extension) {
      tags.add(fileInfo.extension.substring(1)); // Remove the dot
    }

    // Add tags based on file name patterns
    const lowerName = fileInfo.name.toLowerCase();
    
    // Date patterns in filename
    const datePattern = /(\d{4}[-_]\d{2}[-_]\d{2})|(\d{8})/;
    if (datePattern.test(lowerName)) {
      tags.add('dated');
    }

    // Common document types
    if (lowerName.includes('invoice')) tags.add('invoice');
    if (lowerName.includes('receipt')) tags.add('receipt');
    if (lowerName.includes('contract')) tags.add('contract');
    if (lowerName.includes('report')) tags.add('report');
    if (lowerName.includes('draft')) tags.add('draft');
    if (lowerName.includes('final')) tags.add('final');

    // Year tags
    const yearMatch = lowerName.match(/20\d{2}/);
    if (yearMatch) {
      tags.add(`year-${yearMatch[0]}`);
    }

    // Add tags based on directory structure
    const dirParts = fileInfo.directory.split(path.sep).filter(p => p);
    const lastDirParts = dirParts.slice(-2); // Last 2 directory levels
    lastDirParts.forEach(part => {
      if (part && part.length > 0 && !part.startsWith('.')) {
        tags.add(part.toLowerCase());
      }
    });

    // Add tags based on content keywords (if available)
    if (fileInfo.content) {
      const keywords = this.extractKeywords(fileInfo.content);
      keywords.forEach(kw => tags.add(kw));
    }

    // Add tags based on OCR text (if available)
    if (fileInfo.ocrText) {
      const ocrKeywords = this.extractKeywords(fileInfo.ocrText);
      ocrKeywords.forEach(kw => tags.add(kw));
    }

    // Add tags based on metadata
    if (fileInfo.metadata?.exif?.make) {
      tags.add(fileInfo.metadata.exif.make.toLowerCase());
    }

    if (fileInfo.metadata?.pdf?.author) {
      tags.add(`author-${fileInfo.metadata.pdf.author.toLowerCase().replace(/\s+/g, '-')}`);
    }

    // Add size-based tags
    const sizeMB = fileInfo.size / (1024 * 1024);
    if (sizeMB < 1) tags.add('small');
    else if (sizeMB < 10) tags.add('medium');
    else tags.add('large');

    // Add date-based tags
    const now = new Date();
    const modified = new Date(fileInfo.modified);
    const daysDiff = Math.floor((now - modified) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 7) tags.add('recent');
    else if (daysDiff < 30) tags.add('this-month');
    else if (daysDiff < 365) tags.add('this-year');
    else tags.add('old');

    return Array.from(tags);
  }

  extractKeywords(text) {
    // Stop words to filter out
    const STOP_WORDS = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !STOP_WORDS.has(word));

    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Get top 5 most frequent words
    const sorted = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return sorted;
  }

  async cleanup() {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }
}

module.exports = FileScanner;
