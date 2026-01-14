// App Version
const APP_VERSION = '1.0.0';
const UPDATE_CHECK_URL = 'https://foiledbymath.com/apps/homework-dictation/version.json';

// Speech Recognition Setup
let recognition;
let isRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

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
        
        document.getElementById('transcription').value = finalTranscript + interimTranscript;
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

console.log('App.js loaded successfully');

// Load configuration on startup
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
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
});

function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const year = String(tomorrow.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
}

function setDefaultTitle() {
    const titleField = document.getElementById('title');
    if (!titleField.value) {
        titleField.value = `Homework due ${getTomorrowDate()}`;
    }
}

function setDefaultDueDate() {
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
    if (dueDateInput && !dueDateInput.value) {
        dueDateInput.value = dateTimeString;
    }
}

function saveConfig() {
    console.log('saveConfig called');
    const canvasUrl = document.getElementById('canvasUrl').value.trim();
    const canvasToken = document.getElementById('canvasToken').value.trim();

    console.log('Canvas URL:', canvasUrl);
    console.log('Courses:', courses);

    if (!canvasUrl || !canvasToken) {
        showMessage('Please fill in Canvas URL and API Token', 'error');
        return;
    }
    
    if (courses.length === 0) {
        showMessage('Please add at least one course', 'error');
        return;
    }

    const config = {
        canvasUrl,
        canvasToken,
        courses
    };

    // Save to localStorage
    localStorage.setItem('canvasConfig', JSON.stringify(config));
    
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
    
    coursesList.innerHTML = courses.map((course, index) => `
        <div class="course-item">
            <div class="course-item-info">
                <div class="course-item-nickname">${course.nickname}</div>
                <div class="course-item-id">ID: ${course.courseId}</div>
            </div>
            <button class="course-item-remove" onclick="removeCourse(${index})">Remove</button>
        </div>
    `).join('');
}

function renderCourseCheckboxes() {
    const checkboxesContainer = document.getElementById('courseCheckboxes');
    const savedSelections = JSON.parse(localStorage.getItem('selectedCourses') || '[]');
    
    // If no saved selections, select only the first course
    const defaultSelections = savedSelections.length > 0 ? savedSelections : [courses[0]?.courseId];
    
    checkboxesContainer.innerHTML = courses.map((course, index) => {
        const isChecked = defaultSelections.includes(course.courseId);
        return `
            <div class="course-checkbox-item">
                <input type="checkbox" 
                       id="course_${index}" 
                       value="${course.courseId}" 
                       ${isChecked ? 'checked' : ''}
                       onchange="saveCourseSelections()">
                <label for="course_${index}">${course.nickname}</label>
            </div>
        `;
    }).join('');
    
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
    const savedConfig = localStorage.getItem('canvasConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        document.getElementById('canvasUrl').value = config.canvasUrl;
        document.getElementById('canvasToken').value = config.canvasToken;
        
        // Load courses
        if (config.courses) {
            courses = config.courses;
        } else if (config.courseId) {
            // Migrate old single-course config
            courses = [{ nickname: 'My Course', courseId: config.courseId }];
        }
        
        renderCoursesList();
        
        // Show dictation section if config exists
        document.getElementById('configSection').style.display = 'none';
        document.getElementById('dictationSection').style.display = 'block';
        renderCourseCheckboxes();
    } else {
        renderCoursesList();
    }
}

function showConfig() {
    document.getElementById('configSection').style.display = 'block';
    document.getElementById('dictationSection').style.display = 'none';
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
}

function clearText() {
    setDefaultTitle();
    document.getElementById('transcription').value = '';
    document.getElementById('resultMessage').style.display = 'none';
}

async function postToCanvas() {
    const config = JSON.parse(localStorage.getItem('canvasConfig'));
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('transcription').value.trim();
    const postType = document.querySelector('input[name="postType"]:checked').value;
    const selectedCourses = getSelectedCourses();
    
    if (!title || !description) {
        showMessage('Please provide both a title and description', 'error');
        return;
    }
    
    if (selectedCourses.length === 0) {
        showMessage('Please select at least one course', 'error');
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
        
        for (const course of selectedCourses) {
            try {
                if (postType === 'assignment') {
                    await createAssignment(config, course, title, description);
                } else {
                    await createAnnouncement(config, course, title, description);
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
    } catch (error) {
        showMessage(`Failed to post: ${error.message}`, 'error');
    } finally {
        postBtn.disabled = false;
        postBtn.textContent = 'Post to Canvas';
    }
}

async function createAssignment(config, course, title, description) {
    const dueDateInput = document.getElementById('dueDate').value;
    const pointsInput = document.getElementById('points').value;
    const groupNameInput = document.getElementById('assignmentGroup') ? document.getElementById('assignmentGroup').value : null;
    
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
            published: true
        }
    };

    // Use the Netlify Function proxy
    const response = await fetch('/.netlify/functions/canvas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            canvasUrl: config.canvasUrl,
            canvasToken: config.canvasToken,
            courseId: course.courseId,
            assignmentData: assignmentData,
            assignmentGroupName: groupNameInput
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create assignment');
    }

    return await response.json();
}

async function createAnnouncement(config, course, title, message) {
    const announcementData = {
        title: title,
        message: message,
        is_announcement: true,
        published: true
    };

    // Use the Netlify Function proxy
    const response = await fetch('/.netlify/functions/canvas-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
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
    const resultMessage = document.getElementById('resultMessage');
    resultMessage.textContent = message;
    resultMessage.className = `result-message ${type}`;
    resultMessage.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            resultMessage.style.display = 'none';
        }, 5000);
    }
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
    
    banner.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap;">
            <span style="font-weight: 600;">${message}</span>
            <div style="display: flex; gap: 10px;">
                <a href="${downloadUrl}" target="_blank" style="
                    background: white;
                    color: #667eea;
                    padding: 8px 20px;
                    border-radius: 6px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Download Update</a>
                <button onclick="dismissUpdateBanner()" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                ">Dismiss</button>
            </div>
        </div>
    `;
    
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
