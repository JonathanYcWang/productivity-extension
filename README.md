# Productivity Blocker (MV3 + React + Vite)

A minimal Chrome extension that blocks configured sites during specified time windows. Uses Manifest V3 with `declarativeNetRequest`, `alarms`, and `storage`. Built with React (Vite).

## Prerequisites

Before you begin, make sure you have the following installed:

1. **Node.js** (version 16 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - This will also install `npm` (Node Package Manager)
   - Verify installation by running in terminal:
     ```bash
     node --version
     npm --version
     ```

2. **Google Chrome** browser

3. **Git** (optional, for cloning the repository)
   - Download from [git-scm.com](https://git-scm.com/)
   - Or download the project as a ZIP file from GitHub

## Installation

### Step 1: Get the Project

**Option A: Using Git (recommended)**
```bash
git clone <repository-url>
cd productivity-blocker
```

**Option B: Download as ZIP**
1. Download the project as a ZIP file from GitHub
2. Extract the ZIP file to a folder on your computer
3. Open terminal and navigate to the extracted folder:
   ```bash
   cd path/to/productivity-blocker
   ```

### Step 2: Install Dependencies

```bash
npm install
```

This will download all required packages (may take a minute or two).

### Step 3: Build the Extension

```bash
npm run build
```

This creates the `dist/` folder with the compiled extension files.

### Step 4: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
   - Or go to Chrome menu → Extensions → Manage Extensions
2. Enable **Developer mode** by toggling the switch in the top-right corner
3. Click **Load unpacked**
4. Navigate to and select the `dist/` folder from this project
5. The extension should now appear in your extensions list and be active!

## Quickstart (If you already have Node.js installed)

```bash
npm install
npm run build
# Then load dist/ folder in chrome://extensions (Developer mode → Load unpacked)
```

## Notes

- Configure blocked sites and time windows in the Options page.
- The background schedules an alarm for the next start/end boundary and flips dynamic rules accordingly.
- To port to Safari, use Xcode's "Convert Existing Web Extension".
