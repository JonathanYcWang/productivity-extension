# Safari Extension Porting Guide

This document outlines the changes needed to port this Chrome extension to Safari.

## Major Differences

### 1. **Manifest Format**
Safari uses a different manifest structure:
- **Chrome**: Single `manifest.json` file (Manifest V3)
- **Safari**: Requires `Info.plist` + `extension.json` (or uses Xcode's conversion tool)

**Solution**: Use Xcode's "Convert Existing Web Extension" feature, or manually create Safari manifest files.

### 2. **API Namespace**
- **Chrome**: Uses `chrome.*` APIs
- **Safari**: Uses `browser.*` APIs (WebExtensions standard) or `safari.extension.*` (legacy)

**Solution**: Create a polyfill or abstraction layer to support both.

### 3. **Background Scripts**
- **Chrome**: Service workers (Manifest V3)
- **Safari**: Background pages or event pages (different lifecycle)

**Solution**: May need to adjust background script implementation.

### 4. **Unsupported APIs**

#### `declarativeNetRequest` - NOT SUPPORTED
- **Current Usage**: Listed in manifest but not actively used in code
- **Impact**: Low - extension uses tab closing instead
- **Action**: Remove from manifest (already not used in code)

#### `alarms` API - PARTIALLY SUPPORTED
- **Safari**: Limited support, may need alternatives
- **Current Usage**: Used for scheduling blocking windows and cleanup
- **Action**: May need to use `setTimeout`/`setInterval` as fallback

#### `scripting.executeScript` - DIFFERENT API
- **Safari**: Uses different API for script injection
- **Current Usage**: Used in `background.ts` to inject card popup
- **Action**: Need Safari-specific implementation

### 5. **Storage APIs**
- **Chrome**: `chrome.storage.sync` and `chrome.storage.local`
- **Safari**: Similar but may have quota differences
- **Action**: Should work with minimal changes (test thoroughly)

## Required Code Changes

### 1. Create Browser API Abstraction Layer

Create `src/lib/browser-api.ts`:

```typescript
// Unified browser API abstraction
const browserAPI = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

export const storage = {
  sync: {
    get: (keys: string | string[]) => browserAPI?.storage?.sync?.get(keys) || Promise.resolve({}),
    set: (items: Record<string, any>) => browserAPI?.storage?.sync?.set(items) || Promise.resolve(),
    remove: (keys: string | string[]) => browserAPI?.storage?.sync?.remove(keys) || Promise.resolve()
  },
  local: {
    get: (keys: string | string[]) => browserAPI?.storage?.local?.get(keys) || Promise.resolve({}),
    set: (items: Record<string, any>) => browserAPI?.storage?.local?.set(items) || Promise.resolve(),
    remove: (keys: string | string[]) => browserAPI?.storage?.local?.remove(keys) || Promise.resolve()
  },
  onChanged: browserAPI?.storage?.onChanged
};

export const alarms = {
  create: (name: string, alarmInfo: any) => {
    if (browserAPI?.alarms?.create) {
      return browserAPI.alarms.create(name, alarmInfo);
    }
    // Fallback for Safari: use setTimeout/Date-based scheduling
    // Store alarm info in storage and check periodically
    console.warn('Alarms API not available, using fallback');
    return Promise.resolve();
  },
  clear: (name?: string) => browserAPI?.alarms?.clear?.(name) || Promise.resolve(),
  onAlarm: browserAPI?.alarms?.onAlarm,
  getAll: () => browserAPI?.alarms?.getAll?.() || Promise.resolve([])
};

export const tabs = {
  query: (queryInfo: any) => browserAPI?.tabs?.query?.(queryInfo) || Promise.resolve([]),
  remove: (tabIds: number | number[]) => browserAPI?.tabs?.remove?.(tabIds) || Promise.resolve(),
  onUpdated: browserAPI?.tabs?.onUpdated
};

export const runtime = {
  sendMessage: (message: any) => browserAPI?.runtime?.sendMessage?.(message) || Promise.resolve(),
  onMessage: browserAPI?.runtime?.onMessage,
  onInstalled: browserAPI?.runtime?.onInstalled,
  onStartup: browserAPI?.runtime?.onStartup,
  openOptionsPage: () => browserAPI?.runtime?.openOptionsPage?.() || Promise.resolve(),
  getURL: (path: string) => browserAPI?.runtime?.getURL?.(path) || path
};

export const scripting = {
  executeScript: (details: any) => {
    if (browserAPI?.scripting?.executeScript) {
      return browserAPI.scripting.executeScript(details);
    }
    // Safari fallback: may need different approach
    console.warn('Scripting API not available');
    return Promise.resolve([]);
  }
};

export const action = {
  onClicked: browserAPI?.action?.onClicked || browserAPI?.browserAction?.onClicked
};
```

### 2. Update All Chrome API Calls

Replace all `chrome.*` calls with the abstraction layer:

**In `src/background/background.ts`:**
```typescript
// Replace:
import { DEFAULT_SETTINGS, Settings, TemporaryUnblock } from "../types";
// With:
import { DEFAULT_SETTINGS, Settings, TemporaryUnblock } from "../types";
import { storage, alarms, tabs, runtime, scripting, action } from "../lib/browser-api";

// Replace all chrome.storage.sync with storage.sync
// Replace all chrome.storage.local with storage.local
// Replace all chrome.alarms with alarms
// Replace all chrome.tabs with tabs
// Replace all chrome.runtime with runtime
// Replace all chrome.scripting with scripting
// Replace all chrome.action with action
```

**In `src/components/CardGamble.tsx`:**
```typescript
import { storage, runtime } from "../lib/browser-api";
// Replace chrome.storage.local with storage.local
// Replace chrome.runtime.sendMessage with runtime.sendMessage
```

**In `src/options/App.tsx`:**
```typescript
import { storage, runtime } from "../lib/browser-api";
// Replace chrome.storage.sync with storage.sync
// Replace chrome.runtime.sendMessage with runtime.sendMessage
```

**In `src/content/cardPopup.ts`:**
```typescript
import { runtime } from "../lib/browser-api";
// Replace chrome.runtime with runtime
```

### 3. Handle Alarms API Fallback

Since Safari may not fully support alarms, add a fallback mechanism:

**In `src/background/background.ts`:**
```typescript
// Add alarm fallback using storage + periodic checks
async function scheduleAlarmFallback(name: string, when: number) {
  await storage.local.set({ [`alarm_${name}`]: when });
  // Check alarms every minute
  setInterval(async () => {
    const now = Date.now();
    const alarmData = await storage.local.get([`alarm_${name}`]);
    if (alarmData[`alarm_${name}`] && alarmData[`alarm_${name}`] <= now) {
      // Trigger alarm
      await storage.local.remove(`alarm_${name}`);
      // Handle alarm event
    }
  }, 60000);
}
```

### 4. Update Manifest for Safari

Create `safari-manifest.json` or use Xcode conversion:

```json
{
  "manifest_version": 2,
  "name": "Productivity Blocker",
  "version": "0.1.0",
  "description": "Block distracting sites during scheduled times.",
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "<all_urls>"
  ],
  "background": {
    "scripts": ["background/background.js"],
    "persistent": false
  },
  "browser_action": {
    "default_title": "Productivity Blocker"
  },
  "options_page": "options/index.html",
  "web_accessible_resources": [
    "cardPopup/index.html"
  ]
}
```

### 5. Scripting API Alternative

For Safari, script injection may need different approach:

```typescript
// In browser-api.ts, enhance scripting.executeScript:
export const scripting = {
  executeScript: async (details: any) => {
    if (browserAPI?.scripting?.executeScript) {
      return browserAPI.scripting.executeScript(details);
    }
    // Safari fallback: may need to use content script messaging
    // or different injection method
    if (typeof safari !== 'undefined' && safari.extension) {
      // Safari-specific implementation
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }
};
```

## Build Process Changes

### Option 1: Use Xcode (Recommended)
1. Open Xcode
2. File → New → Project → Safari Extension
3. Use "Convert Existing Web Extension"
4. Point to your `dist` folder
5. Xcode will create the necessary Safari extension structure

### Option 2: Manual Conversion
1. Create `Info.plist` file
2. Create `extension.json` (Safari manifest)
3. Adjust build output structure
4. Package as `.safariextz` (requires Apple Developer account for distribution)

## Testing Checklist

- [ ] Storage operations (sync and local)
- [ ] Tab closing/blocking functionality
- [ ] Alarms/scheduling (or fallback mechanism)
- [ ] Content script injection
- [ ] Options page functionality
- [ ] Card gamble popup injection
- [ ] Background script lifecycle
- [ ] Message passing between components
- [ ] Temporary unblock functionality
- [ ] Time window scheduling

## Known Limitations

1. **No declarativeNetRequest**: Extension already uses tab closing, so this is fine
2. **Alarms API**: May need fallback implementation
3. **Scripting API**: May need Safari-specific approach
4. **Distribution**: Requires Apple Developer account ($99/year) for App Store distribution
5. **Review Process**: Safari extensions go through Apple's review process

## Additional Resources

- [Safari Web Extensions Documentation](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Converting a Web Extension for Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari)
- [WebExtensions API Support in Safari](https://developer.apple.com/documentation/safariservices/safari-web-extensions/webextensions-api-support-in-safari)

## Quick Start for Safari Port

1. **Create browser API abstraction** (see above)
2. **Replace all `chrome.*` calls** with abstraction layer
3. **Test with Safari's Web Extension converter** in Xcode
4. **Test thoroughly** - Safari has different behavior than Chrome
5. **Handle API differences** - especially alarms and scripting

## Estimated Effort

- **Browser API abstraction**: 2-3 hours
- **Code refactoring**: 4-6 hours  
- **Safari-specific fixes**: 4-8 hours
- **Testing and debugging**: 6-10 hours
- **Total**: ~16-27 hours of development time

