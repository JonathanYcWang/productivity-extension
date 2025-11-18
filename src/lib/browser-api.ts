// Unified browser API abstraction for Chrome and Safari compatibility
// Supports both chrome.* (Chrome) and browser.* (Safari/WebExtensions standard) APIs

// Declare browser global for Safari compatibility
declare const browser: any;

// Detect browser API
const browserAPI: any = 
  typeof chrome !== 'undefined' && chrome.runtime 
    ? chrome 
    : typeof browser !== 'undefined' && (browser as any).runtime
    ? browser
    : null;

// Helper to convert Chrome-style callbacks to Promises for Safari compatibility
function promisify<T = any>(fn: (...args: any[]) => any): (...args: any[]) => Promise<T> {
  return (...args: any[]) => {
    return new Promise((resolve, reject) => {
      try {
        // Remove callback from args if present
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          args.pop();
        }
        
        // Chrome APIs may return a Promise or use callbacks
        if (fn.length === args.length + 1) {
          // Function expects a callback
          fn(...args, (result: T) => {
            if (browserAPI?.runtime?.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        } else {
          // Function may return a Promise directly
          const result = fn(...args);
          if (result && typeof (result as any).then === 'function') {
            (result as Promise<T>).then(resolve).catch(reject);
          } else {
            resolve(result as T);
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  };
}

// Storage API
export const storage = {
  sync: {
    get: (keys: string | string[] | Record<string, any> | null): Promise<Record<string, any>> => {
      if (!browserAPI?.storage?.sync) {
        return Promise.resolve({});
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.sync.get(keys, (result: Record<string, any>) => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve(result || {});
          }
        });
      });
    },
    set: (items: Record<string, any>): Promise<void> => {
      if (!browserAPI?.storage?.sync) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.sync.set(items, () => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },
    remove: (keys: string | string[]): Promise<void> => {
      if (!browserAPI?.storage?.sync) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.sync.remove(keys, () => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
  },
  local: {
    get: (keys: string | string[] | Record<string, any> | null): Promise<Record<string, any>> => {
      if (!browserAPI?.storage?.local) {
        return Promise.resolve({});
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.get(keys, (result: Record<string, any>) => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve(result || {});
          }
        });
      });
    },
    set: (items: Record<string, any>): Promise<void> => {
      if (!browserAPI?.storage?.local) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.set(items, () => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    },
    remove: (keys: string | string[]): Promise<void> => {
      if (!browserAPI?.storage?.local) {
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.remove(keys, () => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
  },
  onChanged: browserAPI?.storage?.onChanged
};

// Alarms API with fallback for Safari
let alarmFallbackInterval: number | null = null;
const alarmStorageKey = 'alarm_fallbacks';
const alarmCallbacks: Array<(alarm: chrome.alarms.Alarm) => void> = [];

// Initialize alarm fallback checker if alarms API is not available
function initAlarmFallback() {
  if (browserAPI?.alarms) return; // Alarms API is available
  
  if (alarmFallbackInterval !== null) return; // Already initialized
  
  // Check for expired alarms every minute (setInterval is available in service workers)
  alarmFallbackInterval = setInterval(async () => {
    try {
      const { [alarmStorageKey]: alarms } = await storage.local.get(alarmStorageKey);
      if (!alarms || !Array.isArray(alarms)) return;
      
      const now = Date.now();
      const remaining = alarms.filter((alarm: { name: string; when: number }) => alarm.when > now);
      
      // Trigger expired alarms
      const expired = alarms.filter((alarm: { name: string; when: number }) => alarm.when <= now);
      for (const alarm of expired) {
        // Call registered alarm callbacks directly (works in both window and service worker contexts)
        const alarmObj = { name: alarm.name, scheduledTime: alarm.when } as chrome.alarms.Alarm;
        alarmCallbacks.forEach(callback => {
          try {
            callback(alarmObj);
          } catch (error) {
            console.error('Error in alarm callback:', error);
          }
        });
      }
      
      // Update stored alarms
      if (remaining.length !== alarms.length) {
        if (remaining.length === 0) {
          await storage.local.remove(alarmStorageKey);
        } else {
          await storage.local.set({ [alarmStorageKey]: remaining });
        }
      }
    } catch (error) {
      console.error('Error in alarm fallback:', error);
    }
  }, 60000);
}

export const alarms = {
  create: (name: string, alarmInfo: chrome.alarms.AlarmCreateInfo | any): Promise<void> => {
    if (browserAPI?.alarms?.create) {
      return new Promise((resolve, reject) => {
        browserAPI.alarms.create(name, alarmInfo, () => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
    
    // Fallback for Safari: store alarm info and check periodically
    initAlarmFallback();
    return storage.local.get(alarmStorageKey).then((data) => {
      const existing = (data[alarmStorageKey] || []) as Array<{ name: string; when: number }>;
      const filtered = existing.filter(a => a.name !== name);
      const when = alarmInfo.when || (alarmInfo.delayInMinutes ? Date.now() + alarmInfo.delayInMinutes * 60000 : 
                                      alarmInfo.periodInMinutes ? Date.now() + alarmInfo.periodInMinutes * 60000 : Date.now());
      filtered.push({ name, when });
      return storage.local.set({ [alarmStorageKey]: filtered });
    });
  },
  clear: (name?: string): Promise<boolean> => {
    if (browserAPI?.alarms?.clear) {
      return new Promise((resolve, reject) => {
        browserAPI.alarms.clear(name, (wasCleared: boolean) => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve(wasCleared);
          }
        });
      });
    }
    
    // Fallback: remove from stored alarms
    if (name) {
      return storage.local.get(alarmStorageKey).then((data) => {
        const existing = (data[alarmStorageKey] || []) as Array<{ name: string; when: number }>;
        const filtered = existing.filter(a => a.name !== name);
        if (filtered.length === 0) {
          return storage.local.remove(alarmStorageKey).then(() => true);
        }
        return storage.local.set({ [alarmStorageKey]: filtered }).then(() => true);
      });
    }
    return Promise.resolve(true);
  },
  getAll: (): Promise<Array<chrome.alarms.Alarm | any>> => {
    if (browserAPI?.alarms?.getAll) {
      return new Promise((resolve, reject) => {
        browserAPI.alarms.getAll((alarms: any[]) => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve(alarms || []);
          }
        });
      });
    }
    
    // Fallback: return stored alarms
    return storage.local.get(alarmStorageKey).then((data: any) => {
      const alarmsList = (data[alarmStorageKey] || []) as Array<{ name: string; when: number }>;
      return alarmsList.map(a => ({ name: a.name, scheduledTime: a.when })) as Array<chrome.alarms.Alarm>;
    });
  },
  onAlarm: browserAPI?.alarms?.onAlarm || {
    addListener: (callback: (alarm: chrome.alarms.Alarm) => void) => {
      // Fallback: register callback to be called when alarms fire
      alarmCallbacks.push(callback);
      // Also initialize fallback if not already done
      initAlarmFallback();
    }
  }
};

// Tabs API
export const tabs = {
  query: (queryInfo: chrome.tabs.QueryInfo | any): Promise<Array<chrome.tabs.Tab | any>> => {
    if (!browserAPI?.tabs?.query) {
      return Promise.resolve([]);
    }
    return new Promise((resolve, reject) => {
      browserAPI.tabs.query(queryInfo, (tabs: any) => {
        if (browserAPI.runtime?.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message));
        } else {
          resolve(tabs || []);
        }
      });
    });
  },
  remove: (tabIds: number | number[]): Promise<void> => {
    if (!browserAPI?.tabs?.remove) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      browserAPI.tabs.remove(tabIds, () => {
        if (browserAPI.runtime?.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },
  sendMessage: (tabId: number, message: any, options?: chrome.tabs.MessageSendOptions): Promise<any> => {
    if (!browserAPI?.tabs?.sendMessage) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      browserAPI.tabs.sendMessage(tabId, message, options || {}, (response: any) => {
        if (browserAPI.runtime?.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  },
  onUpdated: browserAPI?.tabs?.onUpdated
};

// Runtime API
export const runtime = {
  sendMessage: (message: any): Promise<any> => {
    if (!browserAPI?.runtime?.sendMessage) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      browserAPI.runtime.sendMessage(message, (response: any) => {
        if (browserAPI.runtime?.lastError) {
          // Ignore errors if no listener is registered (common in Safari)
          if (browserAPI.runtime.lastError.message?.includes('Could not establish connection')) {
            resolve(null);
          } else {
            reject(new Error(browserAPI.runtime.lastError.message));
          }
        } else {
          resolve(response);
        }
      });
    });
  },
  onMessage: browserAPI?.runtime?.onMessage,
  onInstalled: browserAPI?.runtime?.onInstalled,
  onStartup: browserAPI?.runtime?.onStartup,
  openOptionsPage: (): Promise<void> => {
    if (!browserAPI?.runtime?.openOptionsPage) {
      // Fallback: open options page manually
      if (typeof window !== 'undefined') {
        window.open(browserAPI?.runtime?.getURL?.('options/index.html') || 'options/index.html', '_blank');
      }
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      browserAPI.runtime.openOptionsPage(() => {
        if (browserAPI.runtime?.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },
  getURL: (path: string): string => {
    if (!browserAPI?.runtime?.getURL) {
      return path;
    }
    return browserAPI.runtime.getURL(path);
  }
};

// Scripting API (for content script injection)
export const scripting = {
  executeScript: (details: any): Promise<Array<chrome.scripting.InjectionResult | any>> => {
    if (browserAPI?.scripting?.executeScript) {
      // Chrome MV3 / Safari with scripting API
      return new Promise((resolve, reject) => {
        (browserAPI.scripting.executeScript as any)(details, (results: any[]) => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve(results || []);
          }
        });
      });
    }
    
    // Fallback: Safari may use tabs.executeScript (deprecated but may work)
    if ((browserAPI?.tabs as any)?.executeScript) {
      return new Promise((resolve, reject) => {
        (browserAPI.tabs as any).executeScript(details.target?.tabId, details.files ? { file: details.files[0] } : details, (results: any) => {
          if (browserAPI.runtime?.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
          } else {
            resolve(results || []);
          }
        });
      });
    }
    
    console.warn('Scripting API not available, content script injection may not work');
    return Promise.resolve([]);
  }
};

// Action API (Chrome MV3) / BrowserAction API (Chrome MV2/Safari)
export const action = {
  onClicked: browserAPI?.action?.onClicked || (browserAPI as any)?.browserAction?.onClicked || null,
  // Direct access for fallback
  _raw: browserAPI?.action || (browserAPI as any)?.browserAction || null
};

// Initialize alarm fallback if needed (for background/service worker context)
if (typeof window === 'undefined' || typeof chrome !== 'undefined' || typeof browser !== 'undefined') {
  initAlarmFallback();
}

