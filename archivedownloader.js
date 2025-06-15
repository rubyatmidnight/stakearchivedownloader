// ==UserScript==
// @name         Stake Game Archive Downloader
// @namespace    https://stakestats.net
// @version      2.0
// @description  Download and rename the Stake.com gameplay archives from all mirrors and stake.us
// @author       Ruby, courtesy of SealStats
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

(function () {
  'use strict';

  class ArchiveDownloader {
    constructor() {
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
        preferredDomain: 'stake.us'
      };
      this.downloadAttempts = [];
      this.failedDownloads = [];
      if (typeof window !== 'undefined' && window.location) {
        this.settings.preferredDomain = this.getCurrentDomain();
      }
      this.loadSettings();
      if (typeof document !== 'undefined') {
        this.initUI();
      }
    }

    getCurrentDomain() {
      try {
        const currentDomain = window.location.hostname;
        const mirrorDomains = this.getMirrorDomains();
        for (const domain of mirrorDomains) {
          if (currentDomain === domain || currentDomain.endsWith('.' + domain)) {
            return domain;
          }
        }
        return mirrorDomains[0];
      } catch (error) {
        this.logError('Error detecting current domain', error);
        return this.settings.preferredDomain || 'stake.us';
      }
    }

    loadSettings() {
      if (typeof GM_getValue === 'function') {
        const saved = GM_getValue('archiveDownloaderSettings');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            this.settings = Object.assign({}, this.settings, parsed);
          } catch (e) {}
        }
      }
    }

    saveSettings() {
      const getVal = (id, prop = 'value') => {
        const el = document.getElementById(id);
        return el && prop in el ? el[prop] : undefined;
      };
      const downloadDelay = parseInt(getVal('downloadDelay'), 10);
      const pageDelay = parseInt(getVal('pageDelay'), 10);
      const filePrefix = getVal('filePrefix') || 'archive';
      const preferredDomain = getVal('preferredDomain') || this.settings.preferredDomain;
      const showNotifications = !!getVal('showNotifications', 'checked');
      this.settings.delayBetweenDownloads = isNaN(downloadDelay) ? 1000 : downloadDelay;
      this.settings.delayBetweenPages = isNaN(pageDelay) ? 2000 : pageDelay;
      this.settings.fileNamePrefix = filePrefix;
      this.settings.preferredDomain = preferredDomain;
      this.settings.showNotifications = showNotifications;
      if (typeof GM_setValue === 'function') {
        GM_setValue('archiveDownloaderSettings', JSON.stringify(this.settings));
      }
      this.updateStatus('Settings saved!', 'success', true);
      this.toggleSettings();
    }

    initUI() {
      this.createFloatyPanel();
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          this.toggleDownloader();
          e.preventDefault();
        }
      });
      // eslint-disable-next-line no-console
      console.log('🐱 Archive Downloader initialized! Use the floating panel or type startDownloader()');
    }

    createFloatyPanel() {
      if (document.getElementById('stakepet-archive-floaty')) return;
      const container = document.createElement('div');
      container.id = 'stakepet-archive-floaty';
      Object.assign(container.style, {
        background: 'rgba(35,35,35,0.98)',
        border: '1px solid #444',
        padding: '12px 18px 12px 18px',
        borderRadius: '10px',
        boxShadow: '0 4px 24px 0 rgba(0,0,0,0.28)',
        fontFamily: 'inherit',
        fontSize: '13px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '10px',
        userSelect: 'none',
        position: 'fixed',
        top: '32px',
        right: '32px',
        zIndex: '999999',
        minWidth: '270px',
        maxWidth: '350px',
        cursor: 'grab',
        transition: 'box-shadow 0.2s'
      });

      // Close button
      const closeBtn = document.createElement('span');
      closeBtn.textContent = '×';
      Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '6px',
        right: '10px',
        cursor: 'pointer',
        fontSize: '18px',
        color: '#aaa',
        fontWeight: 'bold',
        zIndex: '1000010'
      });
      closeBtn.title = 'Close';
      closeBtn.onclick = () => container.remove();
      container.appendChild(closeBtn);

      // Header
      const header = document.createElement('div');
      header.textContent = 'Archive Downloader';
      Object.assign(header.style, {
        fontWeight: 'bold',
        fontSize: '16px',
        color: '#f8b',
        marginBottom: '2px',
        marginTop: '2px'
      });
      container.appendChild(header);

      // Status
      const statusDiv = document.createElement('div');
      statusDiv.id = 'downloadStatus';
      Object.assign(statusDiv.style, {
        margin: '4px 0',
        fontSize: '14px',
        fontWeight: 'bold'
      });
      statusDiv.textContent = 'Ready to download';
      container.appendChild(statusDiv);

      // Progress
      const progressDiv = document.createElement('div');
      progressDiv.id = 'downloadProgress';
      Object.assign(progressDiv.style, {
        margin: '4px 0',
        fontSize: '12px'
      });
      container.appendChild(progressDiv);

      // Controls
      const controls = document.createElement('div');
      Object.assign(controls.style, {
        display: 'flex',
        gap: '8px',
        marginTop: '6px'
      });
      controls.appendChild(this.createButton('Start', '#4caf50', () => this.startDownloader()));
      controls.appendChild(this.createButton('Pause', '#ff9800', () => this.pauseDownloader()));
      controls.appendChild(this.createButton('Stop', '#f44336', () => this.stopDownloader()));
      controls.appendChild(this.createButton('⚙️', '#2196f3', () => this.toggleSettings()));
      controls.appendChild(this.createButton('Help', '#9c27b0', () => this.showHelpDialog()));
      container.appendChild(controls);

      // Retry Failed button
      const retryBtn = this.createButton('Retry Failed', '#e91e63', () => this.retryFailedDownloads());
      retryBtn.id = 'retryFailedBtn';
      retryBtn.style.display = 'none';
      retryBtn.style.marginTop = '8px';
      container.appendChild(retryBtn);

      // Settings panel
      const settingsPanel = document.createElement('div');
      settingsPanel.id = 'downloaderSettings';
      Object.assign(settingsPanel.style, {
        marginTop: '10px',
        display: 'none',
        fontSize: '12px',
        width: '100%'
      });
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
      settingsPanel.appendChild(this.createButton('Save Settings', '#2196f3', () => this.saveSettings()));
      container.appendChild(settingsPanel);

      // Summary dialog (floaty style)
      const summaryDialog = document.createElement('div');
      summaryDialog.id = 'downloadSummaryDialog';
      Object.assign(summaryDialog.style, {
        display: 'none',
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#232323',
        border: '2px solid #2196f3',
        borderRadius: '10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
        zIndex: '10000',
        minWidth: '320px',
        maxWidth: '90vw',
        padding: '24px 18px 18px 18px',
        fontSize: '15px',
        color: '#fff'
      });
      summaryDialog.innerHTML = `
        <div id="summaryContent"></div>
        <div style="margin-top: 18px; text-align: right;">
          <button id="closeSummaryBtn" style="background:#2196f3;color:#fff;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-size:15px;">Close</button>
          <button id="retrySummaryBtn" style="background:#e91e63;color:#fff;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-size:15px;display:none;margin-left:8px;">Retry Failed</button>
        </div>
      `;
      document.body.appendChild(summaryDialog);

      // Drag handle
      const dragHandle = document.createElement('div');
      Object.assign(dragHandle.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '18px',
        cursor: 'grab',
        background: 'linear-gradient(90deg, #222 0%, #333 100%)',
        borderTopLeftRadius: '10px',
        borderTopRightRadius: '10px',
        opacity: '0.18'
      });
      dragHandle.title = 'Drag to move';
      container.appendChild(dragHandle);

      document.body.appendChild(container);

      // Drag logic
      let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
      container.addEventListener('mousedown', function (e) {
        if (
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'BUTTON' ||
          e.target === closeBtn
        ) return;
        isDragging = true;
        container.style.cursor = 'grabbing';
        dragOffsetX = e.clientX - container.getBoundingClientRect().left;
        dragOffsetY = e.clientY - container.getBoundingClientRect().top;
        container.style.boxShadow = '0 8px 32px 0 rgba(0,0,0,0.38)';
        e.preventDefault();
      });
      document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        let newLeft = e.clientX - dragOffsetX;
        let newTop = e.clientY - dragOffsetY;
        newLeft = Math.max(0, Math.min(window.innerWidth - container.offsetWidth, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - container.offsetHeight, newTop));
        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';
        container.style.right = 'auto';
      });
      document.addEventListener('mouseup', function () {
        if (isDragging) {
          isDragging = false;
          container.style.cursor = 'grab';
          container.style.boxShadow = '0 4px 24px 0 rgba(0,0,0,0.28)';
        }
      });

      // Summary dialog handlers
      const closeSummaryBtn = document.getElementById('closeSummaryBtn');
      if (closeSummaryBtn) {
        closeSummaryBtn.onclick = () => {
          summaryDialog.style.display = 'none';
        };
      }
      const retrySummaryBtn = document.getElementById('retrySummaryBtn');
      if (retrySummaryBtn) {
        retrySummaryBtn.onclick = () => {
          summaryDialog.style.display = 'none';
          this.retryFailedDownloads();
        };
      }
    }

    createButton(text, color, onClick) {
      const button = document.createElement('button');
      button.textContent = text;
      Object.assign(button.style, {
        backgroundColor: color,
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'opacity 0.2s'
      });
      button.addEventListener('click', onClick);
      button.addEventListener('mouseenter', () => button.style.opacity = '0.8');
      button.addEventListener('mouseleave', () => button.style.opacity = '1');
      return button;
    }

    toggleSettings() {
      const settingsPanel = document.getElementById('downloaderSettings');
      if (settingsPanel) {
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
      }
    }

    getMirrorDomains() {
      return [
        'stake.us', 'stake.com', 'stake.ac', 'stake.games', 'stake.bet', 'stake.pet',
        'stake1001.com', 'stake1002.com', 'stake1003.com', 'stake1021.com', 'stake1022.com',
        'stake.mba', 'stake.jp', 'stake.bz', 'staketr.com', 'stake.ceo', 'stake.krd'
      ];
    }

    maskUrl(url) {
      try {
        if (!url || typeof url !== 'string') return url;
        const urlObj = new URL(url);
        const domains = this.getMirrorDomains();
        const currentDomain = window.location.hostname;
        const isDifferentDomain = domains.some(domain =>
          urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
        if (isDifferentDomain && urlObj.hostname !== currentDomain) {
          const newUrl = new URL(url);
          newUrl.hostname = currentDomain;
          this.updateStatus(`Switched domain from ${urlObj.hostname} to ${currentDomain}`, 'info');
          return newUrl.toString();
        }
        return url;
      } catch (error) {
        this.logError('Error masking URL', error);
        return url;
      }
    }

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

    async downloadFile(url, filename, retryCount = 0) {
      try {
        url = this.maskUrl(url);
        if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
          throw new Error('Invalid URL: Must be HTTPS');
        }
        if (!filename || typeof filename !== 'string') {
          throw new Error('Invalid filename');
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          mode: 'cors'
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.style.display = 'none';
        a.setAttribute('referrerpolicy', 'no-referrer');
        document.body.appendChild(a);
        if (typeof a.click === 'function') a.click();
        else {
          const evt = document.createEvent('MouseEvents');
          evt.initEvent('click', true, true);
          a.dispatchEvent(evt);
        }
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 100);
        this.downloadCount++;
        this.updateStatus(`Downloaded: ${filename}`, 'success');
        this.downloadAttempts.push({ url, filename, status: 'success' });
        return true;
      } catch (error) {
        this.logError(`Failed to download ${filename}`, error);
        if (retryCount < this.settings.maxRetries && this.isDownloading) {
          this.updateStatus(`Retrying download: ${filename} (${retryCount + 1}/${this.settings.maxRetries})`, 'warning');
          await this.delay(1000);
          return this.downloadFile(url, filename, retryCount + 1);
        } else {
          this.errorCount++;
          this.downloadAttempts.push({ url, filename, status: 'failed', error: error && error.message ? error.message : String(error) });
          return false;
        }
      }
    }

    async processCurrentPage() {
      try {
        const table = document.querySelector('.table-content');
        if (!table) {
          this.updateStatus('Archive table not found on current page', 'warning');
          return 0;
        }
        const tbody = table.querySelector('tbody');
        if (!tbody) {
          this.updateStatus('Table body not found', 'warning');
          return 0;
        }
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (!rows.length) {
          this.updateStatus('No archive rows found on current page', 'warning');
          return 0;
        }
        let filesProcessed = 0;
        for (const row of rows) {
          if (!this.isDownloading) break;
          if (this.pauseRequested) {
            this.updateStatus('Download paused. Click Start to resume.', 'info');
            this.isDownloading = false;
            this.pauseRequested = false;
            break;
          }
          const tds = row.querySelectorAll('td');
          if (tds.length < 3) continue;
          const dateString = (tds[0].textContent || '').trim();
          const linkElement = tds[2].querySelector('a[href*="/_api/archive/"]');
          if (!dateString || !linkElement) continue;
          const url = linkElement.href;
          const formattedDate = this.formatDateForFilename(dateString);
          const filename = `${this.settings.fileNamePrefix}_${formattedDate}.json`;
          this.updateStatus(`Downloading: ${filename}`, 'info');
          await this.downloadFile(url, filename);
          filesProcessed++;
          if (this.isDownloading) await this.delay(this.settings.delayBetweenDownloads);
        }
        return filesProcessed;
      } catch (error) {
        this.logError('Error processing page', error);
        return 0;
      }
    }

    gotoNextPage() {
      try {
        const nextButton = document.querySelector('a[data-test="pagination-next"], a[data-testid="pagination-next"]');
        if (nextButton && !nextButton.hasAttribute('disabled') && !nextButton.classList.contains('disabled')) {
          if (typeof nextButton.click === 'function') {
            nextButton.click();
          } else {
            // Use modern Event constructor instead of deprecated createEvent/initEvent
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
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

    async runDownloader() {
      this.pageCount = 1;
      this.downloadAttempts = [];
      try {
        while (this.isDownloading) {
          this.updateStatus(`Processing page ${this.pageCount}`, 'info');
          await this.delay(500);
          await this.processCurrentPage();
          if (!this.isDownloading) break;
          const hasNextPage = this.gotoNextPage();
          if (!hasNextPage) {
            this.updateStatus('Reached the last page. Download complete!', 'success');
            break;
          }
          this.pageCount++;
          await this.delay(this.settings.delayBetweenPages);
        }
      } catch (error) {
        this.logError('Download process error', error);
      } finally {
        if (this.isDownloading) {
          this.isDownloading = false;
          this.updateStatus('Download complete!', 'success', true);
        }
        this.showSummaryDialog();
      }
    }

    startDownloader() {
      if (!this.isDownloading) {
        this.isDownloading = true;
        this.pauseRequested = false;
        if (this.pageCount === 0) {
          this.downloadCount = 0;
          this.errorCount = 0;
        }
        this.downloadAttempts = [];
        this.failedDownloads = [];
        const summaryDialog = document.getElementById('downloadSummaryDialog');
        if (summaryDialog) summaryDialog.style.display = 'none';
        this.updateStatus('Starting downloader...', 'info', true);
        this.runDownloader().catch(error => this.logError('An error occurred', error));
      } else {
        this.updateStatus('Downloader is already running.', 'warning');
      }
    }

    pauseDownloader() {
      if (this.isDownloading) {
        this.pauseRequested = true;
        this.updateStatus('Pausing after current download...', 'info');
      } else {
        this.updateStatus('Downloader is not running.', 'warning');
      }
    }

    stopDownloader() {
      if (this.isDownloading) {
        this.isDownloading = false;
        this.pauseRequested = false;
        this.updateStatus('Downloader stopped.', 'warning', true);
      } else {
        this.updateStatus('Downloader is not running.', 'warning');
      }
    }

    toggleDownloader() {
      if (this.isDownloading) this.stopDownloader();
      else this.startDownloader();
    }

    updateStatus(message, type = 'info', showNotification = false) {
      // eslint-disable-next-line no-console
      console.log(`[Archive Downloader] ${message}`);
      const statusElement = document.getElementById('downloadStatus');
      if (statusElement) {
        statusElement.textContent = message;
        const colors = {
          info: '#2196f3',
          success: '#4caf50',
          warning: '#ff9800',
          error: '#f44336'
        };
        statusElement.style.color = colors[type] || colors.info;
      }
      this.updateProgressDisplay();
      if (showNotification && this.settings.showNotifications) {
        this.showNotification('Archive Downloader', message);
      }
    }

    updateProgressDisplay() {
      const progressDiv = document.getElementById('downloadProgress');
      if (progressDiv) {
        progressDiv.innerHTML = `
          Pages: ${this.pageCount} |
          Downloaded: ${this.downloadCount} files |
          Errors: ${this.errorCount}
        `;
      }
      const retryBtn = document.getElementById('retryFailedBtn');
      if (retryBtn) {
        const hasFailed = this.downloadAttempts && this.downloadAttempts.some(a => a.status === 'failed');
        retryBtn.style.display = hasFailed ? 'block' : 'none';
      }
    }

    showNotification(title, message) {
      try {
        if (typeof GM_notification === 'function') {
          GM_notification({ title, text: message, timeout: 4000 });
        } else if (typeof Notification !== 'undefined' && 'permission' in Notification) {
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
        // eslint-disable-next-line no-console
        console.error('Notification error:', error);
      }
    }

    logError(message, error) {
      // eslint-disable-next-line no-console
      console.error(`[Archive Downloader] ${message}:`, error);
      this.updateStatus(`Error: ${message} - ${error && error.message ? error.message : 'Unknown error'}`, 'error');
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    showSummaryDialog() {
      const summaryDialog = document.getElementById('downloadSummaryDialog');
      if (!summaryDialog) return;
      const attempts = this.downloadAttempts || [];
      const successes = attempts.filter(a => a.status === 'success');
      const failures = attempts.filter(a => a.status === 'failed');
      this.failedDownloads = failures.map(f => ({ url: f.url, filename: f.filename }));
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
      const contentDiv = document.getElementById('summaryContent');
      if (contentDiv) contentDiv.innerHTML = html;
      const retryBtn = document.getElementById('retrySummaryBtn');
      if (retryBtn) retryBtn.style.display = failures.length > 0 ? 'inline-block' : 'none';
      summaryDialog.style.display = 'block';
      const panelRetryBtn = document.getElementById('retryFailedBtn');
      if (panelRetryBtn) panelRetryBtn.style.display = failures.length > 0 ? 'block' : 'none';
    }

    async retryFailedDownloads() {
      if (!this.failedDownloads || this.failedDownloads.length === 0) {
        this.updateStatus('No failed downloads to retry.', 'info');
        return;
      }
      const summaryDialog = document.getElementById('downloadSummaryDialog');
      if (summaryDialog) summaryDialog.style.display = 'none';
      this.updateStatus('Retrying failed downloads...', 'info', true);
      let retriedSuccess = 0, retriedFail = 0;
      this.downloadAttempts = this.downloadAttempts.filter(a => a.status !== 'failed');
      for (const { url, filename } of this.failedDownloads) {
        if (!url || !filename) continue;
        const result = await this.downloadFile(url, filename);
        if (result) retriedSuccess++;
        else retriedFail++;
        await this.delay(this.settings.delayBetweenDownloads);
      }
      this.failedDownloads = this.downloadAttempts.filter(a => a.status === 'failed').map(f => ({ url: f.url, filename: f.filename }));
      this.updateStatus(`Retry complete. Success: ${retriedSuccess}, Failed: ${retriedFail}`, retriedFail === 0 ? 'success' : 'warning', true);
      this.showSummaryDialog();
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    showHelpDialog() {
      const helpHtml = `
      <div style="font-size:17px;font-weight:bold;margin-bottom:8px;">Archive Downloader Help</div>
      <div>
        <b>How to use:</b>
        <ul style="margin:0 0 0 18px;padding:0;">
          <li>Start on the first page of your archives page, in the Stake transactions menus.</li>
          <li>Click <b>Start</b> to begin downloading.</li>
          <li>This MAY NOT work on a VPN!! If you get http gateway errors, your VPN is not compatible. Can't bypass currently. It works fine w/o VPN.</li>
          <li>Click <b>Pause</b> to pause after the current file while keeping your place.</li>
          <li>Click <b>Stop</b> to cancel the download process and start over.</li>
          <li>Click <b>Retry Failed</b> to retry any failed downloads.</li>
          <li>Use <b>Settings</b> (⚙️) to adjust delays, file prefix, and plugin notifications.</li>
          <li>This script cannot change your browser settings. Please change notification popups from your browser downloads in your browser's settings.</li>
          <li>Press <b>Ctrl+Shift+D</b> to toggle the downloader panel, or click the tiny 'x'.</li>
        </ul>
        <div style="margin-top:10px;">
          For more help, visit <a href="https://github.com/rubyatmidnight/stakearchivedownloader/issues" target="_blank" style="color:#2196f3;">GitHub Issues</a> or email <b>ruby@stakestats.net</b>
        </div>
      </div>
      `;
      const summaryDialog = document.getElementById('downloadSummaryDialog');
      if (summaryDialog) {
        const contentDiv = document.getElementById('summaryContent');
        if (contentDiv) contentDiv.innerHTML = helpHtml;
        const retryBtn = document.getElementById('retrySummaryBtn');
        if (retryBtn) retryBtn.style.display = 'none';
        summaryDialog.style.display = 'block';
      } else {
        alert('Help: Use Start/Pause/Stop to control downloads. Settings for options. Ctrl+Shift+D toggles panel.');
      }
    }
  }

  // Initialize and expose globally
  const archiveDownloader = new ArchiveDownloader();
  window.startDownloader = () => archiveDownloader.startDownloader();
  window.pauseDownloader = () => archiveDownloader.pauseDownloader();
  window.stopDownloader = () => archiveDownloader.stopDownloader();
  window.retryFailedDownloads = () => archiveDownloader.retryFailedDownloads();

  console.log('🐱 Archive Downloader ready! Use the floating panel or type startDownloader() to begin');
  console.log('🐱 To report issues or contact the author, email ruby@stakestats.net');
})();