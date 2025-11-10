# Debugging Guide for Productivity Blocker Extension

## Quick Start

1. **Build the extension:**
   ```bash
   npm run build
   ```

2. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## Debugging Locations

### 1. Background Service Worker (Main Logic)

**Where to find:**
- Go to `chrome://extensions/`
- Find "Productivity Blocker"
- Click "service worker" link (or "Inspect views: service worker")

**What you'll see:**
- Console logs with `[Productivity Blocker]` prefix
- All rule application logs
- Schedule boundary updates
- Error messages

**Key logs to watch:**
- `updateBlockingAndAlarm:` - Shows current state and settings
- `setBlockingEnabled:` - Shows when blocking is enabled/disabled
- `verifyRules check:` - Periodic rule verification
- `Rule verification:` - Shows which rules exist/missing

### 2. Popup Console

**Where to find:**
- Right-click the extension icon → "Inspect popup"
- Or: `chrome://extensions/` → "Inspect views: popup"

**What you'll see:**
- React component logs
- UI interaction logs

### 3. Options Page Console

**Where to find:**
- Right-click on the options page → "Inspect"
- Or: `chrome://extensions/` → "Inspect views: options"

**What you'll see:**
- Settings UI logs
- Storage operations

## Debugging Commands

### Check Current Rules

In the service worker console, run:
```javascript
chrome.declarativeNetRequest.getDynamicRules().then(rules => {
  console.log('Current rules:', rules);
  console.log('Rule count:', rules.length);
});
```

### Check Current Settings

```javascript
chrome.storage.sync.get('settings').then(result => {
  console.log('Settings:', result.settings);
});
```

### Check Alarms

```javascript
chrome.alarms.getAll().then(alarms => {
  console.log('Active alarms:', alarms);
});
```

### Manually Trigger Update

```javascript
// This will re-check and update blocking state
chrome.runtime.sendMessage({action: 'update'});
```

Or in service worker console, you can call:
```javascript
updateBlockingAndAlarm();
```

### Check if Currently in Block Window

```javascript
// Get current time
const now = new Date();
console.log('Current time:', now.toISOString());
console.log('Day of week:', now.getDay()); // 0=Sunday, 6=Saturday

// Get settings and check
chrome.storage.sync.get('settings').then(result => {
  const settings = result.settings || {
    enabled: true,
    windows: [
      { day: 1, start: "09:00", end: "17:00" },
      { day: 2, start: "09:00", end: "17:00" },
      { day: 3, start: "09:00", end: "17:00" },
      { day: 4, start: "09:00", end: "17:00" },
      { day: 5, start: "09:00", end: "17:00" }
    ],
    blockedHosts: []
  };
  
  // You'll need to import the function, but for quick check:
  console.log('Settings:', settings);
  console.log('Should block:', settings.enabled && settings.blockedHosts.length > 0);
});
```

## Common Issues

### Rules Not Applied

1. Check service worker console for errors
2. Verify rules exist: `chrome.declarativeNetRequest.getDynamicRules()`
3. Check if blocking is enabled in settings
4. Verify you're in a block window time

### Service Worker Not Running

- Service workers can be suspended
- Check "service worker" status in `chrome://extensions/`
- Click "service worker" link to wake it up
- The periodic alarm should keep it active

### Rules Disappear

- Check `verifyRules` logs - it runs every 5 minutes
- Look for "Rules missing, reapplying rules..." message
- Check for errors in rule application

## Enable/Disable Debug Mode

Edit `src/background/background.ts`:
```typescript
const DEBUG = true;  // Set to false to disable verbose logging
```

Then rebuild:
```bash
npm run build
```

## Network Request Debugging

To see blocked requests:
1. Open DevTools on any page
2. Go to Network tab
3. Try to visit a blocked site
4. Look for requests that are blocked/cancelled

## Source Maps

Source maps are enabled, so you can:
- Set breakpoints in TypeScript source files
- See original variable names in console
- Step through source code

## Tips

1. **Keep service worker console open** - It's the most important for debugging
2. **Watch for periodic logs** - `verifyRules` runs every 5 minutes
3. **Check alarms** - Use `chrome.alarms.getAll()` to see scheduled events
4. **Reload extension** - After code changes, reload the extension in `chrome://extensions/`
5. **Clear storage** - If settings seem corrupted, clear extension storage

