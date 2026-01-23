const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const FileScanner = require('./fileScanner');
const TagManager = require('./tagManager');

let mainWindow;
let fileScanner;
let tagManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f5'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Initialize scanner and tag manager
  fileScanner = new FileScanner();
  tagManager = new TagManager();

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Directory to Scan'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'Select Files to Scan'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

ipcMain.handle('scan-files', async (event, paths, options) => {
  try {
    const results = await fileScanner.scanFiles(paths, options);
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('scan-directory', async (event, dirPath, options) => {
  try {
    const results = await fileScanner.scanDirectory(dirPath, options);
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('apply-tags', async (event, filePath, tags) => {
  try {
    await tagManager.applyTags(filePath, tags);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-tags', async (event, filePath) => {
  try {
    const tags = await tagManager.getTags(filePath);
    return { success: true, data: tags };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-tags', async () => {
  try {
    const tags = await tagManager.getAllTags();
    return { success: true, data: tags };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-smart-folder', async (event, folderName, criteria) => {
  try {
    await tagManager.createSmartFolder(folderName, criteria);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auto-tag-file', async (event, filePath) => {
  try {
    const scanResult = await fileScanner.scanFile(filePath, {
      analyzeContent: true,
      useOCR: true,
      extractMetadata: true
    });
    const suggestedTags = fileScanner.suggestTags(scanResult);
    return { success: true, data: suggestedTags };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
