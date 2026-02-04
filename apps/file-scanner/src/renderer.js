// UI State
let scannedFiles = [];
let selectedFile = null;
let allTags = [];

// DOM Elements
const selectFilesBtn = document.getElementById('select-files-btn');
const selectDirectoryBtn = document.getElementById('select-directory-btn');
const fileList = document.getElementById('file-list');
const fileDetails = document.getElementById('file-details');
const statusMessage = document.getElementById('status-message');
const progressIndicator = document.getElementById('progress-indicator');
const progressText = document.getElementById('progress-text');
const fileCount = document.getElementById('file-count');
const allTagsContainer = document.getElementById('all-tags');

// Scan options
const analyzeContentCheck = document.getElementById('analyze-content');
const useOCRCheck = document.getElementById('use-ocr');
const extractMetadataCheck = document.getElementById('extract-metadata');
const recursiveScanCheck = document.getElementById('recursive-scan');

// Smart folder elements
const createSmartFolderBtn = document.getElementById('create-smart-folder-btn');
const smartFoldersListEl = document.getElementById('smart-folders-list');
const smartFolderModal = document.getElementById('smart-folder-modal');
const closeModalBtn = document.querySelector('.close-modal');
const cancelSmartFolderBtn = document.getElementById('cancel-smart-folder');
const createSmartFolderSubmitBtn = document.getElementById('create-smart-folder');

// Event Listeners
selectFilesBtn.addEventListener('click', handleSelectFiles);
selectDirectoryBtn.addEventListener('click', handleSelectDirectory);
createSmartFolderBtn.addEventListener('click', openSmartFolderModal);
closeModalBtn.addEventListener('click', closeSmartFolderModal);
cancelSmartFolderBtn.addEventListener('click', closeSmartFolderModal);
createSmartFolderSubmitBtn.addEventListener('click', handleCreateSmartFolder);

// Initialize
init();

async function init() {
  await loadAllTags();
  updateStatus('Ready');
}

// File selection handlers
async function handleSelectFiles() {
  const filePaths = await window.electronAPI.selectFiles();
  if (filePaths && filePaths.length > 0) {
    await scanFiles(filePaths);
  }
}

async function handleSelectDirectory() {
  const dirPath = await window.electronAPI.selectDirectory();
  if (dirPath) {
    await scanDirectory(dirPath);
  }
}

// Scanning functions
async function scanFiles(filePaths) {
  showProgress('Scanning files...');
  
  const options = {
    analyzeContent: analyzeContentCheck.checked,
    useOCR: useOCRCheck.checked,
    extractMetadata: extractMetadataCheck.checked
  };

  const result = await window.electronAPI.scanFiles(filePaths, options);
  
  if (result.success) {
    scannedFiles = result.data;
    renderFileList();
    updateStatus(`Scanned ${result.data.length} files`);
  } else {
    updateStatus(`Error: ${result.error}`, 'error');
  }
  
  hideProgress();
}

async function scanDirectory(dirPath) {
  showProgress('Scanning directory...');
  
  const options = {
    analyzeContent: analyzeContentCheck.checked,
    useOCR: useOCRCheck.checked,
    extractMetadata: extractMetadataCheck.checked,
    recursive: recursiveScanCheck.checked
  };

  const result = await window.electronAPI.scanDirectory(dirPath, options);
  
  if (result.success) {
    scannedFiles = result.data;
    renderFileList();
    updateStatus(`Scanned ${result.data.length} files from ${dirPath}`);
  } else {
    updateStatus(`Error: ${result.error}`, 'error');
  }
  
  hideProgress();
}

// Rendering functions
function renderFileList() {
  if (scannedFiles.length === 0) {
    fileList.innerHTML = `
      <div class="empty-state-large">
        <span class="icon">📂</span>
        <p>Select files or a directory to start scanning</p>
      </div>
    `;
    fileCount.textContent = '0';
    return;
  }

  fileCount.textContent = scannedFiles.length;

  fileList.innerHTML = scannedFiles.map((file, index) => `
    <div class="file-item" data-index="${index}" onclick="selectFile(${index})">
      <div class="file-item-header">
        <span class="file-icon">${getFileIcon(file.mimeType, file.extension)}</span>
        <span class="file-name">${file.name}</span>
      </div>
      <div class="file-info">
        <span>📏 ${formatFileSize(file.size)}</span>
        <span>📅 ${formatDate(file.modified)}</span>
        <span>📍 ${file.extension || 'no ext'}</span>
      </div>
      <div class="file-tags">
        ${file.tags && file.tags.length > 0 
          ? file.tags.map(tag => `<span class="file-tag">${tag}</span>`).join('') 
          : '<span class="file-tag">No tags</span>'}
      </div>
    </div>
  `).join('');
}

function selectFile(index) {
  selectedFile = scannedFiles[index];
  
  // Update selection UI
  document.querySelectorAll('.file-item').forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });

  renderFileDetails();
}

async function renderFileDetails() {
  if (!selectedFile) {
    fileDetails.innerHTML = `
      <div class="empty-state-large">
        <span class="icon">🏷️</span>
        <p>Select a file to view details and manage tags</p>
      </div>
    `;
    return;
  }

  // Get existing tags
  const tagsResult = await window.electronAPI.getTags(selectedFile.path);
  const existingTags = tagsResult.success ? tagsResult.data : [];

  // Get auto-suggested tags
  const suggestedResult = await window.electronAPI.autoTagFile(selectedFile.path);
  const suggestedTags = suggestedResult.success ? suggestedResult.data : [];

  fileDetails.innerHTML = `
    <h3>${selectedFile.name}</h3>
    
    <div class="detail-section">
      <h4>File Information</h4>
      <div class="detail-row">
        <span class="detail-label">Path:</span>
        <span class="detail-value" title="${selectedFile.path}">${truncatePath(selectedFile.path)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Size:</span>
        <span class="detail-value">${formatFileSize(selectedFile.size)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Type:</span>
        <span class="detail-value">${selectedFile.mimeType}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Modified:</span>
        <span class="detail-value">${formatDate(selectedFile.modified)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Created:</span>
        <span class="detail-value">${formatDate(selectedFile.created)}</span>
      </div>
    </div>

    ${selectedFile.metadata && Object.keys(selectedFile.metadata).length > 0 ? `
      <div class="detail-section">
        <h4>Metadata</h4>
        ${renderMetadata(selectedFile.metadata)}
      </div>
    ` : ''}

    <div class="detail-section">
      <h4>Manage Tags</h4>
      
      ${suggestedTags.length > 0 ? `
        <div class="suggested-tags">
          <div class="suggested-tags-title">Suggested Tags:</div>
          <div class="tag-cloud">
            ${suggestedTags.map(tag => 
              `<span class="suggested-tag" onclick="addSuggestedTag('${tag}')">${tag}</span>`
            ).join('')}
          </div>
        </div>
      ` : ''}

      <div class="tag-input-container">
        <input type="text" id="tag-input" class="tag-input" placeholder="Enter tags (comma-separated)">
        <button class="btn btn-primary btn-small" onclick="applyTags()">Apply</button>
      </div>

      <div class="tag-cloud">
        ${existingTags.length > 0 
          ? existingTags.map(tag => `<span class="tag">${tag}</span>`).join('')
          : '<span class="empty-state">No tags applied yet</span>'}
      </div>
    </div>
  `;
}

function renderMetadata(metadata) {
  let html = '';

  if (metadata.exif) {
    const exif = metadata.exif;
    html += '<div style="margin-bottom: 12px;"><strong>EXIF Data:</strong></div>';
    if (exif.make) html += `<div class="detail-row"><span class="detail-label">Camera:</span><span class="detail-value">${exif.make} ${exif.model || ''}</span></div>`;
    if (exif.dateTime) html += `<div class="detail-row"><span class="detail-label">Date Taken:</span><span class="detail-value">${formatDate(exif.dateTime)}</span></div>`;
    if (exif.imageWidth) html += `<div class="detail-row"><span class="detail-label">Dimensions:</span><span class="detail-value">${exif.imageWidth}x${exif.imageHeight}</span></div>`;
  }

  if (metadata.pdf) {
    const pdf = metadata.pdf;
    html += '<div style="margin-bottom: 12px; margin-top: 16px;"><strong>PDF Metadata:</strong></div>';
    if (pdf.title) html += `<div class="detail-row"><span class="detail-label">Title:</span><span class="detail-value">${pdf.title}</span></div>`;
    if (pdf.author) html += `<div class="detail-row"><span class="detail-label">Author:</span><span class="detail-value">${pdf.author}</span></div>`;
    if (pdf.pages) html += `<div class="detail-row"><span class="detail-label">Pages:</span><span class="detail-value">${pdf.pages}</span></div>`;
  }

  return html;
}

async function applyTags() {
  const tagInput = document.getElementById('tag-input');
  const tagsText = tagInput.value.trim();
  
  if (!tagsText) {
    return;
  }

  const tags = tagsText.split(',').map(t => t.trim()).filter(t => t);
  
  showProgress('Applying tags...');
  const result = await window.electronAPI.applyTags(selectedFile.path, tags);
  
  if (result.success) {
    updateStatus(`Tags applied to ${selectedFile.name}`);
    tagInput.value = '';
    
    // Update the file in our list
    selectedFile.tags = tags;
    renderFileList();
    renderFileDetails();
    await loadAllTags();
  } else {
    updateStatus(`Error applying tags: ${result.error}`, 'error');
  }
  
  hideProgress();
}

async function addSuggestedTag(tag) {
  const tagInput = document.getElementById('tag-input');
  const currentTags = tagInput.value.trim();
  
  if (currentTags) {
    tagInput.value = `${currentTags}, ${tag}`;
  } else {
    tagInput.value = tag;
  }
}

// Load and render all tags
async function loadAllTags() {
  const result = await window.electronAPI.getAllTags();
  
  if (result.success) {
    allTags = result.data;
    renderAllTags();
  }
}

function renderAllTags() {
  if (allTags.length === 0) {
    allTagsContainer.innerHTML = '<p class="empty-state">No tags yet</p>';
    return;
  }

  allTagsContainer.innerHTML = allTags.map(tag => 
    `<span class="tag">${tag}</span>`
  ).join('');
}

// Smart Folder functions
function openSmartFolderModal() {
  smartFolderModal.classList.remove('hidden');
}

function closeSmartFolderModal() {
  smartFolderModal.classList.add('hidden');
  // Clear form
  document.getElementById('folder-name').value = '';
  document.getElementById('folder-tags').value = '';
  document.getElementById('file-type').value = '';
  document.getElementById('modified-after').value = '';
}

async function handleCreateSmartFolder() {
  const folderName = document.getElementById('folder-name').value.trim();
  const tagsText = document.getElementById('folder-tags').value.trim();
  const fileType = document.getElementById('file-type').value.trim();
  const modifiedAfter = document.getElementById('modified-after').value;

  if (!folderName) {
    updateStatus('Please enter a folder name', 'error');
    return;
  }

  const tags = tagsText ? tagsText.split(',').map(t => t.trim()).filter(t => t) : [];
  
  const criteria = {
    tags,
    conditions: {}
  };

  if (fileType) criteria.conditions.fileType = fileType;
  if (modifiedAfter) criteria.conditions.modifiedAfter = modifiedAfter;

  showProgress('Creating smart folder...');
  const result = await window.electronAPI.createSmartFolder(folderName, criteria);

  if (result.success) {
    updateStatus(`Smart folder "${folderName}" created`);
    closeSmartFolderModal();
    await loadSmartFolders();
  } else {
    updateStatus(`Error creating smart folder: ${result.error}`, 'error');
  }

  hideProgress();
}

async function loadSmartFolders() {
  // TODO: Implement this if we add a get smart folders endpoint
  smartFoldersListEl.innerHTML = '<p class="empty-state">Smart folders created</p>';
}

// Utility functions
function getFileIcon(mimeType, extension) {
  if (!mimeType) return '📄';
  
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('text/')) return '📝';
  if (extension === '.pdf') return '📕';
  if (extension === '.zip' || extension === '.tar' || extension === '.gz') return '📦';
  
  return '📄';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function truncatePath(path, maxLength = 40) {
  if (path.length <= maxLength) return path;
  return '...' + path.slice(-(maxLength - 3));
}

function showProgress(message) {
  progressText.textContent = message;
  progressIndicator.classList.remove('hidden');
}

function hideProgress() {
  progressIndicator.classList.add('hidden');
}

function updateStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = type === 'error' ? 'error' : '';
  
  if (type === 'error') {
    statusMessage.style.color = '#d32f2f';
  } else {
    statusMessage.style.color = '#666';
  }
}
