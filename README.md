# Productivity Blocker (MV3 + React + Vite)

A cross-browser extension that blocks configured sites during specified time windows. Compatible with **Chrome** and **Safari**. Uses Manifest V3 with `declarativeNetRequest`, `alarms`, and `storage`. Built with React (Vite).

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

2. **Google Chrome** browser (for Chrome installation)
   - **OR Safari 14+** with **Xcode** (for Safari installation - Mac only)
   - **For Safari**: Xcode 12+ is required. Download from the Mac App Store or [Apple Developer](https://developer.apple.com/xcode/)

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

### Step 4: Load Extension

#### For Chrome:

1. Open Chrome and navigate to `chrome://extensions`
   - Or go to Chrome menu → Extensions → Manage Extensions
2. Enable **Developer mode** by toggling the switch in the top-right corner
3. Click **Load unpacked**
4. Navigate to and select the `dist/` folder from this project
5. The extension should now appear in your extensions list and be active!

#### For Safari:

**Prerequisites:**
- **macOS** (required for Safari extensions)
- **Xcode 12+** installed from the Mac App Store
- **Safari 14+** (macOS Big Sur or later)
- **Apple Developer Account** (free Apple ID works for development)

---

## Complete Safari Setup Guide

### Part 1: Build Your Extension

1. **Build the extension**:
   ```bash
   npm run build
   ```
   This creates the `dist/` folder with all your extension files.

### Part 2: Create Xcode Project

2. **Open Xcode** and create a new project:
   - **File** → **New** → **Project**
   - Select **macOS** tab → **App** → **Next**
   - Fill in:
     - **Product Name**: `ProductivityBlocker` (or any name)
     - **Team**: Select your team (or add your Apple ID)
     - **Organization Identifier**: `com.yourname` (or your identifier)
     - **Interface**: **SwiftUI** (or Storyboard)
     - **Language**: **Swift**
     - **Uncheck** "Use Core Data"
   - Click **Next**, choose a location, click **Create**

### Part 3: Add Safari Extension Target

3. **Add the Safari Extension target**:
   - In Xcode, click the **+** button at the bottom of the project navigator (left sidebar)
   - OR go to **File** → **New** → **Target**
   - Select **macOS** tab → **Safari Extension** (compass icon) → **Next**
   - Fill in the options:
     - **Product Name**: `ProductivityBlockerExtension`
     - **Team**: Same team as your app
     - **Organization Identifier**: Same as your app
     - **Language**: Swift (doesn't matter)
     - **Type**: **Safari Web Extension** (should be selected)
     - **Embed in Application**: Select your main app (e.g., "ProductivityBlocker")
   - Click **Finish**
   - When asked "Would you like to activate the scheme?", click **Activate**

### Part 4: Replace Template Files with Your Extension

4. **Find your extension folder**:
   - In the project navigator (left sidebar), look for a folder named like `ProductivityBlockerExtension` or `Recess-Safari`
   - Expand it - you'll see:
     - `Resources` folder (contains template files)
     - `Info` (configuration file - **keep this**)
     - `SafariWebExtensionHandler.swift` (bridge file - **keep this**)

5. **Add your extension files to Resources**:
   - Expand the `Resources` folder
   - Right-click inside the `Resources` folder → **Add Files to "[Project Name]"...**
   - Navigate to your **`dist/`** folder (where you ran `npm run build`)
   - **Select all files and folders** inside `dist/`:
     - `manifest.json`
     - `background/` folder
     - `popup/` folder
     - `options/` folder
     - `content/` folder
     - `cardPopup/` folder
     - `assets/` folder
     - All icon files (icon-16.png, icon-48.png, icon-128.png)
   - In the dialog:
     - ✅ Check **"Copy items if needed"**
     - ✅ Select **"Create folder references"** (NOT "Create groups")
     - ✅ Make sure your extension target is checked under "Add to targets"
   - Click **Add**

6. **Verify files are added**:
   - Your `Resources` folder should now contain all your extension files
   - Files should appear in **blue** (folder references) - this is correct!

### Part 5: Configure and Run

7. **Configure signing**:
   - Click your **project** (top item in navigator) → Select your **extension target** under TARGETS
   - Go to **Signing & Capabilities** tab
   - Select your **Team** (add Apple ID if needed: Xcode → Preferences → Accounts)

8. **Select the correct scheme**:
   - At the top toolbar, next to the Play button, click the **scheme dropdown**
   - Select your **extension scheme** (e.g., "ProductivityBlockerExtension")
   - Next to the scheme, click the **destination dropdown**
   - Select **"My Mac"** (NOT any iOS device)

9. **Build and run**:
   - Press **Cmd + R** or click the **Run** button (▶️)
   - Xcode will build and launch Safari
   - Safari will show a dialog asking to enable the extension
   - Go to **Safari** → **Settings** → **Extensions**
   - Find your extension and **enable** it
   - Grant any requested permissions

### Part 6: Development Workflow (After Initial Setup)

**For future code changes:**

1. Make your code changes
2. Run `npm run build` in terminal
3. In Xcode: **Cmd + B** (build) then **Cmd + R** (run)
4. Safari will reload with your changes

**Note**: Since you copied files (not linked), you'll need to re-add files from `dist/` if the structure changes significantly. For minor changes, you can manually update files in Xcode's Resources folder.

**Troubleshooting:**

- **"Build only device" error**: Make sure scheme is set to your extension (not the app) and destination is "My Mac"
- **Signing errors**: Add your Apple ID in Xcode → Preferences → Accounts, then select your team
- **Extension not appearing in Safari**: Check Safari → Settings → Extensions and enable it manually
- **Files not updating**: Re-add files from `dist/` folder after running `npm run build`

**Important Notes:**
- Safari extensions require code signing (free Apple ID works for development)
- First run may require allowing the extension in System Preferences → Security & Privacy
- For App Store distribution, you'll need a paid Apple Developer Program membership ($99/year)

## Usage

After installation:

1. Click the extension icon in your browser toolbar (you may need to pin it in Chrome)
   - **Chrome**: The extension icon appears in the extensions menu or toolbar
   - **Safari**: The extension icon appears in the Safari toolbar (if enabled in Safari Preferences → Extensions)
2. Click **Options** (or right-click the extension icon → **Options**) to configure:
   - **Blocked sites**: Add websites you want to block (e.g., `facebook.com`, `reddit.com`)
   - **Time windows**: Set when the blocking should be active (e.g., 9 AM - 5 PM on weekdays)
   - **Master switch**: Toggle the extension on/off

The extension will automatically block the configured sites during your specified time windows.

## Quickstart (If you already have Node.js installed)

### For Chrome:
```bash
npm install
npm run build
# Then load dist/ folder in chrome://extensions (Developer mode → Load unpacked)
```

### For Safari:
```bash
npm install
npm run build
# Then use Xcode to convert and load the extension (see Step 4 Safari instructions above)
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

**Extension not loading in Safari**
- Make sure you've built the extension with `npm run build` before converting in Xcode
- Check that you've selected your Team in Xcode's Signing & Capabilities tab
- Ensure Safari → Preferences → Extensions shows the extension and it's enabled
- Check Xcode's console for any error messages during build
- Try cleaning the build folder: **Product** → **Clean Build Folder** (`Cmd + Shift + K`)

**Extension not blocking sites**
- Make sure the master switch is enabled in the Options page
- Verify you're within the configured time window
- Check that you've added sites to the blocked list (include the domain, e.g., `reddit.com`)
- In Safari, ensure the extension has been granted necessary permissions in Safari → Preferences → Extensions

**Safari Extension Signing Errors**
- Make sure you've signed in to Xcode with your Apple ID: **Xcode** → **Preferences** → **Accounts**
- Add your Apple ID if it's not listed, then select a Team for signing
- A free Apple ID works for development; a paid Apple Developer account ($99/year) is only needed for distribution

## Browser Compatibility

This extension is compatible with:
- **Chrome/Chromium**: Full support (Manifest V3)
- **Safari 14+**: Full support (WebExtension with Manifest V3, requires Xcode conversion)

The extension uses a browser API abstraction layer that automatically adapts to Chrome's `chrome.*` APIs and Safari's `browser.*` APIs, ensuring seamless functionality across both browsers.

## Notes

- Configure blocked sites and time windows in the Options page.
- The background schedules an alarm for the next start/end boundary and flips dynamic rules accordingly.
- The extension includes Safari compatibility through automatic API detection and fallbacks.
- For Safari distribution via the App Store, you'll need an Apple Developer Program membership ($99/year).
