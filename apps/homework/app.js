// App Version
const APP_VERSION = '1.0.0';
const UPDATE_CHECK_URL = 'https://foiledbymath.com/apps/homework-dictation/version.json';

// Vault State
let sessionToken = null;
let vaultAutoLockTimer = null;
const VAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_CACHE_MS = 10 * 60 * 1000; // 10 minutes

// Speech Recognition Setup
let recognition;
let isRecording = false;
let finalTranscript = '';

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        const transcription = document.getElementById('transcription');
        if (transcription) {
            transcription.value = finalTranscript + interimTranscript;
            updateDescriptionPreview();
            applyInferenceFromText(transcription.value);
            if (dueDateAutoEnabled) {
                const inferred = inferDueDateFromText(transcription.value);
                if (inferred) setDueDateInput(inferred);
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = 'Error: ' + event.error;
        
        // Provide helpful messages for common errors
        if (event.error === 'not-allowed') {
            errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings and make sure you\'re using http://localhost:5001 (not file://)';
        } else if (event.error === 'no-speech') {
            errorMessage = 'No speech detected. Please try again and speak clearly.';
        } else if (event.error === 'network') {
            errorMessage = 'Network error. Please check your internet connection.';
        }
        
        showMessage(errorMessage, 'error');
        stopRecording();
    };

    recognition.onend = () => {
        if (isRecording) {
            recognition.start(); // Restart if still recording
        }
    };
} else {
    alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
}

// Course management
let courses = [];
let fetchedCourses = [];
let deferredInstallPrompt = null;
let dueDateAutoEnabled = true;
let assignmentGroups = [];
let assignmentGroupsByCourse = {};
let autoTitleEnabled = true;
let lastAutoTitle = '';

console.log('App.js loaded successfully');

// Load configuration on startup
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    bindUiEvents();
    setupInstallPrompt();
    applyDefaultSetupValues();
    loadConfig();
    setDefaultTitle();
    setDefaultDueDate();
    checkForUpdates();

    // Load saved assignment group or default to 'Homework'
    const savedGroup = localStorage.getItem('lastAssignmentGroup');
    const groupInput = document.getElementById('assignmentGroup');
    if (groupInput) {
        groupInput.value = savedGroup || 'Homework';
    }
    
    // Toggle assignment fields based on post type
    document.querySelectorAll('input[name="postType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const assignmentFields = document.getElementById('assignmentFields');
            if (e.target.value === 'assignment') {
                assignmentFields.classList.remove('hidden');
            } else {
                assignmentFields.classList.add('hidden');
            }
        });
    });

    const dueDateInput = document.getElementById('dueDate');
    if (dueDateInput) {
        dueDateInput.addEventListener('change', () => {
            dueDateAutoEnabled = false;
        });
    }

    const transcriptionInput = document.getElementById('transcription');
    if (transcriptionInput) {
        transcriptionInput.addEventListener('input', () => {
            if (!dueDateAutoEnabled) return;
            const inferred = inferDueDateFromText(transcriptionInput.value);
            if (inferred) setDueDateInput(inferred);
        });
        transcriptionInput.addEventListener('input', updateDescriptionPreview);
        transcriptionInput.addEventListener('input', () => {
            applyInferenceFromText(transcriptionInput.value);
        });
    }

    setupKeyboardShortcuts();
});

function bindUiEvents() {
    const bindClick = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    };

    bindClick('showSyncLoginBtn', showSyncLogin);
    bindClick('syncDownloadBtn', pullSyncData);
    bindClick('syncBackBtn', hideSyncLogin);
    bindClick('unlockVaultBtn', unlockVaultHandler);
    bindClick('resetVaultBtn', resetVaultHandler);
    bindClick('lockVaultBtn', lockVaultHandler);
    bindClick('toggleSyncMenuBtn', toggleSyncMenu);
    bindClick('syncBackupBtn', pushSyncData);
    bindClick('addCourseBtn', addCourse);
    bindClick('saveConfigBtn', saveConfig);
    bindClick('toggleAllBtn', toggleAllCourses);
    bindClick('recordBtn', toggleRecording);
    bindClick('clearBtn', clearText);
    bindClick('postBtn', postToCanvas);
    bindClick('showConfigBtn', showConfig);
    bindClick('fetchCoursesBtn', fetchCanvasCourses);
    bindClick('addFetchedCoursesBtn', addSelectedFetchedCourses);
    bindClick('deleteCloudBackupBtn', deleteCloudBackup);
    bindClick('eraseLocalDataBtn', eraseLocalData);
    bindClick('toggleManualCoursesBtn', toggleManualCourses);
    bindClick('openInCanvasBtn', openLastPostedInCanvas);
    bindClick('installAppBtn', handleInstallClick);
    bindClick('inlineUnlockBtn', inlineUnlockHandler);
    bindNewsletterGate();
}

function bindNewsletterGate() {
    const checkbox = document.getElementById('newsletterOptIn');
    const syncBtn = document.getElementById('syncBackupBtn');

    if (!checkbox || !syncBtn) return;

    const updateState = () => {
        syncBtn.disabled = !checkbox.checked;
    };

    checkbox.addEventListener('change', updateState);
    updateState();
}

function applyDefaultSetupValues() {
    const accessCodeInput = document.getElementById('accessCode');
    if (accessCodeInput && !accessCodeInput.value) {
        accessCodeInput.value = 'FOILED-BY-MATH';
    }

    const canvasUrlInput = document.getElementById('canvasUrl');
    if (canvasUrlInput && !canvasUrlInput.value) {
        canvasUrlInput.value = 'https://wjhsd.instructure.com';
    }
}

function toggleManualCourses() {
    const section = document.getElementById('manualCourseSection');
    const button = document.getElementById('toggleManualCoursesBtn');
    if (!section || !button) return;

    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
    button.textContent = isHidden ? 'Hide Manual Course Entry' : 'Manually Add Courses';
}

function setupKeyboardShortcuts() {
    const configSection = document.getElementById('configSection');
    if (configSection) {
        configSection.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                if (target && target.id === 'newCourseId') {
                    e.preventDefault();
                    addCourse();
                } else if (target && target.id === 'newCourseNickname') {
                    e.preventDefault();
                    document.getElementById('newCourseId').focus();
                } else if (target && target.tagName === 'INPUT') {
                    e.preventDefault();
                    saveConfig();
                }
            }
        });
    }

    const inlinePass = document.getElementById('inlineUnlockPass');
    if (inlinePass) {
        inlinePass.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                inlineUnlockHandler();
            }
        });
    }

    const titleInput = document.getElementById('title');
    const transcription = document.getElementById('transcription');

    if (titleInput) {
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (transcription) transcription.focus();
            }
        });
        titleInput.addEventListener('input', () => {
            autoTitleEnabled = false;
        });
    }

    if (transcription) {
        transcription.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                postToCanvas();
            }
        });
    }
}

function convertDictationToHtml(text) {
    if (!text) return '';

    let normalized = text;
    normalized = normalized.replace(/\bnew line\b/gi, '\n');
    normalized = normalized.replace(/\b(bullet|dash)\b/gi, '\n- ');

    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return '';

    const blocks = [];
    let listItems = [];

    const flushList = () => {
        if (listItems.length) {
            const itemsHtml = listItems.map(item => `<li>${escapeHtml(item)}</li>`).join('');
            blocks.push(`<ul>${itemsHtml}</ul>`);
            listItems = [];
        }
    };

    lines.forEach(line => {
        if (line.startsWith('- ')) {
            listItems.push(line.slice(2));
        } else {
            flushList();
            blocks.push(`<p>${escapeHtml(line)}</p>`);
        }
    });

    flushList();
    return blocks.join('');
}

function updateDescriptionPreview() {
    const transcription = document.getElementById('transcription');
    const preview = document.getElementById('descriptionPreview');
    if (!transcription || !preview) return;
    const html = convertDictationToHtml(transcription.value.trim());
    preview.innerHTML = html || '<span style="color: #999;">Preview will appear here.</span>';
}

function extractTitleFromText(text) {
    const match = text.match(/(?:assignment\s+(?:called|named|titled)|an\s+assignment\s+called|an\s+assignment\s+named|title)\s+([^\.\n]+)/i);
    if (!match || !match[1]) return '';

    let title = match[1].trim();
    title = title.replace(/\b(due|points?|period|by|at|on|worth|time|make\s+it|should\s+be|and)\b.*$/i, '').trim();
    title = title.replace(/\s{2,}/g, ' ').trim();
    return title;
}

function applyInferenceFromText(text) {
    if (!text) return;

    const lower = text.toLowerCase();

    // Points inference
    const pointsMatch = lower.match(/(\d{1,3})\s+points?\b/);
    if (pointsMatch) {
        const pointsInput = document.getElementById('points');
        if (pointsInput && !pointsInput.value) {
            pointsInput.value = pointsMatch[1];
        }
    }

    // Title inference
    const titleInput = document.getElementById('title');
    if (titleInput) {
        const titleMatch = extractTitleFromText(text);
        const currentTitle = titleInput.value || '';
        const isDefaultTitle = currentTitle.toLowerCase().startsWith('homework due');
        if (titleMatch && (isDefaultTitle || !currentTitle || autoTitleEnabled)) {
            if (titleMatch.length >= lastAutoTitle.length) {
                titleInput.value = titleMatch;
                lastAutoTitle = titleMatch;
            }
        }
    }
}

function openLastPostedInCanvas() {
    const url = localStorage.getItem('lastPostedUrl');
    if (!url) {
        showMessage('No recent Canvas link available yet.', 'error');
        return;
    }
    window.open(url, '_blank', 'noopener');
}

function setDueDateInput(date) {
    const dueDateInput = document.getElementById('dueDate');
    if (!dueDateInput) return;
    const pad = (n) => String(n).padStart(2, '0');
    const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    dueDateInput.value = value;
}

function nextWeekday(targetDay) {
    const today = new Date();
    const day = today.getDay();
    let diff = (targetDay + 7 - day) % 7;
    if (diff === 0) diff = 7;
    const result = new Date(today);
    result.setDate(today.getDate() + diff);
    return result;
}

function nextSchoolDay(fromDate = new Date()) {
    const result = new Date(fromDate);
    result.setDate(result.getDate() + 1);
    while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
    }
    return result;
}

function parseTimeFromText(text) {
    const withAmPm = text.match(/\b(\d{1,2})(?:[:\.](\d{2})|\s+(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
    const withAt = text.match(/\bat\s+(\d{1,2})(?:[:\.](\d{2})|\s+(\d{2}))?\b/i);

    let match = withAmPm || withAt;
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : (match[3] ? Number(match[3]) : 0);
    const meridiemRaw = withAmPm ? match[4] : null;
    const meridiem = meridiemRaw ? meridiemRaw.toLowerCase().replace('.', '') : null;

    // Avoid misreading "20 points" as time
    if (!withAmPm && /\bpoints?\b/.test(text)) {
        return null;
    }

    if (meridiem) {
        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
    }

    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
}

function inferDueDateFromText(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (!lower.includes('due') && !lower.includes('period') && !lower.includes('by')) {
        const weekdayOnly = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
        if (!weekdayOnly) return null;
    }

    const today = new Date();
    let date = null;

    const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
    };

    if (/due\s+today/.test(lower)) {
        date = new Date(today);
    } else if (/due\s+tomorrow/.test(lower)) {
        date = new Date(today);
        date.setDate(today.getDate() + 1);
    } else if (/due\s+next\s+class/.test(lower)) {
        date = nextSchoolDay(today);
    } else {
        const weekdayMatch = lower.match(/due\s+(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
        if (weekdayMatch) {
            const targetDay = dayMap[weekdayMatch[2]];
            date = nextWeekday(targetDay);
        } else if (lower.includes('period') || lower.includes('by')) {
            const looseWeekday = lower.match(/(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
            if (looseWeekday) {
                const targetDay = dayMap[looseWeekday[2]];
                date = nextWeekday(targetDay);
            }
        } else {
            const weekdayOnly = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
            if (weekdayOnly) {
                const targetDay = dayMap[weekdayOnly[2]];
                date = nextWeekday(targetDay);
            }
        }
    }

    if (!date) {
        const numericMatch = lower.match(/due\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        if (numericMatch) {
            const month = Number(numericMatch[1]) - 1;
            const day = Number(numericMatch[2]);
            const year = numericMatch[3] ? Number(numericMatch[3]) : today.getFullYear();
            const fullYear = year < 100 ? 2000 + year : year;
            date = new Date(fullYear, month, day);
        }
    }

    if (!date) {
        const monthMatch = lower.match(/due\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})/);
        if (monthMatch) {
            const monthNames = [
                'january','february','march','april','may','june','july','august','september','october','november','december'
            ];
            const monthIndex = monthNames.findIndex(m => m.startsWith(monthMatch[1]));
            const day = Number(monthMatch[2]);
            date = new Date(today.getFullYear(), monthIndex, day);
        }
    }

    if (!date) return null;

    const time = parseTimeFromText(lower);
    if (time) {
        date.setHours(time.hours, time.minutes, 0, 0);
    } else {
        date.setHours(8, 0, 0, 0);
    }

    return date;
}

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
    });

    updateInstallButtonLabel();
}

function handleInstallClick() {
    updateInstallButtonLabel();
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(() => {
            deferredInstallPrompt = null;
        });
        return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    if (isIOS) {
        showMessage('Safari (iOS): tap Share → Add to Home Screen.', 'success');
        return;
    }

    if (isSafari) {
        showMessage(isMobile
            ? 'Safari (mobile): tap Share → Add to Home Screen.'
            : 'Safari (desktop): press ⌘D to bookmark, or use Bookmarks → Add Bookmark.', 'success');
        return;
    }

    showMessage('Use your browser’s install or bookmark option to add this app.', 'success');
}

function updateInstallButtonLabel() {
    const button = document.getElementById('installAppBtn');
    if (!button) return;

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isMobile = /iphone|ipad|ipod|android/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS) {
        button.textContent = 'Add to Home Screen';
        return;
    }

    if (isSafari && !isMobile) {
        button.textContent = 'Add Bookmark';
        return;
    }

    button.textContent = isMobile ? 'Add to Home Screen' : 'Add Bookmark';
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeExternalUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol === 'https:') return value;
    } catch (e) {
        // Ignore invalid URLs
    }
    return '';
}

function normalizeCanvasUrl(value) {
    if (!value) return '';
    let url = value.trim();

    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }

    if (url.startsWith('http://')) {
        url = `https://${url.slice('http://'.length)}`;
    }

    return url.replace(/\/+$/, '');
}

async function ensureProxyAuth(accessCode) {
    const token = localStorage.getItem('proxyAuthToken');
    const exp = Number(localStorage.getItem('proxyAuthExp') || 0);
    const now = Math.floor(Date.now() / 1000);

    if (token && exp && exp > now + 60) {
        return token;
    }

    const response = await fetch('/.netlify/functions/proxy-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode })
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Access verification failed');
    }

    const data = await response.json();
    if (data.token && data.expiresAt) {
        localStorage.setItem('proxyAuthToken', data.token);
        localStorage.setItem('proxyAuthExp', String(data.expiresAt));
        return data.token;
    }

    throw new Error('Access verification failed');
}

function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const year = String(tomorrow.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
}

function setDefaultTitle(force = false) {
    const titleField = document.getElementById('title');
    if (titleField && (force || !titleField.value)) {
        titleField.value = `Homework due ${getTomorrowDate()}`;
    }
    autoTitleEnabled = true;
    lastAutoTitle = '';
}

function setDefaultDueDate(force = false) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // 8:00 AM
    
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const hours = String(tomorrow.getHours()).padStart(2, '0');
    const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
    
    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    const dueDateInput = document.getElementById('dueDate');
    if (dueDateInput && (force || !dueDateInput.value)) {
        dueDateInput.value = dateTimeString;
    }
}

// --- Vault Handlers ---

async function unlockVaultHandler() {
    const password = document.getElementById('unlockPass').value;
    const encryptedVault = localStorage.getItem('canvasVault');
    
    if (!encryptedVault) return; // Should not happen in this state
    
    try {
        const vaultObj = JSON.parse(encryptedVault);
        const token = await Vault.decrypt(vaultObj, password);
        
        // Success
        sessionToken = token;
        cacheSessionToken(token);
        document.getElementById('unlockPass').value = '';
        updateVaultUI('unlocked');
        startAutoLockTimer();
        showMessage('Unlocked successfully', 'success');
        fetchAssignmentGroups({ silent: true });
    } catch (e) {
        showMessage('Incorrect password', 'error');
    }
}

function lockVaultHandler() {
    sessionToken = null;
    clearSessionTokenCache();
    if (vaultAutoLockTimer) clearTimeout(vaultAutoLockTimer);
    updateVaultUI('locked');
    showMessage('Locked', 'success');
}

function resetVaultHandler() {
    if (confirm('Are you sure? This will delete your saved Canvas token. You will need to paste it again.')) {
        localStorage.removeItem('canvasVault');
        sessionToken = null;
        clearSessionTokenCache();
        updateVaultUI('setup');
    }
}

function startAutoLockTimer() {
    if (vaultAutoLockTimer) clearTimeout(vaultAutoLockTimer);
    vaultAutoLockTimer = setTimeout(() => {
        lockVaultHandler();
        // If config section is hidden, user understands why it failed later
    }, VAULT_TIMEOUT_MS);
}

async function inlineUnlockHandler() {
    const passInput = document.getElementById('inlineUnlockPass');
    const password = passInput ? passInput.value : '';
    const encryptedVault = localStorage.getItem('canvasVault');

    if (!encryptedVault || !password) {
        showInlineUnlockMessage('Enter your password to unlock.', 'error');
        return;
    }

    try {
        const vaultObj = JSON.parse(encryptedVault);
        const token = await Vault.decrypt(vaultObj, password);
        sessionToken = token;
        cacheSessionToken(token);
        if (passInput) passInput.value = '';
        updateVaultUI('unlocked');
        startAutoLockTimer();
        showInlineUnlockMessage('Unlocked successfully', 'success');
        fetchAssignmentGroups({ silent: true });
    } catch (e) {
        showInlineUnlockMessage('Incorrect password', 'error');
    }
}

function updateVaultUI(state) {
    const setup = document.getElementById('vault-setup');
    const locked = document.getElementById('vault-locked');
    const unlocked = document.getElementById('vault-unlocked');
    
    // Hide all
    setup.style.display = 'none';
    locked.style.display = 'none';
    unlocked.style.display = 'none';
    
    if (state === 'setup') {
        setup.style.display = 'block';
        toggleInlineUnlock(false);
    } else if (state === 'locked') {
        locked.style.display = 'block';
        toggleInlineUnlock(true);
    } else if (state === 'unlocked') {
        unlocked.style.display = 'block';
        toggleInlineUnlock(false);
    }
}

function toggleInlineUnlock(show) {
    const inline = document.getElementById('inlineUnlock');
    if (!inline) return;
    inline.style.display = show ? 'block' : 'none';
}

function cacheSessionToken(token) {
    const payload = {
        token,
        expiresAt: Date.now() + SESSION_CACHE_MS
    };
    sessionStorage.setItem('sessionTokenCache', JSON.stringify(payload));
}

function restoreSessionToken() {
    try {
        const raw = sessionStorage.getItem('sessionTokenCache');
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!payload.token || !payload.expiresAt) return null;
        if (Date.now() > payload.expiresAt) {
            sessionStorage.removeItem('sessionTokenCache');
            return null;
        }
        return payload.token;
    } catch (e) {
        return null;
    }
}

function clearSessionTokenCache() {
    sessionStorage.removeItem('sessionTokenCache');
}

// --- Sync Logic ---

function showSyncLogin() {
    document.getElementById('vault-setup-local').style.display = 'none';
    document.getElementById('vault-setup-sync').style.display = 'block';
}

function hideSyncLogin() {
    document.getElementById('vault-setup-local').style.display = 'block';
    document.getElementById('vault-setup-sync').style.display = 'none';
}

function toggleSyncMenu() {
    const menu = document.getElementById('sync-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    
    // Auto-fill email if saved
    const savedEmail = localStorage.getItem('syncEmail');
    if (savedEmail) document.getElementById('syncEmailInput').value = savedEmail;

    if (menu.style.display === 'block') {
        showSyncMessage('Sync is now in the Setup section below your courses.', 'success');
    }
}

async function pushSyncData() {
    const email = document.getElementById('syncEmailInput').value.trim();
    if (!email) {
        showSyncMessage('Please enter an email to identify your backup', 'error');
        return;
    }
    
    localStorage.setItem('syncEmail', email);
    
    const vaultStr = localStorage.getItem('canvasVault');
    const configStr = localStorage.getItem('canvasConfig');
    
    if (!vaultStr) {
        showSyncMessage('No secure connection to sync!', 'error');
        return;
    }

    // Bundle everything
    const currentVersion = Number(localStorage.getItem('syncVersion') || 0) + 1;
    const syncBundle = {
        vault: vaultStr,
        config: configStr,
        meta: {
            version: currentVersion,
            updatedAt: Date.now(),
            deviceId: navigator.userAgent
        }
    };

    try {
        const response = await fetch('/.netlify/functions/vault-sync', {
            method: 'POST',
            body: JSON.stringify({
                action: 'push',
                userId: email,
                vaultBlob: JSON.stringify(syncBundle),
                deviceId: navigator.userAgent
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('syncVersion', String(currentVersion));
            document.getElementById('syncStatus').textContent = 'Last synced: Just now';
            showSyncMessage('Secure backup successful (Settings included)!', 'success');

            const optIn = document.getElementById('newsletterOptIn');
            if (optIn && optIn.checked) {
                await signupNewsletter(email);
            }
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        const friendly = e.message && e.message.includes('Cloud storage not configured')
            ? 'Cloud Sync is not available in local testing. It will work after deployment.'
            : 'Sync failed: ' + e.message;
        showSyncMessage(friendly, 'error');
    }
}

async function pullSyncData() {
    const email = document.getElementById('syncUserId').value.trim();
    if (!email) {
        showMessage('Please enter your email', 'error');
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/vault-sync', {
            method: 'POST',
            body: JSON.stringify({
                action: 'pull',
                userId: email
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to download');
        
        // Handle Sync Bundle
        let isFullRestore = false;
        try {
            const bundle = JSON.parse(data.vaultBlob);
            if (bundle && bundle.vault && bundle.config) {
                const incomingVersion = Number(bundle.meta?.version || 0);
                const localVersion = Number(localStorage.getItem('syncVersion') || 0);
                if (incomingVersion && localVersion && incomingVersion < localVersion) {
                    showMessage('Downloaded backup is older than this device. Sync canceled to prevent rollback.', 'error');
                    return;
                }

                // New Format: Bundle
                localStorage.setItem('canvasVault', bundle.vault);
                localStorage.setItem('canvasConfig', bundle.config);
                if (incomingVersion) {
                    localStorage.setItem('syncVersion', String(incomingVersion));
                }
                isFullRestore = true;
            } else {
                // Old Format: Just Vault
                localStorage.setItem('canvasVault', data.vaultBlob);
            }
        } catch (e) {
             // Fallback
             localStorage.setItem('canvasVault', data.vaultBlob);
        }
        
        // Refresh UI with new config (Courses, URL)
        loadConfig();
        
        // Switch to Locked state (so user can enter password to decrypt)
        updateVaultUI('locked');
        
        const successMsg = isFullRestore 
            ? 'Settings & Secure Connection restored! Enter password to unlock.' 
            : 'Secure Connection downloaded! Enter your password to unlock.';
            
        showMessage(successMsg, 'success');
        
        // Clean up UI
        hideSyncLogin();
    } catch (e) {
        showMessage('Download failed: ' + e.message, 'error');
    }
}

// ----------------------

async function saveConfig() {
    console.log('saveConfig called');
    const accessCode = document.getElementById('accessCode') ? document.getElementById('accessCode').value.trim() : '';
    const canvasUrlInput = document.getElementById('canvasUrl');
    const canvasUrl = normalizeCanvasUrl(canvasUrlInput ? canvasUrlInput.value.trim() : '');
    
    // Check Vault State
    const hasVault = localStorage.getItem('canvasVault');
    
    if (!hasVault) {
        // Must create vault
        const token = document.getElementById('newCanvasToken').value.trim();
        const pass = document.getElementById('newVaultPass').value.trim();
        
        if (!token || !pass) {
            showMessage('Please enter Canvas Token and create a Password', 'error');
            return;
        }
        
        try {
            const vaultObj = await Vault.encrypt(token, pass);
            localStorage.setItem('canvasVault', JSON.stringify(vaultObj));
            sessionToken = token; // Auto-unlock
            updateVaultUI('unlocked');
            startAutoLockTimer();
        } catch (e) {
            console.error(e);
            showMessage('Error creating vault: ' + e.message, 'error');
            return;
        }
    }

    if (!canvasUrl) {
        showMessage('Please fill in Canvas URL', 'error');
        return;
    }

    if (canvasUrlInput) canvasUrlInput.value = canvasUrl;
    
    if (!accessCode) {
        showMessage('Please enter Access Code', 'error');
        return;
    }
    
    if (courses.length === 0) {
        showMessage('Please add at least one course', 'error');
        return;
    }

    const configToSave = {
        accessCode,
        canvasUrl,
        courses
    };

    // Save to localStorage (WITHOUT TOKEN)
    localStorage.setItem('canvasConfig', JSON.stringify(configToSave));
    
    // Show dictation section and render course checkboxes
    document.getElementById('configSection').style.display = 'none';
    document.getElementById('dictationSection').style.display = 'block';
    renderCourseCheckboxes();
    
    showMessage('Configuration saved successfully!', 'success');
}

function addCourse() {
    console.log('addCourse called');
    const nickname = document.getElementById('newCourseNickname').value.trim();
    const courseId = document.getElementById('newCourseId').value.trim();
    
    console.log('Nickname:', nickname, 'CourseId:', courseId);
    
    if (!nickname || !courseId) {
        showMessage('Please enter both course nickname and ID', 'error');
        return;
    }
    
    courses.push({ nickname, courseId });
    console.log('Courses array:', courses);
    renderCoursesList();
    
    // Clear inputs
    document.getElementById('newCourseNickname').value = '';
    document.getElementById('newCourseId').value = '';
}

function removeCourse(index) {
    courses.splice(index, 1);
    renderCoursesList();
}

function renderCoursesList() {
    const coursesList = document.getElementById('coursesList');
    
    if (courses.length === 0) {
        coursesList.innerHTML = '<p style="color: #999; font-style: italic; padding: 10px;">No courses added yet. Add your first course below.</p>';
        return;
    }
    
    coursesList.innerHTML = courses.map((course, index) => {
        const safeNickname = escapeHtml(course.nickname);
        const safeCourseId = escapeHtml(course.courseId);
        return `
        <div class="course-item">
            <div class="course-item-info">
                <div class="course-item-nickname">${safeNickname}</div>
                <div class="course-item-id">ID: ${safeCourseId}</div>
            </div>
            <button class="course-item-remove" data-index="${index}">Remove</button>
        </div>
    `;
    }).join('');

    coursesList.querySelectorAll('.course-item-remove').forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.index);
            if (!Number.isNaN(index)) removeCourse(index);
        });
    });
}

function renderCourseCheckboxes() {
    const checkboxesContainer = document.getElementById('courseCheckboxes');
    const savedSelections = JSON.parse(localStorage.getItem('selectedCourses') || '[]');
    
    // If no saved selections, select only the first course
    const defaultSelections = savedSelections.length > 0 ? savedSelections : [courses[0]?.courseId];
    
    checkboxesContainer.innerHTML = courses.map((course, index) => {
        const safeNickname = escapeHtml(course.nickname);
        const safeCourseId = escapeHtml(course.courseId);
        const isChecked = defaultSelections.includes(course.courseId);
        return `
            <div class="course-checkbox-item">
                <input type="checkbox" 
                       id="course_${index}" 
                       value="${safeCourseId}" 
                       ${isChecked ? 'checked' : ''}>
                <label for="course_${index}">${safeNickname}</label>
            </div>
        `;
    }).join('');

    checkboxesContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', saveCourseSelections);
    });
    
    updateToggleButton();
}

function toggleAllCourses() {
    const checkboxes = document.querySelectorAll('#courseCheckboxes input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => cb.checked = !allChecked);
    saveCourseSelections();
    updateToggleButton();
}

function updateToggleButton() {
    const checkboxes = document.querySelectorAll('#courseCheckboxes input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const toggleBtn = document.getElementById('toggleAllBtn');
    
    if (toggleBtn) {
        toggleBtn.textContent = allChecked ? 'Clear' : 'All';
    }
}

function saveCourseSelections() {
    const checkboxes = document.querySelectorAll('#courseCheckboxes input[type="checkbox"]:checked');
    const selectedCourses = Array.from(checkboxes).map(cb => cb.value);
    localStorage.setItem('selectedCourses', JSON.stringify(selectedCourses));
    updateToggleButton();
}

function getSelectedCourses() {
    const checkboxes = document.querySelectorAll('#courseCheckboxes input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => {
        const courseId = cb.value;
        return courses.find(c => c.courseId === courseId);
    });
}

function loadConfig() {
    // Check Vault State
    const vault = localStorage.getItem('canvasVault');
    if (vault) {
        const cached = restoreSessionToken();
        if (cached) {
            sessionToken = cached;
            updateVaultUI('unlocked');
            startAutoLockTimer();
        } else {
            updateVaultUI('locked');
        }
    } else {
        updateVaultUI('setup');
    }

    const savedConfig = localStorage.getItem('canvasConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        
        if (config.accessCode && document.getElementById('accessCode')) {
            document.getElementById('accessCode').value = config.accessCode;
        }

        const normalizedUrl = normalizeCanvasUrl(config.canvasUrl || '');
        document.getElementById('canvasUrl').value = normalizedUrl;
        if (normalizedUrl && normalizedUrl !== config.canvasUrl) {
            config.canvasUrl = normalizedUrl;
            localStorage.setItem('canvasConfig', JSON.stringify(config));
        }
        // Token is handled by vault
        
        // Load courses
        if (config.courses) {
            courses = config.courses;
        } else if (config.courseId) {
            courses = [{ nickname: 'My Course', courseId: config.courseId }];
        }
        
        renderCoursesList();
        
        // Show dictation section if config exists
        if (config.canvasUrl && courses.length > 0) {
            document.getElementById('configSection').style.display = 'none';
            document.getElementById('dictationSection').style.display = 'block';
            renderCourseCheckboxes();
            toggleInlineUnlock(!sessionToken);
            if (sessionToken) {
                fetchAssignmentGroups({ silent: true });
            }
        }
    } else {
        renderCoursesList();
    }
}

function showConfig() {
    document.getElementById('configSection').style.display = 'block';
    document.getElementById('dictationSection').style.display = 'none';
}

async function fetchCanvasCourses() {
    const canvasUrlInput = document.getElementById('canvasUrl');
    const canvasUrl = normalizeCanvasUrl(canvasUrlInput ? canvasUrlInput.value.trim() : '');
    const accessCode = document.getElementById('accessCode') ? document.getElementById('accessCode').value.trim() : '';

    if (!canvasUrl) {
        showMessage('Please enter your Canvas URL first', 'error');
        return;
    }

    if (canvasUrlInput) canvasUrlInput.value = canvasUrl;

    if (!sessionToken) {
        const tokenInput = document.getElementById('newCanvasToken') ? document.getElementById('newCanvasToken').value.trim() : '';
        const passInput = document.getElementById('newVaultPass') ? document.getElementById('newVaultPass').value.trim() : '';

        if (tokenInput && passInput) {
            try {
                const vaultObj = await Vault.encrypt(tokenInput, passInput);
                localStorage.setItem('canvasVault', JSON.stringify(vaultObj));
                sessionToken = tokenInput;
                updateVaultUI('unlocked');
                startAutoLockTimer();
                document.getElementById('newCanvasToken').value = '';
                document.getElementById('newVaultPass').value = '';
            } catch (e) {
                showMessage('Error creating Secure Connection: ' + e.message, 'error');
                return;
            }
        } else {
            showMessage('Please unlock your Secure Connection (or create it) to fetch courses', 'error');
            return;
        }
    }

    let proxyToken = null;
    try {
        proxyToken = await ensureProxyAuth(accessCode);
    } catch (e) {
        showMessage(e.message, 'error');
        return;
    }

    const fetchBtn = document.getElementById('fetchCoursesBtn');
    if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Fetching...';
    }

    try {
        const response = await fetch('/.netlify/functions/canvas-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${proxyToken}`
            },
            body: JSON.stringify({
                action: 'listCourses',
                canvasUrl,
                canvasToken: sessionToken
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch courses');
        }

        fetchedCourses = Array.isArray(data.courses) ? data.courses : [];
        renderFetchedCourses();

        if (fetchedCourses.length === 0) {
            showMessage('No active courses found', 'error');
        } else {
            showMessage('Select courses to add below', 'success');
        }
    } catch (e) {
        showMessage(`Failed to fetch courses: ${e.message}`, 'error');
    } finally {
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch Active Courses';
        }
    }
}

async function fetchAssignmentGroups(options = {}) {
    const canvasUrl = normalizeCanvasUrl(document.getElementById('canvasUrl')?.value.trim() || '');
    const accessCode = document.getElementById('accessCode') ? document.getElementById('accessCode').value.trim() : '';

    if (!canvasUrl) {
        if (!options.silent) showMessage('Please enter your Canvas URL first', 'error');
        return;
    }

    if (!courses.length) {
        if (!options.silent) showMessage('Please add/select a course first', 'error');
        return;
    }

    if (!sessionToken) {
        if (!options.silent) showMessage('Please unlock your Secure Connection to fetch groups', 'error');
        return;
    }

    let proxyToken = null;
    try {
        proxyToken = await ensureProxyAuth(accessCode);
    } catch (e) {
        if (!options.silent) showMessage(e.message, 'error');
        return;
    }

    try {
        assignmentGroupsByCourse = {};
        assignmentGroups = [];

        for (const course of courses) {
            const response = await fetch('/.netlify/functions/canvas-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${proxyToken}`
                },
                body: JSON.stringify({
                    action: 'listGroups',
                    canvasUrl,
                    canvasToken: sessionToken,
                    courseId: course.courseId
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch groups');

            const groups = Array.isArray(data.groups) ? data.groups : [];
            assignmentGroupsByCourse[course.courseId] = groups;
            assignmentGroups = assignmentGroups.concat(groups.map(group => ({
                ...group,
                _courseId: course.courseId,
                _courseName: course.nickname
            })));
        }

        renderAssignmentGroups();
        if (!options.silent) showMessage('Assignment groups loaded for all courses', 'success');
    } catch (e) {
        if (!options.silent) showMessage(`Failed to fetch groups: ${e.message}`, 'error');
    }
}

function renderAssignmentGroups() {
    const select = document.getElementById('assignmentGroupSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select a group</option>';
    const seen = new Set();
    assignmentGroups.forEach(group => {
        const name = String(group.name || '').trim();
        if (!name || seen.has(name)) return;
        seen.add(name);
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    setDefaultAssignmentGroup();
}

function setDefaultAssignmentGroup() {
    const select = document.getElementById('assignmentGroupSelect');
    if (!select) return;

    const homeworkOption = Array.from(select.options).find(opt => /homework/i.test(opt.value));
    if (homeworkOption) {
        select.value = homeworkOption.value;
    } else if (select.options.length > 1) {
        select.selectedIndex = 1;
    } else {
        select.selectedIndex = 0;
    }
}

function getAssignmentGroupIdForCourse(courseId, groupName) {
    if (!groupName) return null;
    const groups = assignmentGroupsByCourse[courseId] || [];
    const match = groups.find(group => group.name === groupName);
    return match ? match.id : null;
}

function renderFetchedCourses() {
    const container = document.getElementById('fetchedCourses');
    const addBtn = document.getElementById('addFetchedCoursesBtn');

    if (!container) return;

    if (!fetchedCourses.length) {
        container.style.display = 'none';
        if (addBtn) addBtn.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    if (addBtn) addBtn.style.display = 'block';

    container.innerHTML = fetchedCourses.map((course, index) => {
        const safeName = escapeHtml(course.name || 'Untitled Course');
        const safeId = escapeHtml(String(course.id || ''));
        const safeCode = escapeHtml(course.course_code || '');
        return `
            <div style="display:flex; align-items:center; gap:8px; padding:6px 4px; border-bottom: 1px solid #f1f5f9;">
                <input type="checkbox" id="fetch_course_${index}" value="${safeId}">
                <label for="fetch_course_${index}" style="display:flex; flex-direction:column;">
                    <span style="font-weight:600;">${safeName}</span>
                    <span style="font-size:0.85em; color: var(--text-light);">${safeCode} • ID ${safeId}</span>
                </label>
            </div>
        `;
    }).join('');
}

function addSelectedFetchedCourses() {
    const container = document.getElementById('fetchedCourses');
    if (!container) return;

    const selections = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    if (selections.length === 0) {
        showMessage('Please select at least one course to add', 'error');
        return;
    }

    const existingIds = new Set(courses.map(c => String(c.courseId)));

    selections.forEach(selectedId => {
        const match = fetchedCourses.find(c => String(c.id) === String(selectedId));
        if (!match) return;

        const courseId = String(match.id);
        if (existingIds.has(courseId)) return;

        const nickname = match.name || match.course_code || `Course ${courseId}`;
        courses.push({ nickname, courseId });
        existingIds.add(courseId);
    });

    renderCoursesList();
    showMessage('Courses added to your list', 'success');
}

async function signupNewsletter(email) {
    try {
        const response = await fetch('/.netlify/functions/newsletter-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            return;
        }
    } catch (e) {
        // Silent failure to avoid blocking sync
        console.warn('Newsletter signup failed');
    }
}

async function deleteCloudBackup() {
    const email = document.getElementById('syncEmailInput').value.trim();
    if (!email) {
        showSyncMessage('Enter the email used for sync to delete the cloud backup', 'error');
        return;
    }

    if (!confirm('This will permanently delete your cloud backup. Continue?')) {
        return;
    }

    try {
        const response = await fetch('/.netlify/functions/vault-sync', {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete',
                userId: email
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Delete failed');

        showSyncMessage('Cloud backup deleted', 'success');
    } catch (e) {
        const friendly = e.message && e.message.includes('Cloud storage not configured')
            ? 'Cloud Sync is not available in local testing. It will work after deployment.'
            : 'Delete failed: ' + e.message;
        showSyncMessage(friendly, 'error');
    }
}

function eraseLocalData() {
    if (!confirm('This will erase all locally saved settings and your encrypted token on this device. Continue?')) {
        return;
    }

    const confirmText = prompt('Type ERASE to permanently remove local data.');
    if (confirmText !== 'ERASE') {
        showMessage('Erase canceled. Type ERASE to confirm.', 'error');
        return;
    }

    localStorage.removeItem('canvasConfig');
    localStorage.removeItem('canvasVault');
    localStorage.removeItem('selectedCourses');
    localStorage.removeItem('lastAssignmentGroup');
    localStorage.removeItem('syncEmail');
    localStorage.removeItem('syncVersion');
    localStorage.removeItem('proxyAuthToken');
    localStorage.removeItem('proxyAuthExp');

    sessionToken = null;
    courses = [];
    fetchedCourses = [];

    renderCoursesList();
    updateVaultUI('setup');
    showConfig();
    showMessage('Local data erased on this device.', 'success');
}

function toggleRecording() {
    if (!recognition) {
        alert('Speech recognition is not available');
        return;
    }

    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    isRecording = true;
    const transcription = document.getElementById('transcription');
    finalTranscript = transcription ? transcription.value.trim() : '';
    recognition.start();
    
    const recordBtn = document.getElementById('recordBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    
    recordBtn.classList.add('recording');
    statusIndicator.classList.add('recording');
    document.getElementById('recordText').textContent = 'Recording... (Click to Stop)';
    document.getElementById('statusText').textContent = 'Listening...';
}

function stopRecording() {
    isRecording = false;
    recognition.stop();
    
    const recordBtn = document.getElementById('recordBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    
    recordBtn.classList.remove('recording');
    statusIndicator.classList.remove('recording');
    document.getElementById('recordText').textContent = 'Press to Dictate';
    document.getElementById('statusText').textContent = 'Ready to dictate';

    updateDescriptionPreview();
    const transcription = document.getElementById('transcription');
    if (transcription && dueDateAutoEnabled) {
        const inferred = inferDueDateFromText(transcription.value);
        if (inferred) setDueDateInput(inferred);
    }
    if (transcription) {
        applyInferenceFromText(transcription.value);
    }
}

function clearText() {
    setDefaultTitle(true);
    document.getElementById('transcription').value = '';
    document.getElementById('resultMessage').style.display = 'none';
    finalTranscript = '';
    updateDescriptionPreview();
    setDefaultDueDate(true);
    const pointsInput = document.getElementById('points');
    if (pointsInput) pointsInput.value = '';
    setDefaultAssignmentGroup();
    dueDateAutoEnabled = true;
    autoTitleEnabled = true;
    lastAutoTitle = '';
}

async function postToCanvas() {
    const config = JSON.parse(localStorage.getItem('canvasConfig'));
    
    // Safety check for Vault
    if (!sessionToken) {
        showMessage('Connection is locked. Use the unlock box above to continue.', 'error');
        toggleInlineUnlock(true);
        const inlinePass = document.getElementById('inlineUnlockPass');
        if (inlinePass) inlinePass.focus();
        return;
    }
    
    // Enhance config with sessionToken locally for this call
    config.canvasToken = sessionToken;

    const title = document.getElementById('title').value.trim();
    const rawDescription = document.getElementById('transcription').value.trim();
    const postType = document.querySelector('input[name="postType"]:checked').value;
    const selectedCourses = getSelectedCourses();
    const isDraft = document.getElementById('postAsDraft')?.checked || false;
    
    if (!title || !rawDescription) {
        showMessage('Please provide both a title and description', 'error');
        return;
    }
    
    if (selectedCourses.length === 0) {
        showMessage('Please select at least one course', 'error');
        return;
    }

    let proxyToken = null;
    try {
        proxyToken = await ensureProxyAuth(config.accessCode);
    } catch (e) {
        showMessage(e.message, 'error');
        return;
    }

    const postBtn = document.getElementById('postBtn');
    postBtn.disabled = true;
    postBtn.textContent = 'Posting...';

    // Save assignment group preference
    const groupName = document.getElementById('assignmentGroup').value;
    if (groupName) {
        localStorage.setItem('lastAssignmentGroup', groupName);
    }

    try {
        let successCount = 0;
        let failedCourses = [];
        let lastPostedUrl = '';
        const descriptionHtml = convertDictationToHtml(rawDescription);
        
        for (const course of selectedCourses) {
            try {
                if (postType === 'assignment') {
                    const data = await createAssignment(config, course, title, descriptionHtml, proxyToken, isDraft);
                    if (!lastPostedUrl && data && data.html_url) lastPostedUrl = data.html_url;
                } else {
                    const data = await createAnnouncement(config, course, title, descriptionHtml, proxyToken, isDraft);
                    if (!lastPostedUrl && data && data.html_url) lastPostedUrl = data.html_url;
                }
                successCount++;
            } catch (error) {
                failedCourses.push(course.nickname);
            }
        }
        
        if (successCount === selectedCourses.length) {
            showMessage(`Successfully posted ${postType} to ${successCount} course${successCount > 1 ? 's' : ''}!`, 'success');
            clearText();
        } else if (successCount > 0) {
            showMessage(`Posted to ${successCount} course(s), but failed for: ${failedCourses.join(', ')}`, 'error');
        } else {
            showMessage(`Failed to post to all courses`, 'error');
        }

        if (lastPostedUrl) {
            localStorage.setItem('lastPostedUrl', lastPostedUrl);
            const openBtn = document.getElementById('openInCanvasBtn');
            if (openBtn) openBtn.style.display = 'block';
        }
    } catch (error) {
        showMessage(`Failed to post: ${error.message}`, 'error');
    } finally {
        postBtn.disabled = false;
        postBtn.textContent = 'Post to Canvas';
    }
}

async function createAssignment(config, course, title, description, proxyToken, isDraft = false) {
    const dueDateInput = document.getElementById('dueDate').value;
    const pointsInput = document.getElementById('points').value;
    const groupSelect = document.getElementById('assignmentGroupSelect');
    const assignmentGroupName = groupSelect ? groupSelect.value : '';
    const assignmentGroupId = getAssignmentGroupIdForCourse(course.courseId, assignmentGroupName);
    
    let formattedDate = null;
    if (dueDateInput) {
        formattedDate = new Date(dueDateInput).toISOString();
    }
    
    const assignmentData = {
        assignment: {
            name: title,
            description: description,
            points_possible: pointsInput ? parseFloat(pointsInput) : null,
            due_at: formattedDate,
            published: !isDraft
        }
    };

    // Use the Netlify Function proxy
    const response = await fetch('/.netlify/functions/canvas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proxyToken}`
        },
        body: JSON.stringify({
            canvasUrl: config.canvasUrl,
            canvasToken: config.canvasToken,
            courseId: course.courseId,
            assignmentData: assignmentData,
            assignmentGroupId: assignmentGroupId || null
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create assignment');
    }

    return await response.json();
}

async function createAnnouncement(config, course, title, message, proxyToken, isDraft = false) {
    const announcementData = {
        title: title,
        message: message,
        is_announcement: true,
        published: !isDraft
    };

    // Use the Netlify Function proxy
    const response = await fetch('/.netlify/functions/canvas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proxyToken}`
        },
        body: JSON.stringify({
            canvasUrl: config.canvasUrl,
            canvasToken: config.canvasToken,
            courseId: course.courseId,
            announcementData: announcementData
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create announcement');
    }

    return await response.json();
}

function showMessage(message, type) {
    // Show in Dictation Section (if visible)
    if (document.getElementById('dictationSection').style.display !== 'none') {
        const resultMessage = document.getElementById('resultMessage');
        resultMessage.textContent = message;
        resultMessage.className = `result-message ${type}`;
        resultMessage.style.display = 'block';
    }
    
    // Always update Config Section (so setup errors are visible)
    const configMessage = document.getElementById('configMessage');
    if (configMessage) {
        configMessage.textContent = message;
        configMessage.className = `result-message ${type}`;
        configMessage.style.display = 'block';
    }
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (document.getElementById('resultMessage')) document.getElementById('resultMessage').style.display = 'none';
            if (configMessage) configMessage.style.display = 'none';
        }, 5000);
    }
}

function showSyncMessage(message, type) {
    const syncMessage = document.getElementById('syncMessage');
    if (!syncMessage) return;
    syncMessage.textContent = message;
    syncMessage.className = `result-message ${type}`;
    syncMessage.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            syncMessage.style.display = 'none';
        }, 5000);
    }
}

function showInlineUnlockMessage(message, type) {
    const inlineMessage = document.getElementById('inlineUnlockMessage');
    if (!inlineMessage) return;
    inlineMessage.textContent = message;
    inlineMessage.className = `result-message ${type}`;
    inlineMessage.style.display = 'block';
}

// Update checking
async function checkForUpdates() {
    try {
        const response = await fetch(UPDATE_CHECK_URL);
        if (!response.ok) return; // Silently fail if can't check
        
        const data = await response.json();
        const latestVersion = data.version;
        const downloadUrl = data.downloadUrl;
        const releaseNotes = data.releaseNotes || '';
        
        if (compareVersions(latestVersion, APP_VERSION) > 0) {
            showUpdateNotification(latestVersion, downloadUrl, releaseNotes);
        }
    } catch (error) {
        // Silently fail - don't bother users if update check fails
        console.log('Update check failed:', error);
    }
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }
    return 0;
}

function showUpdateNotification(version, downloadUrl, releaseNotes) {
    // Create update banner
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const message = releaseNotes 
        ? `🎉 Version ${version} is available! ${releaseNotes}` 
        : `🎉 Version ${version} is available!`;
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width: 800px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap;';
    
    const messageSpan = document.createElement('span');
    messageSpan.style.fontWeight = '600';
    messageSpan.textContent = message;
    
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 10px;';
    
    const downloadLink = document.createElement('a');
    const safeUrl = safeExternalUrl(downloadUrl);
    downloadLink.href = safeUrl || '#';
    downloadLink.target = '_blank';
    downloadLink.rel = 'noopener noreferrer';
    downloadLink.textContent = 'Download Update';
    downloadLink.style.cssText = `
        background: white;
        color: #667eea;
        padding: 8px 20px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        transition: transform 0.2s;
    `;
    if (!safeUrl) {
        downloadLink.style.opacity = '0.6';
        downloadLink.style.pointerEvents = 'none';
        downloadLink.setAttribute('aria-disabled', 'true');
    }
    downloadLink.addEventListener('mouseenter', () => { downloadLink.style.transform = 'scale(1.05)'; });
    downloadLink.addEventListener('mouseleave', () => { downloadLink.style.transform = 'scale(1)'; });
    
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.style.cssText = `
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid white;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
    `;
    dismissBtn.addEventListener('click', dismissUpdateBanner);
    
    actions.appendChild(downloadLink);
    actions.appendChild(dismissBtn);
    wrapper.appendChild(messageSpan);
    wrapper.appendChild(actions);
    banner.appendChild(wrapper);
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Adjust main container to account for banner
    document.body.style.paddingTop = '70px';
}

function dismissUpdateBanner() {
    const banner = document.getElementById('updateBanner');
    if (banner) {
        banner.remove();
        document.body.style.paddingTop = '0';
    }
}
