# Productivity Blocker (MV3 + React + Vite)

A minimal Chrome extension that blocks configured sites during specified time windows. Uses Manifest V3 with `declarativeNetRequest`, `alarms`, and `storage`. Built with React (Vite).

## Quickstart

```bash
npm i
npm run build
# Load dist/ at chrome://extensions (Developer mode → Load unpacked)
```

## Notes

- Configure blocked sites and time windows in the Options page.
- The background schedules an alarm for the next start/end boundary and flips dynamic rules accordingly.
- To port to Safari, use Xcode's "Convert Existing Web Extension".
