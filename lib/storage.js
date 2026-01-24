const StorageUtils = {
  // Default preferences
  defaults: {
    enabled: false,
    scrollChunkSize: 100, // percentage of viewport height
    showTimer: true,
    whitelist: [],
    timerPaused: false,
    elapsedTime: 0
  },

  /**
   * Get all preferences
   * @returns {Promise<Object>}
   */
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.defaults, (result) => {
        resolve(result);
      });
    });
  },

  /**
   * Get specific preference
   * @param {string} key 
   * @returns {Promise<any>}
   */
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ [key]: this.defaults[key] }, (result) => {
        resolve(result[key]);
      });
    });
  },

  /**
   * Set preferences
   * @param {Object} data 
   * @returns {Promise<void>}
   */
  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(data, resolve);
    });
  },

  /**
   * Check if current hostname is whitelisted
   * @param {string} hostname 
   * @returns {Promise<boolean>}
   */
  async isWhitelisted(hostname) {
    const whitelist = await this.get('whitelist');
    return whitelist.some(domain => hostname.includes(domain));
  },

  /**
   * Get site-specific state
   * @param {string} hostname 
   * @returns {Promise<Object>}
   */
  async getSiteState(hostname) {
    const key = `site_${hostname}`;
    return new Promise((resolve) => {
      chrome.storage.local.get({ [key]: { enabled: false, elapsedTime: 0 } }, (result) => {
        resolve(result[key]);
      });
    });
  },

  /**
   * Set site-specific state
   * @param {string} hostname 
   * @param {Object} state 
   * @returns {Promise<void>}
   */
  async setSiteState(hostname, state) {
    const key = `site_${hostname}`;
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: state }, resolve);
    });
  },

  /**
   * Get reading statistics
   * @returns {Promise<Object>}
   */
  async getReadingStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ readingStats: { totalTime: 0, totalSessions: 0, daily: {} } }, (result) => {
        resolve(result.readingStats);
      });
    });
  },

  /**
   * Set reading statistics
   * @param {Object} stats 
   * @returns {Promise<void>}
   */
  async setReadingStats(stats) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ readingStats: stats }, resolve);
    });
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = StorageUtils;
}
