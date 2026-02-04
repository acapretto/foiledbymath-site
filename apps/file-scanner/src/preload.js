const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  scanFiles: (paths, options) => ipcRenderer.invoke('scan-files', paths, options),
  scanDirectory: (dirPath, options) => ipcRenderer.invoke('scan-directory', dirPath, options),
  applyTags: (filePath, tags) => ipcRenderer.invoke('apply-tags', filePath, tags),
  getTags: (filePath) => ipcRenderer.invoke('get-tags', filePath),
  getAllTags: () => ipcRenderer.invoke('get-all-tags'),
  createSmartFolder: (folderName, criteria) => ipcRenderer.invoke('create-smart-folder', folderName, criteria),
  autoTagFile: (filePath) => ipcRenderer.invoke('auto-tag-file', filePath)
});
