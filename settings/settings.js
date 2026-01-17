document.addEventListener('DOMContentLoaded', init);

// DOM Elements
let scrollChunkSize, scrollChunkValue, showTimer;
let whitelistInput, addWhitelistBtn, whitelistItems;
let resetBtn, saveStatus;

// Default settings
const defaults = {
    scrollChunkSize: 100,
    showTimer: true,
    whitelist: []
};

/**
 * Initialize settings page
 */
async function init() {
    // Get DOM elements
    scrollChunkSize = document.getElementById('scrollChunkSize');
    scrollChunkValue = document.getElementById('scrollChunkValue');
    showTimer = document.getElementById('showTimer');
    whitelistInput = document.getElementById('whitelistInput');
    addWhitelistBtn = document.getElementById('addWhitelistBtn');
    whitelistItems = document.getElementById('whitelistItems');
    resetBtn = document.getElementById('resetBtn');
    saveStatus = document.getElementById('saveStatus');

    // Load saved settings
    await loadSettings();

    // Setup event listeners
    setupEventListeners();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(defaults, (result) => {
            // Scroll chunk size
            scrollChunkSize.value = result.scrollChunkSize;
            scrollChunkValue.textContent = `${result.scrollChunkSize}%`;

            // Show timer
            showTimer.checked = result.showTimer;

            // Whitelist
            renderWhitelist(result.whitelist);

            resolve();
        });
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Scroll chunk size slider
    scrollChunkSize.addEventListener('input', () => {
        scrollChunkValue.textContent = `${scrollChunkSize.value}%`;
    });

    scrollChunkSize.addEventListener('change', () => {
        saveSettings({ scrollChunkSize: parseInt(scrollChunkSize.value) });
    });

    // Show timer toggle
    showTimer.addEventListener('change', () => {
        saveSettings({ showTimer: showTimer.checked });
    });

    // Add to whitelist
    addWhitelistBtn.addEventListener('click', addToWhitelist);
    whitelistInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addToWhitelist();
        }
    });

    // Reset to defaults
    resetBtn.addEventListener('click', resetToDefaults);
}

/**
 * Save settings to storage
 */
function saveSettings(settings) {
    chrome.storage.sync.set(settings, () => {
        showSaveStatus();

        // Notify content scripts about settings update
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateSettings',
                    settings: settings
                }).catch(() => {
                    // Tab might not have content script
                });
            });
        });
    });
}

/**
 * Show save status indicator
 */
function showSaveStatus() {
    saveStatus.classList.add('visible');
    setTimeout(() => {
        saveStatus.classList.remove('visible');
    }, 2000);
}

/**
 * Add domain to whitelist
 */
async function addToWhitelist() {
    const domain = whitelistInput.value.trim().toLowerCase();

    if (!domain) return;

    // Basic validation
    if (!isValidDomain(domain)) {
        whitelistInput.style.borderColor = '#ef4444';
        setTimeout(() => {
            whitelistInput.style.borderColor = '';
        }, 1000);
        return;
    }

    // Get current whitelist
    const result = await new Promise(resolve => {
        chrome.storage.sync.get({ whitelist: [] }, resolve);
    });

    const whitelist = result.whitelist;

    // Check if already exists
    if (whitelist.includes(domain)) {
        whitelistInput.value = '';
        return;
    }

    // Add to whitelist
    whitelist.push(domain);

    // Save
    saveSettings({ whitelist });

    // Update UI
    renderWhitelist(whitelist);
    whitelistInput.value = '';
}

/**
 * Remove domain from whitelist
 */
async function removeFromWhitelist(domain) {
    const result = await new Promise(resolve => {
        chrome.storage.sync.get({ whitelist: [] }, resolve);
    });

    const whitelist = result.whitelist.filter(d => d !== domain);

    // Save
    saveSettings({ whitelist });

    // Update UI
    renderWhitelist(whitelist);
}

/**
 * Render whitelist items
 */
function renderWhitelist(whitelist) {
    whitelistItems.innerHTML = '';

    whitelist.forEach(domain => {
        const li = document.createElement('li');
        li.className = 'whitelist-item';
        li.innerHTML = `
      <span>${domain}</span>
      <button class="remove-btn" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

        li.querySelector('.remove-btn').addEventListener('click', () => {
            removeFromWhitelist(domain);
        });

        whitelistItems.appendChild(li);
    });
}

/**
 * Validate domain
 */
function isValidDomain(domain) {
    // Simple domain validation
    const pattern = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    return pattern.test(domain);
}

/**
 * Reset to default settings
 */
function resetToDefaults() {
    chrome.storage.sync.set(defaults, () => {
        loadSettings();
        showSaveStatus();
    });
}
