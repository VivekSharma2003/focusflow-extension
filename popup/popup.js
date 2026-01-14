document.addEventListener('DOMContentLoaded', init);

// DOM Elements
let focusToggle, timerSection, timerValue, pauseBtn, resetBtn;
let statusIndicator, statusText, settingsLink;

// State
let currentTab = null;
let timerUpdateInterval = null;

/**
 * Initialize popup
 */
async function init() {
    // Get DOM elements
    focusToggle = document.getElementById('focusToggle');
    timerSection = document.getElementById('timerSection');
    timerValue = document.getElementById('timerValue');
    pauseBtn = document.getElementById('pauseBtn');
    resetBtn = document.getElementById('resetBtn');
    statusIndicator = document.querySelector('.status-indicator');
    statusText = document.getElementById('statusText');
    settingsLink = document.getElementById('settingsLink');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Load current state
    await loadState();

    // Setup event listeners
    setupEventListeners();

    // Start timer updates
    startTimerUpdates();
}

/**
 * Load current state from content script
 */
async function loadState() {
    try {
        const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getState' });
        updateUI(response);
    } catch (error) {
        // Content script not loaded
        console.log('Content script not available');
        updateUI({ enabled: false, elapsedTime: 0 });
    }
}

/**
 * Update UI based on state
 */
function updateUI(state) {
    const { enabled, elapsedTime, isPaused } = state;

    // Update toggle
    focusToggle.checked = enabled;

    // Update timer section
    if (enabled) {
        timerSection.classList.add('active');
        statusIndicator.classList.add('active');
        statusText.textContent = isPaused ? 'Paused' : 'Focus Active';
    } else {
        timerSection.classList.remove('active');
        statusIndicator.classList.remove('active');
        statusText.textContent = 'Ready';
    }

    // Update timer value
    timerValue.textContent = formatTime(elapsedTime || 0);

    // Update pause button
    updatePauseButton(isPaused);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Toggle focus mode
    focusToggle.addEventListener('change', async () => {
        const enabled = focusToggle.checked;

        try {
            await chrome.tabs.sendMessage(currentTab.id, {
                action: 'toggleFocusMode',
                enabled: enabled
            });

            // Update badge
            chrome.runtime.sendMessage({
                action: 'setTabState',
                tabId: currentTab.id,
                enabled: enabled
            });

            updateUI({ enabled, elapsedTime: 0, isPaused: false });
        } catch (error) {
            console.error('Error toggling focus mode:', error);
            focusToggle.checked = !enabled;
        }
    });

    // Pause button
    pauseBtn.addEventListener('click', async () => {
        try {
            await chrome.tabs.sendMessage(currentTab.id, { action: 'pauseTimer' });
            const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getState' });
            updateUI(response);
        } catch (error) {
            console.error('Error pausing timer:', error);
        }
    });

    // Reset button
    resetBtn.addEventListener('click', async () => {
        try {
            await chrome.tabs.sendMessage(currentTab.id, { action: 'resetTimer' });
            timerValue.textContent = '00:00';
        } catch (error) {
            console.error('Error resetting timer:', error);
        }
    });

    // Settings link
    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
}

/**
 * Start periodic timer updates
 */
function startTimerUpdates() {
    timerUpdateInterval = setInterval(async () => {
        if (focusToggle.checked) {
            try {
                const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getState' });
                timerValue.textContent = formatTime(response.elapsedTime || 0);
                updatePauseButton(response.isPaused);
                statusText.textContent = response.isPaused ? 'Paused' : 'Focus Active';
            } catch (error) {
                // Tab might have been closed
                clearInterval(timerUpdateInterval);
            }
        }
    }, 1000);
}

/**
 * Update pause button icon
 */
function updatePauseButton(isPaused) {
    if (isPaused) {
        pauseBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
        pauseBtn.title = 'Resume';
    } else {
        pauseBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;
        pauseBtn.title = 'Pause';
    }
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
