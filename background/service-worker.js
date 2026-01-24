// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Focus Mode extension installed');

    // Set default preferences
    const defaults = {
        scrollChunkSize: 100,
        showTimer: true,
        showReadingSpeed: true,
        showProgress: true,
        darkMode: false,
        fontSize: 100,
        focusSessionDuration: 25,
        whitelist: []
    };

    chrome.storage.sync.get(defaults, (result) => {
        chrome.storage.sync.set(result);
    });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'getTabState':
            handleGetTabState(sender.tab?.id).then(sendResponse);
            return true;

        case 'setTabState':
            handleSetTabState(message.tabId || sender.tab?.id, message.enabled).then(sendResponse);
            return true;

        case 'toggleFocusMode':
            handleToggleFocusMode(message.tabId).then(sendResponse);
            return true;

        case 'updateBadge':
            updateBadge(message.tabId || sender.tab?.id, message.enabled);
            sendResponse({ success: true });
            return true;
    }
});

/**
 * Get focus mode state for a tab
 * @param {number} tabId 
 * @returns {Promise<Object>}
 */
async function handleGetTabState(tabId) {
    try {
        const result = await chrome.storage.session.get(`tab_${tabId}`);
        return result[`tab_${tabId}`] || { enabled: false };
    } catch (error) {
        console.error('Error getting tab state:', error);
        return { enabled: false };
    }
}

/**
 * Set focus mode state for a tab
 * @param {number} tabId 
 * @param {boolean} enabled 
 * @returns {Promise<Object>}
 */
async function handleSetTabState(tabId, enabled) {
    try {
        await chrome.storage.session.set({ [`tab_${tabId}`]: { enabled } });
        updateBadge(tabId, enabled);
        return { success: true };
    } catch (error) {
        console.error('Error setting tab state:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle focus mode for a tab
 * @param {number} tabId 
 * @returns {Promise<Object>}
 */
async function handleToggleFocusMode(tabId) {
    try {
        const currentState = await handleGetTabState(tabId);
        const newEnabled = !currentState.enabled;

        await handleSetTabState(tabId, newEnabled);

        // Send message to content script
        await chrome.tabs.sendMessage(tabId, {
            action: 'toggleFocusMode',
            enabled: newEnabled
        });

        return { success: true, enabled: newEnabled };
    } catch (error) {
        console.error('Error toggling focus mode:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update badge to show focus mode state
 * @param {number} tabId 
 * @param {boolean} enabled 
 */
function updateBadge(tabId, enabled) {
    if (!tabId) return;

    if (enabled) {
        chrome.action.setBadgeText({ text: 'ON', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
    } else {
        chrome.action.setBadgeText({ text: '', tabId });
    }
}

// Clean up tab state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.session.remove(`tab_${tabId}`);
});
