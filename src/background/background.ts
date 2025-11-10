import { DEFAULT_SETTINGS, Settings, TemporaryUnblock } from "../types";
import { isWithinAnyWindow, nextBoundaryAfter } from "../lib/schedule";

const STORAGE_KEY = "settings";
const TEMP_UNBLOCKS_KEY = "temporaryUnblocks";
const ALARM_KEY = "schedule-boundary";
const CLEANUP_UNBLOCKS_ALARM_KEY = "cleanup-unblocks";
const REROLL_RESET_ALARM_KEY = "reroll-reset";
const REROLL_RESET_TIME_KEY = "rerollResetTime";

// Debug mode - set to true for verbose logging
const DEBUG = true;

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[Productivity Blocker]', ...args);
  }
}

async function getSettings(): Promise<Settings> {
  const { [STORAGE_KEY]: s } = await chrome.storage.sync.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

// Normalize domain for comparison
function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
}

// Check if a URL matches any blocked host
function isBlockedUrl(url: string, blockedHosts: string[]): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = normalizeDomain(urlObj.hostname);
    
    return blockedHosts.some(blockedHost => {
      const blocked = normalizeDomain(blockedHost);
      return hostname === blocked || hostname.endsWith('.' + blocked);
    });
  } catch {
    return false;
  }
}

// Check if a domain is temporarily unblocked
async function isTemporarilyUnblocked(domain: string): Promise<boolean> {
  try {
    const { [TEMP_UNBLOCKS_KEY]: unblocks } = await chrome.storage.local.get(TEMP_UNBLOCKS_KEY);
    if (!unblocks || !Array.isArray(unblocks)) return false;
    
    const normalizedDomain = normalizeDomain(domain);
    const now = Date.now();
    
    // Check if domain is in unblocks and not expired
    return unblocks.some((unblock: TemporaryUnblock) => {
      const unblockDomain = normalizeDomain(unblock.domain);
      return (unblockDomain === normalizedDomain || normalizedDomain.endsWith('.' + unblockDomain)) 
        && unblock.expiresAt > now;
    });
  } catch {
    return false;
  }
}

// Get all active temporary unblocks
async function getActiveUnblocks(): Promise<TemporaryUnblock[]> {
  try {
    const { [TEMP_UNBLOCKS_KEY]: unblocks } = await chrome.storage.local.get(TEMP_UNBLOCKS_KEY);
    if (!unblocks || !Array.isArray(unblocks)) return [];
    
    const now = Date.now();
    return unblocks.filter((unblock: TemporaryUnblock) => unblock.expiresAt > now);
  } catch {
    return [];
  }
}

// Clean up expired unblocks
async function cleanupExpiredUnblocks() {
  try {
    const active = await getActiveUnblocks();
    await chrome.storage.local.set({ [TEMP_UNBLOCKS_KEY]: active });
    debugLog('Cleaned up expired unblocks. Active unblocks:', active.length);
  } catch (error) {
    console.error('Error cleaning up unblocks:', error);
  }
}

// Add a temporary unblock
async function addTemporaryUnblock(domain: string, expiresAt: number) {
  try {
    const active = await getActiveUnblocks();
    const normalizedDomain = normalizeDomain(domain);
    
    // Remove any existing unblock for this domain
    const filtered = active.filter(u => normalizeDomain(u.domain) !== normalizedDomain);
    
    // Add new unblock
    filtered.push({ domain: normalizedDomain, expiresAt });
    
    await chrome.storage.local.set({ [TEMP_UNBLOCKS_KEY]: filtered });
    debugLog('Added temporary unblock:', domain, 'expires at:', new Date(expiresAt).toISOString());
  } catch (error) {
    console.error('Error adding temporary unblock:', error);
  }
}

// Close or redirect tabs that are on blocked sites
async function closeBlockedTabs(blockedHosts: string[]) {
  if (!blockedHosts || blockedHosts.length === 0) return;
  
  try {
    const tabs = await chrome.tabs.query({});
    const tabsToClose: number[] = [];
    
    for (const tab of tabs) {
      if (tab.url && isBlockedUrl(tab.url, blockedHosts)) {
        // Check if this domain is temporarily unblocked
        const isUnblocked = await isTemporarilyUnblocked(tab.url);
        if (!isUnblocked) {
          tabsToClose.push(tab.id!);
          debugLog('Closing blocked tab:', tab.url, 'tabId:', tab.id);
        } else {
          debugLog('Tab not closed - temporarily unblocked:', tab.url);
        }
      }
    }
    
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      debugLog('Closed', tabsToClose.length, 'blocked tab(s)');
    }
  } catch (error) {
    console.error('Error closing blocked tabs:', error);
  }
}

async function setBlockingEnabled(enabled: boolean, hosts: string[]) {
  debugLog('setBlockingEnabled:', { enabled, hostsCount: hosts.length, hosts });
  try {
    if (enabled && hosts.length) {
      // Close any existing tabs on blocked sites
      await closeBlockedTabs(hosts);
      debugLog('Tab closing enabled for hosts:', hosts);
    } else {
      debugLog('Tab closing disabled');
    }
  } catch (error) {
    console.error('Error setting blocking state:', error);
    // Retry once after a short delay
    setTimeout(async () => {
      try {
        if (enabled && hosts.length) {
          await closeBlockedTabs(hosts);
          debugLog('Retry successful: tab closing enabled');
        } else {
          debugLog('Retry successful: tab closing disabled');
        }
      } catch (retryError) {
        console.error('Retry also failed:', retryError);
      }
    }, 100);
  }
}

async function updateBlockingAndAlarm() {
  try {
    const settings = await getSettings();
    const now = new Date();

    const shouldBlock = settings.enabled && isWithinAnyWindow(now, settings.windows);
    debugLog('updateBlockingAndAlarm:', {
      enabled: settings.enabled,
      shouldBlock,
      blockedHosts: settings.blockedHosts,
      windows: settings.windows,
      currentTime: now.toISOString()
    });
    
    await setBlockingEnabled(shouldBlock, settings.blockedHosts);

    // Schedule the next boundary (start or end of a window)
    const next = nextBoundaryAfter(now, settings.windows);
    await chrome.alarms.clear(ALARM_KEY);
    await chrome.alarms.create(ALARM_KEY, { when: next.getTime() });
    debugLog('Next boundary scheduled for:', new Date(next.getTime()).toISOString());
  } catch (error) {
    console.error('Error updating blocking and alarm:', error);
  }
}


// Fired when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  updateBlockingAndAlarm();
  chrome.alarms.create(CLEANUP_UNBLOCKS_ALARM_KEY, { periodInMinutes: 1 });
});

// Fired on startup
chrome.runtime.onStartup.addListener(() => {
  updateBlockingAndAlarm();
  chrome.alarms.create(CLEANUP_UNBLOCKS_ALARM_KEY, { periodInMinutes: 1 });
});

// Fired when alarms trigger
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === ALARM_KEY) {
    updateBlockingAndAlarm();
  } else if (alarm.name === CLEANUP_UNBLOCKS_ALARM_KEY) {
    cleanupExpiredUnblocks();
  } else if (alarm.name === REROLL_RESET_ALARM_KEY) {
    debugLog('Reroll reset timer expired, showing popup');
    await showCardPopupOnTabs();
    // Clear the stored reset time and reroll state
    await chrome.storage.local.remove(REROLL_RESET_TIME_KEY);
    await chrome.storage.local.remove('cardGambleRerollState');
  }
});

// If user changes settings in options UI, react immediately
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[STORAGE_KEY]) {
    updateBlockingAndAlarm();
  }
});

// Monitor tab updates to catch navigations to blocked sites (handles cache issues)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when page is fully loaded
  if (changeInfo.status !== 'complete' || !tab.url) return;
  
  try {
    const settings = await getSettings();
    const shouldBlock = settings.enabled && isWithinAnyWindow(new Date(), settings.windows);
    
    if (shouldBlock && settings.blockedHosts.length > 0) {
      if (isBlockedUrl(tab.url, settings.blockedHosts)) {
        // Check if temporarily unblocked
        const isUnblocked = await isTemporarilyUnblocked(tab.url);
        if (!isUnblocked) {
          debugLog('Blocked site detected in tab update:', tab.url);
          // Close the tab
          try {
            await chrome.tabs.remove(tabId);
            debugLog('Closed blocked tab:', tab.url);
          } catch (error) {
            // Tab might already be closed
            debugLog('Could not close tab (may already be closed):', tab.url);
          }
        } else {
          debugLog('Tab not closed - temporarily unblocked:', tab.url);
        }
      }
    }
  } catch (error) {
    console.error('Error in tab update listener:', error);
  }
});

// Schedule reroll reset alarm
async function scheduleRerollReset(resetTime: number) {
  await chrome.alarms.clear(REROLL_RESET_ALARM_KEY);
  await chrome.storage.local.set({ [REROLL_RESET_TIME_KEY]: resetTime });
  await chrome.alarms.create(REROLL_RESET_ALARM_KEY, { when: resetTime });
  debugLog('Scheduled reroll reset for:', new Date(resetTime).toISOString());
}

// Show card popup on all active tabs
async function showCardPopupOnTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const settings = await getSettings();
    
    if (!settings.blockedHosts || settings.blockedHosts.length === 0) {
      debugLog('No blocked hosts, skipping popup');
      return;
    }

    // Inject content script into all tabs
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/cardPopup.js']
          });
          // Send message to show popup
          await chrome.tabs.sendMessage(tab.id, { action: 'showCardPopup' });
        } catch (error) {
          debugLog('Could not inject script into tab:', tab.url, error);
        }
      }
    }
    debugLog('Card popup shown on all tabs');
  } catch (error) {
    console.error('Error showing card popup:', error);
  }
}

// Clear all temporary unblocks
async function clearAllTemporaryUnblocks() {
  try {
    await chrome.storage.local.remove(TEMP_UNBLOCKS_KEY);
    debugLog('Cleared all temporary unblocks');
  } catch (error) {
    console.error('Error clearing temporary unblocks:', error);
    throw error;
  }
}

// Remove a specific temporary unblock
async function removeTemporaryUnblock(domain: string) {
  try {
    const active = await getActiveUnblocks();
    const normalizedDomain = normalizeDomain(domain);
    
    // Remove the unblock for this domain
    const filtered = active.filter(u => normalizeDomain(u.domain) !== normalizedDomain);
    
    await chrome.storage.local.set({ [TEMP_UNBLOCKS_KEY]: filtered });
    debugLog('Removed temporary unblock:', domain);
  } catch (error) {
    console.error('Error removing temporary unblock:', error);
    throw error;
  }
}

// Handle messages from options page (roulette wheel and card gamble)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'temporaryUnblock') {
    addTemporaryUnblock(message.domain, message.expiresAt).then(() => {
      sendResponse({ success: true });
      debugLog('Temporary unblock added:', message.domain, 'for', message.durationMinutes, 'minutes');
    }).catch(error => {
      console.error('Error handling temporary unblock:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'scheduleRerollReset') {
    scheduleRerollReset(message.resetTime).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error scheduling reroll reset:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'cancelRerollReset') {
    chrome.alarms.clear(REROLL_RESET_ALARM_KEY).then(() => {
      chrome.storage.local.remove(REROLL_RESET_TIME_KEY).then(() => {
        sendResponse({ success: true });
        debugLog('Reroll reset alarm canceled');
      });
    }).catch(error => {
      console.error('Error canceling reroll reset:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'clearTemporaryUnblocks') {
    clearAllTemporaryUnblocks().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error clearing temporary unblocks:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'getActiveUnblocks') {
    getActiveUnblocks().then((unblocks) => {
      sendResponse({ success: true, unblocks });
    }).catch(error => {
      console.error('Error getting active unblocks:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'cancelTemporaryUnblock') {
    removeTemporaryUnblock(message.domain).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error canceling temporary unblock:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// Handle extension icon click - open options page
chrome.action.onClicked.addListener(async () => {
  try {
    await chrome.runtime.openOptionsPage();
    debugLog('Opened options page');
  } catch (error) {
    console.error('Error opening options page:', error);
  }
});


