const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const Store = require('electron-store');

const execFileAsync = promisify(execFile);

class TagManager {
  constructor() {
    // Store for managing tags database
    this.store = new Store({
      name: 'file-tags',
      defaults: {
        tags: {}, // { filePath: [tag1, tag2, ...] }
        allTags: [], // [tag1, tag2, tag3, ...]
        smartFolders: {} // { folderName: { criteria } }
      }
    });
  }

  /**
   * Apply macOS Finder tags to a file
   * Uses the 'tag' command-line tool or xattr with proper escaping
   */
  async applyFinderTags(filePath, tags) {
    if (process.platform !== 'darwin') {
      console.warn('Finder tags are only supported on macOS');
      return;
    }

    try {
      const plistContent = this.generateTagPlist(tags);
      
      // Write tags using xattr with proper file path handling
      await execFileAsync('xattr', [
        '-w',
        'com.apple.metadata:_kMDItemUserTags',
        plistContent,
        filePath
      ]);
      
      // Also set Finder tags using osascript (AppleScript)
      // Use proper escaping for AppleScript strings
      const escapeAppleScript = (str) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const tagsAppleScript = tags.map(tag => `"${escapeAppleScript(tag)}"`).join(', ');
      const script = `tell application "Finder"
  set theFile to POSIX file "${escapeAppleScript(filePath)}" as alias
  set tags of theFile to {${tagsAppleScript}}
end tell`;
      
      await execFileAsync('osascript', ['-e', script]);
    } catch (error) {
      console.error('Error applying Finder tags:', error);
      throw error;
    }
  }

  /**
   * Generate plist format for macOS tags with proper XML escaping
   */
  generateTagPlist(tags) {
    const escapeXML = (str) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    const tagElements = tags.map(tag => `<string>${escapeXML(tag)}</string>`).join('');
    return `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array>${tagElements}</array></plist>`;
  }

  /**
   * Get Finder tags from a file
   */
  async getFinderTags(filePath) {
    if (process.platform !== 'darwin') {
      return [];
    }

    try {
      const { stdout } = await execFileAsync('xattr', [
        '-p',
        'com.apple.metadata:_kMDItemUserTags',
        filePath
      ]).catch(() => ({ stdout: '' }));
      
      if (!stdout.trim()) {
        return [];
      }

      // Parse the plist output
      const tagMatches = stdout.matchAll(/<string>(.*?)<\/string>/g);
      const tags = Array.from(tagMatches).map(match => match[1]);
      
      return tags;
    } catch (error) {
      return [];
    }
  }

  /**
   * Apply tags to a file (both in our database and as Finder tags)
   */
  async applyTags(filePath, tags) {
    // Normalize tags
    const normalizedTags = tags.map(tag => tag.trim().toLowerCase());
    
    // Store in our database
    const currentTags = this.store.get('tags') || {};
    currentTags[filePath] = normalizedTags;
    this.store.set('tags', currentTags);

    // Update all tags list
    this.updateAllTagsList(normalizedTags);

    // Apply to Finder (macOS only)
    if (process.platform === 'darwin') {
      try {
        await this.applyFinderTags(filePath, normalizedTags);
      } catch (error) {
        console.error('Failed to apply Finder tags:', error);
        // Continue even if Finder tags fail
      }
    }
  }

  /**
   * Get tags for a specific file
   */
  async getTags(filePath) {
    const tags = this.store.get('tags') || {};
    return tags[filePath] || [];
  }

  /**
   * Get all unique tags across all files
   */
  async getAllTags() {
    return this.store.get('allTags') || [];
  }

  /**
   * Update the list of all unique tags
   */
  updateAllTagsList(newTags) {
    const allTags = new Set(this.store.get('allTags') || []);
    newTags.forEach(tag => allTags.add(tag));
    this.store.set('allTags', Array.from(allTags).sort());
  }

  /**
   * Remove tags from a file
   */
  async removeTags(filePath, tagsToRemove) {
    const tags = this.store.get('tags') || {};
    if (tags[filePath]) {
      tags[filePath] = tags[filePath].filter(tag => !tagsToRemove.includes(tag));
      this.store.set('tags', tags);

      // Also remove from Finder if on macOS
      if (process.platform === 'darwin') {
        try {
          await this.applyFinderTags(filePath, tags[filePath]);
        } catch (error) {
          console.error('Failed to update Finder tags:', error);
        }
      }
    }
  }

  /**
   * Get all files with a specific tag
   */
  getFilesByTag(tag) {
    const tags = this.store.get('tags') || {};
    const files = [];

    for (const [filePath, fileTags] of Object.entries(tags)) {
      if (fileTags.includes(tag)) {
        files.push(filePath);
      }
    }

    return files;
  }

  /**
   * Create a macOS Smart Folder based on tag criteria
   */
  async createSmartFolder(folderName, criteria) {
    if (process.platform !== 'darwin') {
      throw new Error('Smart folders are only supported on macOS');
    }

    const { tags, conditions } = criteria;
    const userHome = process.env.HOME;
    const savedSearchesPath = path.join(userHome, 'Library', 'Saved Searches');

    // Create saved searches directory if it doesn't exist
    try {
      await fs.mkdir(savedSearchesPath, { recursive: true });
    } catch (error) {
      console.error('Error creating saved searches directory:', error);
    }

    // Generate the smart folder query
    const query = this.generateSmartFolderQuery(tags, conditions);
    const savedSearchPath = path.join(savedSearchesPath, `${folderName}.savedSearch`);

    // Create the plist for the smart folder
    const plistContent = this.generateSmartFolderPlist(folderName, query);

    // Write the plist file using Node.js fs
    try {
      await fs.mkdir(savedSearchPath, { recursive: true });
      const plistPath = path.join(savedSearchPath, 'query.plist');
      await fs.writeFile(plistPath, plistContent, 'utf-8');
      
      // Store in our database
      const smartFolders = this.store.get('smartFolders') || {};
      smartFolders[folderName] = criteria;
      this.store.set('smartFolders', smartFolders);

      return savedSearchPath;
    } catch (error) {
      console.error('Error creating smart folder:', error);
      throw error;
    }
  }

  /**
   * Generate Spotlight query for smart folder
   */
  generateSmartFolderQuery(tags, conditions = {}) {
    const queryParts = [];

    // Add tag conditions
    if (tags && tags.length > 0) {
      const tagQueries = tags.map(tag => `kMDItemUserTags == "${tag}"`);
      queryParts.push(`(${tagQueries.join(' || ')})`);
    }

    // Add additional conditions
    if (conditions.fileType) {
      queryParts.push(`kMDItemContentType == "${conditions.fileType}"`);
    }

    if (conditions.modifiedAfter) {
      const date = new Date(conditions.modifiedAfter).toISOString();
      queryParts.push(`kMDItemFSContentChangeDate >= $time.iso(${date})`);
    }

    if (conditions.sizeMin) {
      queryParts.push(`kMDItemFSSize >= ${conditions.sizeMin}`);
    }

    if (conditions.sizeMax) {
      queryParts.push(`kMDItemFSSize <= ${conditions.sizeMax}`);
    }

    return queryParts.join(' && ') || 'kMDItemFSSize > 0';
  }

  /**
   * Generate plist content for smart folder
   */
  generateSmartFolderPlist(folderName, query) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CompatibleVersion</key>
  <integer>1</integer>
  <key>RawQuery</key>
  <string>${query}</string>
  <key>RawQueryDict</key>
  <dict>
    <key>FinderSpawnTab</key>
    <false/>
    <key>RawQuery</key>
    <string>${query}</string>
    <key>SearchScopes</key>
    <array>
      <string>kMDQueryScopeComputer</string>
    </array>
  </dict>
  <key>SearchCriteria</key>
  <dict>
    <key>FXScopeArrayOfPaths</key>
    <array/>
    <key>FXCriteriaSlices</key>
    <array/>
  </dict>
</dict>
</plist>`;
  }

  /**
   * Get all smart folders
   */
  getSmartFolders() {
    return this.store.get('smartFolders') || {};
  }

  /**
   * Delete a smart folder
   */
  async deleteSmartFolder(folderName) {
    const smartFolders = this.store.get('smartFolders') || {};
    delete smartFolders[folderName];
    this.store.set('smartFolders', smartFolders);

    // Also delete from file system if on macOS
    if (process.platform === 'darwin') {
      const userHome = process.env.HOME;
      const savedSearchPath = path.join(userHome, 'Library', 'Saved Searches', `${folderName}.savedSearch`);
      
      try {
        await fs.rm(savedSearchPath, { recursive: true, force: true });
      } catch (error) {
        console.error('Error deleting smart folder file:', error);
      }
    }
  }

  /**
   * Export tags database
   */
  exportTags() {
    return {
      tags: this.store.get('tags'),
      allTags: this.store.get('allTags'),
      smartFolders: this.store.get('smartFolders')
    };
  }

  /**
   * Import tags database
   */
  importTags(data) {
    if (data.tags) this.store.set('tags', data.tags);
    if (data.allTags) this.store.set('allTags', data.allTags);
    if (data.smartFolders) this.store.set('smartFolders', data.smartFolders);
  }
}

module.exports = TagManager;
