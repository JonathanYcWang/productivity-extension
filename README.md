# Productivity Blocker (MV3 + React + Vite)

A minimal Chrome extension that blocks configured sites during specified time windows. Uses Manifest V3 with `declarativeNetRequest`, `alarms`, and `storage`. Built with React (Vite).

## Quickstart

```bash
npm i
npm run build
```

### Adding to Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** by toggling the switch in the top-right corner
3. Click **Load unpacked**
4. Select the `dist/` folder from this project
5. The extension should now appear in your extensions list and be active

## Notes

- Configure blocked sites and time windows in the Options page.
- The background schedules an alarm for the next start/end boundary and flips dynamic rules accordingly.
- To port to Safari, use Xcode's "Convert Existing Web Extension".
