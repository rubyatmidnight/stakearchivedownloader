// ==UserScript==
// @name         Stake Game Archive Downloader
// @namespace    https://stakestats.net
// @version      1.2.0
// @description  Safely download multiple files from paginated tables with improved UX and error handling
// @author       Ruby
// @homepage     https://stakestats.net
// @supportURL   https://github.com/rubyatmidnight/stakearchivedownloader/issues
// @match        https://stake.us/*
// @match        https://stake.com/*
// @match        https://stake.ac/*
// @match        https://stake.games/*
// @match        https://stake.bet/*
// @match        https://stake.pet/*
// @match        https://stake1001.com/*
// @match        https://stake1002.com/*
// @match        https://stake1003.com/*
// @match        https://stake1021.com/*
// @match        https://stake1022.com/*
// @match        https://stake.mba/*
// @match        https://stake.jp/*
// @match        https://stake.bz/*
// @match        https://staketr.com/*
// @match        https://stake.ceo/*
// @match        https://stake.krd/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// ==/UserScript==

(function() {
  'use strict';

  /**
   * Enhanced File Downloader Utility
   * Safely downloads multiple files from paginated tables
   * with improved UX and error handling
   */

  // Main controller
  class ArchiveDownloader {
    // Explicitly declare all instance properties for type safety and linting
    isDownloading = false;
    pageCount = 0;
    downloadCount = 0;
    errorCount = 0;
    pauseRequested = false;
    settings = {
      delayBetweenDownloads: 1000,
      delayBetweenPages: 2000,
      showNotifications: true,
      maxRetries: 3,
      fileNamePrefix: 'archive',
      preferredDomain: 'stake.us'
    };
    downloadAttempts = []; // { url, filename, status: 'success'|'failed', error? }
    failedDownloads = [];

    constructor() {
      // Config vars
      this.isDownloading = false;
      this.pageCount = 0;
      this.downloadCount = 0;
      this.errorCount = 0;
      this.pauseRequested = false;
      this.settings = {
        delayBetweenDownloads: 1000,
        delayBetweenPages: 2000,
        showNotifications: true,
        maxRetries: 3,
        fileNamePrefix: 'archive',
        preferredDomain: 'stake.us' // Default fallback
      };

      // Auto-detect current domain
      if (typeof window !== 'undefined' && window.location) {
        this.settings.preferredDomain = this.getCurrentDomain();
      }

      // Track all attempted downloads for summary
      this.downloadAttempts = []; // { url, filename, status: 'success'|'failed', error? }

      // For retrying failed
      this.failedDownloads = [];

      // Load settings from storage if available
      this.loadSettings();

      // Init UI if DOM available
      if (typeof document !== 'undefined') {
        this.initUI();
      }
    }

    // Get current domain from the page we're on
    getCurrentDomain() {
      try {
        const currentDomain = window.location.hostname;
        const mirrorDomains = this.getMirrorDomains();
        
        // Check if current domain is in our mirror list
        for (const domain of mirrorDomains) {
          if (currentDomain === domain || currentDomain.endsWith('.' + domain)) {
            return domain;
          }
        }
        
        // Default to the first domain if not found
        return mirrorDomains[0];
      } catch (error) {
        this.logError('Error detecting current domain', error);
        return this.settings.preferredDomain || 'stake.us'; // Fallback
      }
    }

    // Load settings from Tampermonkey storage
    loadSettings() {
      if (typeof GM_getValue === 'function') {
        const saved = GM_getValue('archiveDownloaderSettings');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            this.settings = Object.assign({}, this.settings, parsed);
          } catch (e) {
            // ignore
          }
        }
      }
    }

    // Save settings to Tampermonkey storage
    saveSettings() {
      // Read from UI
      const downloadDelayElem = document.getElementById('downloadDelay');
      const pageDelayElem = document.getElementById('pageDelay');
      const filePrefixElem = document.getElementById('filePrefix');
      const preferredDomainElem = document.getElementById('preferredDomain');
      const showNotificationsElem = document.getElementById('showNotifications');

      const downloadDelay = downloadDelayElem && 'value' in downloadDelayElem ? parseInt(downloadDelayElem.value, 10) : NaN;
      const pageDelay = pageDelayElem && 'value' in pageDelayElem ? parseInt(pageDelayElem.value, 10) : NaN;
      const filePrefix = filePrefixElem && 'value' in filePrefixElem ? filePrefixElem.value : '';
      const preferredDomain = preferredDomainElem && 'value' in preferredDomainElem ? preferredDomainElem.value : this.settings.preferredDomain;
      const showNotifications = showNotificationsElem && 'checked' in showNotificationsElem ? showNotificationsElem.checked : this.settings.showNotifications;

      this.settings.delayBetweenDownloads = isNaN(downloadDelay) ? 1000 : downloadDelay;
      this.settings.delayBetweenPages = isNaN(pageDelay) ? 2000 : pageDelay;
      this.settings.fileNamePrefix = filePrefix || 'archive';
      this.settings.preferredDomain = preferredDomain;
      this.settings.showNotifications = !!showNotifications;

      if (typeof GM_setValue === 'function') {
        GM_setValue('archiveDownloaderSettings', JSON.stringify(this.settings));
      }

      this.updateStatus('Settings saved!', 'success', true);
      this.toggleSettings();
    }

    // Init controls
    initUI() {
      // Create control panel
      this.createControlPanel();

      // Handle keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+D to toggle downloader
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          this.toggleDownloader();
          e.preventDefault();
        }
      });

      // Log init
      console.log('🐱 Archive Downloader initialized! Use the control panel or type startDownloader()');
    }

    // Create floating UI
    createControlPanel() {
      // Check if panel exists
      if (document.getElementById('downloadControlPanel')) return;

      // Create container
      const panel = document.createElement('div');
      panel.id = 'downloadControlPanel';
      panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 9999;
        font-family: Arial, sans-serif;
        min-width: 250px;
        transition: all 0.3s ease;
        cursor: move;
      `;

      // Add header
      const header = document.createElement('div');
      header.innerHTML = '<h3 style="margin: 0 0 10px 0; font-size: 16px; cursor: move;">Archive Downloader</h3>';
      header.style.cssText = 'padding-bottom: 8px; border-bottom: 1px solid #eee; margin-bottom: 10px;';
      panel.appendChild(header);

      // Status display
      const statusDiv = document.createElement('div');
      statusDiv.id = 'downloadStatus';
      statusDiv.style.cssText = 'margin: 8px 0; font-size: 14px;';
      statusDiv.textContent = 'Ready to download';
      panel.appendChild(statusDiv);

      // Progress info
      const progressDiv = document.createElement('div');
      progressDiv.id = 'downloadProgress';
      progressDiv.style.cssText = 'margin: 8px 0; font-size: 12px;';
      panel.appendChild(progressDiv);

      // Controls container
      const controls = document.createElement('div');
      controls.style.cssText = 'display: flex; gap: 8px; margin-top: 10px;';

      // Start button
      const startBtn = this.createButton('Start', '#4caf50', () => this.startDownloader());
      controls.appendChild(startBtn);

      // Pause button
      const pauseBtn = this.createButton('Pause', '#ff9800', () => this.pauseDownloader());
      controls.appendChild(pauseBtn);

      // Stop button
      const stopBtn = this.createButton('Stop', '#f44336', () => this.stopDownloader());
      controls.appendChild(stopBtn);

      // Settings button
      const settingsBtn = this.createButton('⚙️', '#2196f3', () => this.toggleSettings());
      controls.appendChild(settingsBtn);

      panel.appendChild(controls);

      // Retry Failed button (hidden by default)
      const retryBtn = this.createButton('Retry Failed', '#e91e63', () => this.retryFailedDownloads());
      retryBtn.id = 'retryFailedBtn';
      retryBtn.style.display = 'none';
      retryBtn.style.marginTop = '8px';
      panel.appendChild(retryBtn);

      // Settings panel (hidden by default)
      const settingsPanel = document.createElement('div');
      settingsPanel.id = 'downloaderSettings';
      settingsPanel.style.cssText = 'margin-top: 10px; display: none; font-size: 12px;';

      // Add settings
      settingsPanel.innerHTML = `
        <div style="margin: 5px 0;">
          <label for="downloadDelay">Download Delay (ms):</label>
          <input type="number" id="downloadDelay" min="500" max="10000" step="100" value="${this.settings.delayBetweenDownloads}" style="width: 70px;">
        </div>
        <div style="margin: 5px 0;">
          <label for="pageDelay">Page Change Delay (ms):</label>
          <input type="number" id="pageDelay" min="1000" max="10000" step="100" value="${this.settings.delayBetweenPages}" style="width: 70px;">
        </div>
        <div style="margin: 5px 0;">
          <label for="filePrefix">File Prefix:</label>
          <input type="text" id="filePrefix" value="${this.settings.fileNamePrefix}" style="width: 100px;">
        </div>
        <div style="margin: 5px 0;">
          <label for="preferredDomain">Preferred Domain:</label>
          <select id="preferredDomain" style="width: 100%;">
            ${this.getMirrorDomains().map(domain =>
              `<option value="${domain}" ${domain === this.settings.preferredDomain ? 'selected' : ''}>${domain}</option>`
            ).join('')}
          </select>
        </div>
        <div style="margin: 5px 0;">
          <label>
            <input type="checkbox" id="showNotifications" ${this.settings.showNotifications ? 'checked' : ''}>
            Show browser notifications
          </label>
        </div>
      `;

      // Save settings button
      const saveSettingsBtn = this.createButton('Save Settings', '#2196f3', () => this.saveSettings());
      settingsPanel.appendChild(saveSettingsBtn);

      panel.appendChild(settingsPanel);

      // Add summary dialog (hidden by default)
      const summaryDialog = document.createElement('div');
      summaryDialog.id = 'downloadSummaryDialog';
      summaryDialog.style.cssText = `
        display: none;
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: #fff;
        border: 2px solid #2196f3;
        border-radius: 10px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        z-index: 10000;
        min-width: 320px;
        max-width: 90vw;
        padding: 24px 18px 18px 18px;
        font-size: 15px;
      `;
      summaryDialog.innerHTML = `
        <div id="summaryContent"></div>
        <div style="margin-top: 18px; text-align: right;">
          <button id="closeSummaryBtn" style="background:#2196f3;color:#fff;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-size:15px;">Close</button>
          <button id="retrySummaryBtn" style="background:#e91e63;color:#fff;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-size:15px;display:none;margin-left:8px;">Retry Failed</button>
        </div>
      `;
      document.body.appendChild(summaryDialog);

      // Add to body
      document.body.appendChild(panel);

      // Make panel draggable
      this.makeDraggable(panel, header);

      // Close summary dialog handler
      const closeSummaryBtn = document.getElementById('closeSummaryBtn');
      if (closeSummaryBtn) {
        closeSummaryBtn.onclick = () => {
          summaryDialog.style.display = 'none';
        };
      }
      // Retry from summary dialog
      const retrySummaryBtn = document.getElementById('retrySummaryBtn');
      if (retrySummaryBtn) {
        retrySummaryBtn.onclick = () => {
          summaryDialog.style.display = 'none';
          this.retryFailedDownloads();
        };
      }
    }

    // Make element draggable
    makeDraggable(element, dragHandle) {
      if (!element || !dragHandle) return;

      let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

      // Mouse down event
      dragHandle.onmousedown = dragMouseDown;

      function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();

        // Get mouse position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;

        // Add listeners
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }

      function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();

        // Calculate new position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        // Set element's new position
        const newTop = (element.offsetTop - pos2);
        const newLeft = (element.offsetLeft - pos1);

        // Constrain to window
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;

        element.style.top = `${Math.max(0, Math.min(newTop, maxY))}px`;
        element.style.left = `${Math.max(0, Math.min(newLeft, maxX))}px`;
      }

      function closeDragElement() {
        // Remove event listeners
        document.onmouseup = null;
        document.onmousemove = null;
      }

      // Enable touch support
      dragHandle.ontouchstart = function(e) {
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;

        document.ontouchend = function() {
          document.ontouchend = null;
          document.ontouchmove = null;
        };

        document.ontouchmove = function(e) {
          const touch = e.touches[0];

          pos1 = pos3 - touch.clientX;
          pos2 = pos4 - touch.clientY;
          pos3 = touch.clientX;
          pos4 = touch.clientY;

          const newTop = (element.offsetTop - pos2);
          const newLeft = (element.offsetLeft - pos1);

          const maxX = window.innerWidth - element.offsetWidth;
          const maxY = window.innerHeight - element.offsetHeight;

          element.style.top = `${Math.max(0, Math.min(newTop, maxY))}px`;
          element.style.left = `${Math.max(0, Math.min(newLeft, maxX))}px`;

          e.preventDefault();
        };

        e.preventDefault();
      };
    }

    // Helper for button creation
    createButton(text, color, onClick) {
      const button = document.createElement('button');
      button.textContent = text;
      button.style.cssText = `
        background-color: ${color};
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: opacity 0.2s;
      `;
      button.addEventListener('click', onClick);
      button.addEventListener('mouseenter', () => button.style.opacity = '0.8');
      button.addEventListener('mouseleave', () => button.style.opacity = '1');
      return button;
    }

    // Toggle settings panel
    toggleSettings() {
      const settingsPanel = document.getElementById('downloaderSettings');
      if (settingsPanel) {
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
      }
    }

    // Mirror domains to mask
    getMirrorDomains() {
      return [
        'stake.us',
        'stake.com',
        'stake.ac',
        'stake.games',
        'stake.bet',
        'stake.pet',
        'stake1001.com',
        'stake1002.com',
        'stake1003.com',
        'stake1021.com',
        'stake1022.com',
        'stake.mba',
        'stake.jp',
        'stake.bz',
        'staketr.com',
        'stake.ceo',
        'stake.krd'
      ];
    }

    // Replace URL domain with current domain
    maskUrl(url) {
      try {
        if (!url || typeof url !== 'string') return url;

        const urlObj = new URL(url);
        const domains = this.getMirrorDomains();

        // Check if current domain is in our list
        const domainFound = domains.some(domain =>
          urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );

        if (domainFound) {
          // Use the current domain from the page we're on
          const currentDomain = this.getCurrentDomain();
          const newUrl = new URL(url);
          newUrl.hostname = currentDomain;
          return newUrl.toString();
        }

        return url;
      } catch (error) {
        this.logError('Error masking URL', error);
        return url;
      }
    }

    // Format date for filenames
    formatDateForFilename(dateString) {
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'invalid-date';

        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      } catch (error) {
        this.logError('Date formatting error', error);
        return 'error-date';
      }
    }

    // Securely download file
    async downloadFile(url, filename, retryCount = 0) {
      try {
        // Mask URL to preferred domain
        url = this.maskUrl(url);

        // Verify URL
        if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
          throw new Error('Invalid URL: Must be HTTPS');
        }

        // Verify filename
        if (!filename || typeof filename !== 'string') {
          throw new Error('Invalid filename');
        }

        // Fetch with timeout and privacy options
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          mode: 'cors'
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const blob = await response.blob();

        // Create and trigger download
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.style.display = 'none';
        a.setAttribute('referrerpolicy', 'no-referrer');
        document.body.appendChild(a);
        if (typeof a.click === 'function') {
          a.click();
        } else {
          // For very old browsers
          const evt = document.createEvent('MouseEvents');
          evt.initEvent('click', true, true);
          a.dispatchEvent(evt);
        }

        // Clean up
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          if (a.parentNode) {
            a.parentNode.removeChild(a);
          }
        }, 100);

        this.downloadCount++;
        this.updateStatus(`Downloaded: ${filename}`, 'success');

        // Track success
        this.downloadAttempts.push({ url, filename, status: 'success' });

        return true;
      } catch (error) {
        this.logError(`Failed to download ${filename}`, error);

        // Retry logic
        if (retryCount < this.settings.maxRetries && this.isDownloading) {
          this.updateStatus(`Retrying download: ${filename} (${retryCount + 1}/${this.settings.maxRetries})`, 'warning');
          await this.delay(1000); // Wait before retry
          return this.downloadFile(url, filename, retryCount + 1);
        } else {
          this.errorCount++;
          // Track failure
          this.downloadAttempts.push({ url, filename, status: 'failed', error: error && error.message ? error.message : String(error) });
          return false;
        }
      }
    }

    // Process table rows on current page
    async processCurrentPage() {
      try {
        // Find table rows
        const rows = Array.from(document.querySelectorAll('.table-cell-item'));
        if (!rows.length) {
          this.updateStatus('No data rows found on current page', 'warning');
          return 0;
        }

        let filesProcessed = 0;

        // Process pairs of rows (date + link)
        for (let i = 0; i < rows.length; i += 2) {
          // Check if download was canceled
          if (!this.isDownloading) break;

          // Check if paused
          if (this.pauseRequested) {
            this.updateStatus('Download paused. Click Start to resume.', 'info');
            this.isDownloading = false;
            this.pauseRequested = false;
            break;
          }

          const dateElement = rows[i]?.querySelector('.weight-semibold');
          
          // Find the link element for any mirror domain
          let linkElement = null;
          const mirrorDomains = this.getMirrorDomains();
          
          // Try to find a link for any mirror domain
          for (const domain of mirrorDomains) {
            linkElement = rows[i + 1]?.querySelector(`a[href^="https://${domain}/_api/archive/"]`);
            if (linkElement) break;
          }
          
          // Fallback: if not found, try any /_api/archive/ link
          if (!linkElement) {
            linkElement = rows[i + 1]?.querySelector('a[href*="/_api/archive/"]');
          }

          if (dateElement && linkElement) {
            const dateString = (dateElement.textContent || '').trim();
            const url = linkElement.href;
            const formattedDate = this.formatDateForFilename(dateString);
            const filename = `${this.settings.fileNamePrefix}_${formattedDate}.json`;

            this.updateStatus(`Downloading: ${filename}`, 'info');
            await this.downloadFile(url, filename);
            filesProcessed++;

            // Wait between downloads
            if (this.isDownloading && i + 2 < rows.length) {
              await this.delay(this.settings.delayBetweenDownloads);
            }
          }
        }

        return filesProcessed;
      } catch (error) {
        this.logError('Error processing page', error);
        return 0;
      }
    }

    // Go to next page if available
    gotoNextPage() {
      try {
        const nextButton = document.querySelector('a[data-test="pagination-next"]');
        if (nextButton && !nextButton.getAttribute('disabled')) {
          if (typeof nextButton.click === 'function') {
            nextButton.click();
          } else {
            // For very old browsers
            const evt = document.createEvent('MouseEvents');
            evt.initEvent('click', true, true);
            nextButton.dispatchEvent(evt);
          }
          return true;
        }
        return false;
      } catch (error) {
        this.logError('Error navigating to next page', error);
        return false;
      }
    }

    // Main download process
    async runDownloader() {
      this.pageCount = 1;
      this.downloadAttempts = []; // Reset attempts for this run

      try {
        while (this.isDownloading) {
          this.updateStatus(`Processing page ${this.pageCount}`, 'info');

          // Wait for page content to load
          await this.delay(500);

          // Process current page
          const filesProcessed = await this.processCurrentPage();

          // Check if we should continue
          if (!this.isDownloading) break;

          // Try to go to next page
          const hasNextPage = this.gotoNextPage();
          if (!hasNextPage) {
            this.updateStatus('Reached the last page. Download complete!', 'success');
            break;
          }

          this.pageCount++;

          // Wait for page transition
          await this.delay(this.settings.delayBetweenPages);
        }
      } catch (error) {
        this.logError('Download process error', error);
      } finally {
        // Final status update
        if (this.isDownloading) {
          this.isDownloading = false;
          this.updateStatus('Download complete!', 'success', true);
        }
        // Show summary dialog
        this.showSummaryDialog();
      }
    }

    // Start the downloader
    startDownloader() {
      if (!this.isDownloading) {
        this.isDownloading = true;
        this.pauseRequested = false;

        // Reset counters if not resuming
        if (this.pageCount === 0) {
          this.downloadCount = 0;
          this.errorCount = 0;
        }

        // Reset attempts and failed list
        this.downloadAttempts = [];
        this.failedDownloads = [];

        // Hide summary dialog if open
        const summaryDialog = document.getElementById('downloadSummaryDialog');
        if (summaryDialog) summaryDialog.style.display = 'none';

        this.updateStatus('Starting downloader...', 'info', true);
        this.runDownloader().catch(error => this.logError('An error occurred', error));
      } else {
        this.updateStatus('Downloader is already running.', 'warning');
      }
    }

    // Pause the downloader
    pauseDownloader() {
      if (this.isDownloading) {
        this.pauseRequested = true;
        this.updateStatus('Pausing after current download...', 'info');
      } else {
        this.updateStatus('Downloader is not running.', 'warning');
      }
    }

    // Stop the downloader immediately
    stopDownloader() {
      if (this.isDownloading) {
        this.isDownloading = false;
        this.pauseRequested = false;
        this.updateStatus('Downloader stopped.', 'warning', true);
      } else {
        this.updateStatus('Downloader is not running.', 'warning');
      }
    }

    // Toggle downloader (keyboard shortcut)
    toggleDownloader() {
      if (this.isDownloading) {
        this.stopDownloader();
      } else {
        this.startDownloader();
      }
    }

    // Update status display
    updateStatus(message, type = 'info', showNotification = false) {
      // Log to console
      console.log(`[Archive Downloader] ${message}`);

      // Update UI if available
      const statusElement = document.getElementById('downloadStatus');
      if (statusElement) {
        statusElement.textContent = message;

        // Apply color based on type
        const colors = {
          info: '#2196f3',
          success: '#4caf50',
          warning: '#ff9800',
          error: '#f44336'
        };
        statusElement.style.color = colors[type] || colors.info;
      }

      // Update progress info
      this.updateProgressDisplay();

      // Show browser notification if enabled
      if (showNotification && this.settings.showNotifications) {
        this.showNotification('Archive Downloader', message);
      }
    }

    // Update progress display
    updateProgressDisplay() {
      const progressDiv = document.getElementById('downloadProgress');
      if (progressDiv) {
        progressDiv.innerHTML = `
          Pages: ${this.pageCount} | 
          Downloaded: ${this.downloadCount} files | 
          Errors: ${this.errorCount}
        `;
      }
      // Show/hide Retry Failed button
      const retryBtn = document.getElementById('retryFailedBtn');
      if (retryBtn) {
        const hasFailed = this.downloadAttempts && this.downloadAttempts.some(a => a.status === 'failed');
        retryBtn.style.display = hasFailed ? 'block' : 'none';
      }
    }

    // Show browser notification (Tampermonkey or fallback)
    showNotification(title, message) {
      try {
        if (typeof GM_notification === 'function') {
          GM_notification({ title, text: message, timeout: 4000 });
        } else if (typeof Notification !== 'undefined' && 'permission' in Notification) {
          // Fallback to browser notification
          if (Notification.permission === 'granted') {
            new Notification(title, { body: message });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification(title, { body: message });
              }
            });
          }
        }
      } catch (error) {
        console.error('Notification error:', error);
      }
    }

    // Log errors
    logError(message, error) {
      console.error(`[Archive Downloader] ${message}:`, error);
      this.updateStatus(`Error: ${message} - ${error && error.message ? error.message : 'Unknown error'}`, 'error');
    }

    // Helper for async delays
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Show summary dialog at end
    showSummaryDialog() {
      const summaryDialog = document.getElementById('downloadSummaryDialog');
      if (!summaryDialog) return;

      // Gather results
      const attempts = this.downloadAttempts || [];
      const successes = attempts.filter(a => a.status === 'success');
      const failures = attempts.filter(a => a.status === 'failed');

      // Save failed for retry
      this.failedDownloads = failures.map(f => ({ url: f.url, filename: f.filename }));

      // Build summary HTML
      let html = `
        <div style="font-size:17px;font-weight:bold;margin-bottom:8px;">Download Summary</div>
        <div><span style="color:#4caf50;font-weight:bold;">Success:</span> ${successes.length}</div>
        <div><span style="color:#f44336;font-weight:bold;">Failed:</span> ${failures.length}</div>
      `;

      if (successes.length > 0) {
        html += `<div style="margin-top:10px;"><b>Successful:</b><ul style="margin:0 0 0 18px;padding:0;">`;
        for (const s of successes) {
          html += `<li style="color:#4caf50;">${this.escapeHtml(s.filename)}</li>`;
        }
        html += `</ul></div>`;
      }

      if (failures.length > 0) {
        html += `<div style="margin-top:10px;"><b>Failed:</b><ul style="margin:0 0 0 18px;padding:0;">`;
        for (const f of failures) {
          html += `<li style="color:#f44336;">${this.escapeHtml(f.filename)}<br><span style="font-size:12px;color:#888;">${this.escapeHtml(f.error || '')}</span></li>`;
        }
        html += `</ul></div>`;
      }

      // Set content
      const contentDiv = document.getElementById('summaryContent');
      if (contentDiv) contentDiv.innerHTML = html;

      // Show/hide Retry button
      const retryBtn = document.getElementById('retrySummaryBtn');
      if (retryBtn) retryBtn.style.display = failures.length > 0 ? 'inline-block' : 'none';

      summaryDialog.style.display = 'block';

      // Also update Retry Failed button in panel
      const panelRetryBtn = document.getElementById('retryFailedBtn');
      if (panelRetryBtn) panelRetryBtn.style.display = failures.length > 0 ? 'block' : 'none';
    }

    // Retry failed downloads
    async retryFailedDownloads() {
      if (!this.failedDownloads || this.failedDownloads.length === 0) {
        this.updateStatus('No failed downloads to retry.', 'info');
        return;
      }

      // Hide summary dialog if open
      const summaryDialog = document.getElementById('downloadSummaryDialog');
      if (summaryDialog) summaryDialog.style.display = 'none';

      this.updateStatus('Retrying failed downloads...', 'info', true);

      // Reset error count for this retry batch
      let retriedSuccess = 0;
      let retriedFail = 0;

      // Remove previous failed attempts from downloadAttempts (so we can re-track)
      this.downloadAttempts = this.downloadAttempts.filter(a => a.status !== 'failed');

      for (const { url, filename } of this.failedDownloads) {
        if (!url || !filename) continue;
        const result = await this.downloadFile(url, filename);
        if (result) retriedSuccess++;
        else retriedFail++;
        // Wait between downloads
        await this.delay(this.settings.delayBetweenDownloads);
      }

      // Update failedDownloads for next retry
      this.failedDownloads = this.downloadAttempts.filter(a => a.status === 'failed').map(f => ({ url: f.url, filename: f.filename }));

      this.updateStatus(`Retry complete. Success: ${retriedSuccess}, Failed: ${retriedFail}`, retriedFail === 0 ? 'success' : 'warning', true);

      // Show summary again
      this.showSummaryDialog();
    }

    // Escape HTML for safe display
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }

  // Initialize and expose globally
  const archiveDownloader = new ArchiveDownloader();

  // Expose main functions globally for console use
  window.startDownloader = () => archiveDownloader.startDownloader();
  window.pauseDownloader = () => archiveDownloader.pauseDownloader();
  window.stopDownloader = () => archiveDownloader.stopDownloader();
  window.retryFailedDownloads = () => archiveDownloader.retryFailedDownloads();

  console.log('🐱 Archive Downloader ready! Use the control panel or type startDownloader() to begin');
})();