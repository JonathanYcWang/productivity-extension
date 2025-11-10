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

4. **Terminal/Command Prompt** (comes with your operating system)
   - **Mac/Linux**: Open Terminal app
   - **Windows**: Open Command Prompt or PowerShell (search for "cmd" or "PowerShell" in Start menu)

## Installation

### Step 1: Get the Project

**Option A: Using Git (recommended)**

Clone the repository:
```bash
git clone https://github.com/JonathanYcWang/productivity-extension.git
cd productivity-extension
```

**Option B: Download as ZIP**

1. Go to the [GitHub repository](https://github.com/JonathanYcWang/productivity-extension)
2. Click the green **Code** button → **Download ZIP**
3. Extract the ZIP file to a folder on your computer
4. Open terminal (or Command Prompt on Windows) and navigate to the extracted folder:
   ```bash
   cd path/to/productivity-extension
   ```

### Step 2: Install Dependencies

In your terminal, make sure you're in the project folder, then run:
```bash
npm install
```

This will download all required packages (may take a minute or two). You should see a `node_modules` folder appear in your project directory.

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

## Usage

After installation:

1. Click the extension icon in your Chrome toolbar (you may need to pin it)
2. Click **Options** to configure:
   - **Blocked sites**: Add websites you want to block (e.g., `facebook.com`, `reddit.com`)
   - **Time windows**: Set when the blocking should be active (e.g., 9 AM - 5 PM on weekdays)
   - **Master switch**: Toggle the extension on/off

The extension will automatically block the configured sites during your specified time windows.

## Quickstart (If you already have Node.js installed)

```bash
npm install
npm run build
# Then load dist/ folder in chrome://extensions (Developer mode → Load unpacked)
```

## Troubleshooting

**"npm: command not found" or "node: command not found"**
- Make sure Node.js is installed and you've restarted your terminal after installation
- Verify installation: `node --version` and `npm --version`

**"Cannot find module" errors during build**
- Make sure you ran `npm install` first
- Delete `node_modules` folder and `package-lock.json`, then run `npm install` again

**Extension not loading in Chrome**
- Make sure you selected the `dist/` folder (not the root project folder)
- Check that `npm run build` completed successfully
- Try reloading the extension in `chrome://extensions` (click the refresh icon)

**Extension not blocking sites**
- Make sure the master switch is enabled in the Options page
- Verify you're within the configured time window
- Check that you've added sites to the blocked list (include the domain, e.g., `reddit.com`)

## Notes

- Configure blocked sites and time windows in the Options page.
- The background schedules an alarm for the next start/end boundary and flips dynamic rules accordingly.
- To port to Safari, use Xcode's "Convert Existing Web Extension".
