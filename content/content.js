(function () {
    'use strict';

    // State
    let isEnabled = false;
    let timerInterval = null;
    let elapsedSeconds = 0;
    let isPaused = false;
    let scrollPosition = 0;
    let settings = {
        scrollChunkSize: 100,
        showTimer: true,
        darkMode: false,
        fontSize: 100,
        showProgress: true,
        showReadingSpeed: true,
        focusSessionDuration: 25
    };
    
    let wordCount = 0;
    let readingSpeed = 0;
    let totalReadingTime = 0;
    let focusSessionStartTime = null;
    let focusSessionInterval = null;
    let sessionTimeRemaining = 0;

    // Selectors for distracting elements
    const DISTRACTION_SELECTORS = [
        // Ads
        '[class*="ad-"]', '[class*="ads-"]', '[class*="advert"]',
        '[id*="ad-"]', '[id*="ads-"]', '[id*="advert"]',
        '[class*="sponsor"]', '[id*="sponsor"]',
        '.ad', '.ads', '.adsbygoogle', '.advertisement',
        '[data-ad]', '[data-ads]', '[data-ad-slot]',

        // Popups and modals
        '[class*="popup"]', '[class*="modal"]', '[class*="overlay"]',
        '[class*="newsletter"]', '[class*="subscribe"]',
        '[class*="cookie"]', '[class*="consent"]',

        // Sidebars and widgets
        '[class*="sidebar"]', '[class*="widget"]', '[class*="aside"]',
        'aside:not(article aside)', '[role="complementary"]',

        // Recommendations
        '[class*="recommend"]', '[class*="related"]', '[class*="also-like"]',
        '[class*="more-from"]', '[class*="trending"]',

        // Social sharing
        '[class*="share"]', '[class*="social"]', '[class*="follow-us"]',

        // Sticky elements
        '[class*="sticky-"]', '[class*="fixed-"]',
        '[style*="position: fixed"]', '[style*="position: sticky"]',

        // Headers and footers (often distracting)
        '[class*="site-header"]', '[class*="site-footer"]',
        '[class*="global-header"]', '[class*="global-footer"]',

        // Comments
        '[class*="comment"]', '[id*="comment"]', '#disqus_thread',

        // Notifications and banners
        '[class*="notification"]', '[class*="banner"]', '[class*="alert"]',
        '[class*="promo"]', '[class*="cta"]'
    ];

    // Elements to preserve (main content)
    const PRESERVE_SELECTORS = [
        'article', 'main', '[role="main"]',
        '.post-content', '.article-content', '.entry-content',
        '.post-body', '.article-body', '.story-body',
        '#content', '.content', '.main-content'
    ];

    /**
     * Initialize the content script
     */
    async function init() {
        // Load settings
        await loadSettings();

        // Check if site is whitelisted
        const hostname = window.location.hostname;
        const isWhitelisted = await StorageUtils.isWhitelisted(hostname);

        if (isWhitelisted) {
            console.log('Focus Mode: Site is whitelisted, skipping');
            return;
        }

        // Listen for messages from popup/background
        chrome.runtime.onMessage.addListener(handleMessage);

        // Restore state if returning to page
        const siteState = await StorageUtils.getSiteState(hostname);
        if (siteState.enabled) {
            elapsedSeconds = siteState.elapsedTime || 0;
            enableFocusMode();
        }
    }

    /**
     * Load user settings
     */
    async function loadSettings() {
        const prefs = await StorageUtils.getAll();
        settings.scrollChunkSize = prefs.scrollChunkSize || 100;
        settings.showTimer = prefs.showTimer !== false;
        settings.darkMode = prefs.darkMode || false;
        settings.fontSize = prefs.fontSize || 100;
        settings.showProgress = prefs.showProgress !== false;
        settings.showReadingSpeed = prefs.showReadingSpeed !== false;
        settings.focusSessionDuration = prefs.focusSessionDuration || 25;
        
        // Calculate word count
        wordCount = calculateWordCount();
    }
    
    /**
     * Calculate word count from main content
     */
    function calculateWordCount() {
        const contentSelectors = [
            'article', 'main', '[role="main"]',
            '.post-content', '.article-content', '.entry-content',
            '.post-body', '.article-body', '.story-body',
            '#content', '.content', '.main-content'
        ];
        
        let text = '';
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                text = element.innerText || element.textContent || '';
                break;
            }
        }
        
        if (!text) {
            text = document.body.innerText || document.body.textContent || '';
        }
        
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Handle messages from popup/background
     */
    function handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'toggleFocusMode':
                if (message.enabled) {
                    enableFocusMode();
                } else {
                    disableFocusMode();
                }
                sendResponse({ success: true, enabled: isEnabled });
                break;

            case 'getState':
                sendResponse({
                    enabled: isEnabled,
                    elapsedTime: elapsedSeconds,
                    isPaused: isPaused
                });
                break;

            case 'pauseTimer':
                pauseTimer();
                sendResponse({ success: true });
                break;

            case 'resetTimer':
                resetTimer();
                sendResponse({ success: true });
                break;

            case 'updateSettings':
                settings = { ...settings, ...message.settings };
                if (isEnabled) {
                    updateTimerVisibility();
                    updateProgressBar();
                    updateReadingSpeed();
                    if (settings.darkMode) {
                        applyDarkMode();
                    } else {
                        removeDarkMode();
                    }
                    applyFontSize();
                    
                    // Update timer display if reading speed setting changed
                    const timer = document.getElementById('focus-mode-timer');
                    if (timer && 'showReadingSpeed' in message.settings) {
                        const speedDisplay = timer.querySelector('.reading-speed');
                        if (settings.showReadingSpeed && wordCount > 0 && !speedDisplay) {
                            const speedEl = document.createElement('span');
                            speedEl.className = 'reading-speed';
                            timer.querySelector('.timer-display').appendChild(speedEl);
                            updateReadingSpeed();
                        } else if (!settings.showReadingSpeed && speedDisplay) {
                            speedDisplay.remove();
                        }
                    }
                }
                sendResponse({ success: true });
                break;
        }
        return true;
    }

    /**
     * Enable Focus Mode
     */
    function enableFocusMode() {
        if (isEnabled) return;
        isEnabled = true;

        // Add focus mode class to body
        document.body.classList.add('focus-mode-active');

        // Create overlay for fade effect
        createOverlay();

        // Hide distracting elements
        hideDistractions();

        // Enable scroll locking
        enableScrollLock();
        
        // Update progress on scroll (throttled)
        let scrollTimeout;
        const handleScroll = () => {
            if (scrollTimeout) return;
            scrollTimeout = setTimeout(() => {
                updateProgressBar();
                scrollTimeout = null;
            }, 100);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Store handler for cleanup
        window._focusModeScrollHandler = handleScroll;

        // Create navigation buttons
        createNavButtons();

        // Create and start timer
        if (settings.showTimer) {
            createTimer();
            startTimer();
        }
        
        // Create reading progress bar
        if (settings.showProgress) {
            createProgressBar();
        }
        
        // Apply dark mode
        if (settings.darkMode) {
            applyDarkMode();
        }
        
        // Apply font size
        applyFontSize();
        
        // Start focus session
        startFocusSession();

        // Update badge
        chrome.runtime.sendMessage({ action: 'updateBadge', enabled: true });

        // Save state
        saveState();

        console.log('Focus Mode: Enabled');
    }

    /**
     * Disable Focus Mode
     */
    function disableFocusMode() {
        if (!isEnabled) return;
        isEnabled = false;

        // Remove focus mode class
        document.body.classList.remove('focus-mode-active');

        // Remove overlay
        removeOverlay();

        // Show hidden elements
        showDistractions();

        // Disable scroll locking
        disableScrollLock();
        
        // Remove scroll listener
        if (window._focusModeScrollHandler) {
            window.removeEventListener('scroll', window._focusModeScrollHandler);
            window._focusModeScrollHandler = null;
        }

        // Remove navigation buttons
        removeNavButtons();

        // Remove timer
        removeTimer();
        stopTimer();
        
        // Remove progress bar
        removeProgressBar();
        
        // Remove dark mode
        removeDarkMode();
        
        // Reset font size
        resetFontSize();
        
        // Stop focus session
        stopFocusSession();

        // Update badge
        chrome.runtime.sendMessage({ action: 'updateBadge', enabled: false });

        // Save state
        saveState();

        console.log('Focus Mode: Disabled');
    }

    /**
     * Create fade overlay for smooth transition
     */
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'focus-mode-overlay';
        overlay.className = 'focus-mode-overlay';
        document.body.appendChild(overlay);

        // Trigger fade animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }

    /**
     * Remove fade overlay
     */
    function removeOverlay() {
        const overlay = document.getElementById('focus-mode-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
    }

    /**
     * Hide distracting elements
     */
    function hideDistractions() {
        DISTRACTION_SELECTORS.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
                    // Don't hide elements inside main content
                    const isInMainContent = PRESERVE_SELECTORS.some(ps => el.closest(ps));
                    if (!isInMainContent && !el.closest('#focus-mode-container')) {
                        el.setAttribute('data-focus-hidden', 'true');
                    }
                });
            } catch (e) {
                // Invalid selector, skip
            }
        });
    }

    /**
     * Show previously hidden elements
     */
    function showDistractions() {
        document.querySelectorAll('[data-focus-hidden]').forEach(el => {
            el.removeAttribute('data-focus-hidden');
        });
    }

    /**
     * Enable scroll locking (chunk-based scrolling)
     */
    function enableScrollLock() {
        scrollPosition = window.scrollY;
        document.addEventListener('wheel', handleWheel, { passive: false });
        document.addEventListener('keydown', handleKeydown);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    /**
     * Disable scroll locking
     */
    function disableScrollLock() {
        document.removeEventListener('wheel', handleWheel);
        document.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('touchmove', handleTouchMove);
    }

    /**
     * Handle wheel events for chunk scrolling
     */
    function handleWheel(e) {
        e.preventDefault();

        const direction = e.deltaY > 0 ? 1 : -1;
        scrollByChunk(direction);
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeydown(e) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            scrollByChunk(1);
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            scrollByChunk(-1);
        } else if (e.key === 'Escape') {
            disableFocusMode();
        }
    }

    /**
     * Handle touch move events
     */
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    function handleTouchMove(e) {
        if (!isEnabled) return;

        e.preventDefault();
        const touchEndY = e.touches[0].clientY;
        const diff = touchStartY - touchEndY;

        if (Math.abs(diff) > 50) {
            scrollByChunk(diff > 0 ? 1 : -1);
            touchStartY = touchEndY;
        }
    }

    /**
     * Scroll by one chunk
     */
    function scrollByChunk(direction) {
        const viewportHeight = window.innerHeight;
        const chunkSize = (settings.scrollChunkSize / 100) * viewportHeight;
        const maxScroll = document.documentElement.scrollHeight - viewportHeight;

        scrollPosition += direction * chunkSize;
        scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));

        window.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
        });
    }

    /**
     * Create navigation buttons
     */
    function createNavButtons() {
        const container = document.createElement('div');
        container.id = 'focus-mode-nav';
        container.className = 'focus-mode-nav';

        container.innerHTML = `
      <button class="focus-nav-btn focus-nav-prev" title="Previous (↑)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <button class="focus-nav-btn focus-nav-next" title="Next (↓)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    `;

        document.body.appendChild(container);

        // Add event listeners
        container.querySelector('.focus-nav-prev').addEventListener('click', () => scrollByChunk(-1));
        container.querySelector('.focus-nav-next').addEventListener('click', () => scrollByChunk(1));
    }

    /**
     * Remove navigation buttons
     */
    function removeNavButtons() {
        const nav = document.getElementById('focus-mode-nav');
        if (nav) nav.remove();
    }

    /**
     * Create timer widget
     */
    function createTimer() {
        const timer = document.createElement('div');
        timer.id = 'focus-mode-timer';
        timer.className = 'focus-mode-timer';

        timer.innerHTML = `
      <div class="timer-display">
        <div class="timer-main">
          <span class="timer-icon">📖</span>
          <span class="timer-time">00:00</span>
        </div>
        ${settings.showReadingSpeed && wordCount > 0 ? '<span class="reading-speed">0 WPM</span>' : ''}
      </div>
      <div class="timer-controls">
        <button class="timer-btn timer-pause" title="Pause">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
        <button class="timer-btn timer-reset" title="Reset">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
        </button>
      </div>
    `;

        document.body.appendChild(timer);

        // Add event listeners
        timer.querySelector('.timer-pause').addEventListener('click', togglePause);
        timer.querySelector('.timer-reset').addEventListener('click', resetTimer);

        updateTimerDisplay();
    }

    /**
     * Remove timer widget
     */
    function removeTimer() {
        const timer = document.getElementById('focus-mode-timer');
        if (timer) timer.remove();
    }

    /**
     * Update timer visibility based on settings
     */
    function updateTimerVisibility() {
        const timer = document.getElementById('focus-mode-timer');
        if (timer) {
            timer.style.display = settings.showTimer ? 'flex' : 'none';
        }
    }

    /**
     * Start the timer
     */
    function startTimer() {
        if (timerInterval) return;

        isPaused = false;
        timerInterval = setInterval(() => {
            if (!isPaused) {
                elapsedSeconds++;
                totalReadingTime++;
                updateTimerDisplay();
                updateProgressBar();
                updateReadingSpeed();
                saveState();
                saveReadingStats();
            }
        }, 1000);
    }

    /**
     * Stop the timer
     */
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    /**
     * Toggle pause state
     */
    function togglePause() {
        isPaused = !isPaused;

        const pauseBtn = document.querySelector('.timer-pause');
        if (pauseBtn) {
            if (isPaused) {
                pauseBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
                pauseBtn.title = 'Resume';
            } else {
                pauseBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        `;
                pauseBtn.title = 'Pause';
            }
        }
    }

    /**
     * Pause the timer
     */
    function pauseTimer() {
        if (!isPaused) {
            togglePause();
        }
    }

    /**
     * Reset the timer
     */
    function resetTimer() {
        elapsedSeconds = 0;
        updateTimerDisplay();
        saveState();
    }

    /**
     * Update timer display
     */
    function updateTimerDisplay() {
        const timerTime = document.querySelector('.timer-time');
        if (timerTime) {
            timerTime.textContent = formatTime(elapsedSeconds);
        }
        // Also update reading speed when timer updates
        updateReadingSpeed();
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
    
    /**
     * Create reading progress bar
     */
    function createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.id = 'focus-mode-progress';
        progressBar.className = 'focus-mode-progress';
        progressBar.innerHTML = `
            <div class="progress-bar-fill"></div>
            <div class="progress-text">0%</div>
        `;
        document.body.appendChild(progressBar);
        updateProgressBar();
    }
    
    /**
     * Remove reading progress bar
     */
    function removeProgressBar() {
        const progressBar = document.getElementById('focus-mode-progress');
        if (progressBar) progressBar.remove();
    }
    
    /**
     * Update reading progress bar
     */
    function updateProgressBar() {
        const progressBar = document.getElementById('focus-mode-progress');
        if (!progressBar) return;
        
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollHeight > 0 ? Math.min(100, Math.round((scrollTop / scrollHeight) * 100)) : 0;
        
        const fill = progressBar.querySelector('.progress-bar-fill');
        const text = progressBar.querySelector('.progress-text');
        
        if (fill) fill.style.width = `${progress}%`;
        if (text) text.textContent = `${progress}%`;
    }
    
    /**
     * Apply dark mode
     */
    function applyDarkMode() {
        document.body.classList.add('focus-dark-mode');
    }
    
    /**
     * Remove dark mode
     */
    function removeDarkMode() {
        document.body.classList.remove('focus-dark-mode');
    }
    
    /**
     * Apply font size adjustment
     */
    function applyFontSize() {
        const baseSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const multiplier = settings.fontSize / 100;
        document.body.style.fontSize = `${baseSize * multiplier}px`;
    }
    
    /**
     * Reset font size
     */
    function resetFontSize() {
        document.body.style.fontSize = '';
    }
    
    /**
     * Update reading speed (WPM)
     */
    function updateReadingSpeed() {
        if (!settings.showReadingSpeed || wordCount === 0) return;
        
        const minutes = elapsedSeconds / 60;
        if (minutes > 0.1) { // Only calculate if at least 6 seconds have passed
            readingSpeed = Math.round(wordCount / minutes);
        } else {
            readingSpeed = 0;
        }
        
        const timer = document.getElementById('focus-mode-timer');
        if (timer && settings.showReadingSpeed) {
            let speedDisplay = timer.querySelector('.reading-speed');
            if (!speedDisplay && wordCount > 0) {
                // Create speed display if it doesn't exist
                speedDisplay = document.createElement('span');
                speedDisplay.className = 'reading-speed';
                timer.querySelector('.timer-display').appendChild(speedDisplay);
            }
            if (speedDisplay) {
                speedDisplay.textContent = readingSpeed > 0 ? `${readingSpeed} WPM` : 'Calculating...';
            }
        }
    }
    
    /**
     * Start focus session (Pomodoro-style)
     */
    function startFocusSession() {
        focusSessionStartTime = Date.now();
        sessionTimeRemaining = settings.focusSessionDuration * 60; // Convert to seconds
        
        focusSessionInterval = setInterval(() => {
            if (!isPaused && sessionTimeRemaining > 0) {
                sessionTimeRemaining--;
                updateFocusSessionDisplay();
                
                if (sessionTimeRemaining === 0) {
                    // Session complete
                    showSessionCompleteNotification();
                    stopFocusSession();
                }
            }
        }, 1000);
    }
    
    /**
     * Stop focus session
     */
    function stopFocusSession() {
        if (focusSessionInterval) {
            clearInterval(focusSessionInterval);
            focusSessionInterval = null;
        }
        removeFocusSessionDisplay();
    }
    
    /**
     * Update focus session display
     */
    function updateFocusSessionDisplay() {
        const timer = document.getElementById('focus-mode-timer');
        if (!timer) return;
        
        let sessionDisplay = timer.querySelector('.focus-session-time');
        if (!sessionDisplay) {
            sessionDisplay = document.createElement('div');
            sessionDisplay.className = 'focus-session-time';
            timer.querySelector('.timer-display').appendChild(sessionDisplay);
        }
        
        const minutes = Math.floor(sessionTimeRemaining / 60);
        const seconds = sessionTimeRemaining % 60;
        sessionDisplay.textContent = `Session: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * Remove focus session display
     */
    function removeFocusSessionDisplay() {
        const timer = document.getElementById('focus-mode-timer');
        if (timer) {
            const sessionDisplay = timer.querySelector('.focus-session-time');
            if (sessionDisplay) sessionDisplay.remove();
        }
    }
    
    /**
     * Show session complete notification
     */
    function showSessionCompleteNotification() {
        const notification = document.createElement('div');
        notification.className = 'focus-session-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">🎉</span>
                <div>
                    <div class="notification-title">Focus Session Complete!</div>
                    <div class="notification-message">Great job! Take a break.</div>
                </div>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    /**
     * Save reading statistics
     */
    async function saveReadingStats() {
        const today = new Date().toISOString().split('T')[0];
        const stats = await StorageUtils.getReadingStats();
        
        if (!stats.daily) stats.daily = {};
        if (!stats.daily[today]) stats.daily[today] = 0;
        stats.daily[today] += 1; // Add 1 second
        
        stats.totalTime = (stats.totalTime || 0) + 1;
        stats.totalSessions = (stats.totalSessions || 0) + (elapsedSeconds === 1 ? 1 : 0);
        
        await StorageUtils.setReadingStats(stats);
    }

    /**
     * Save current state
     */
    function saveState() {
        const hostname = window.location.hostname;
        StorageUtils.setSiteState(hostname, {
            enabled: isEnabled,
            elapsedTime: elapsedSeconds
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
