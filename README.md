# Focus Mode - Chrome Extension

A Chrome browser extension that helps you read online content without distractions by cleaning webpages, controlling scrolling, and tracking reading time.

## Features

### 🧹 Remove Distractions
- Hides ads, popups, sidebars, and recommendation panels
- Removes sticky headers and footers
- Keeps only the main readable content
- Toggle on/off per website

### 📜 Scroll Locking
- Scroll one screen-height at a time (chunks)
- Prevents fast infinite scrolling
- Floating "Next" and "Previous" buttons
- Keyboard support (Arrow keys, Page Up/Down)

### ⏱️ Reading Timer
- Starts automatically when Focus Mode is enabled
- Small overlay showing elapsed time
- Pause and reset controls
- Remembers time per website

### 📊 Reading Progress
- Visual progress bar at the top of the page
- Shows percentage of article read
- Updates in real-time as you scroll

### 📈 Reading Speed Calculator
- Calculates words per minute (WPM) automatically
- Displays reading speed in the timer overlay
- Helps track and improve reading efficiency

### 🌙 Dark Mode
- Invert page colors for comfortable reading in low light
- Toggle on/off in settings
- Preserves image and video colors

### 🔤 Font Size Adjuster
- Adjust text size from 75% to 150%
- Better readability for all users
- Applies to entire page content

### 🎯 Focus Sessions (Pomodoro)
- Set focus session duration (5-60 minutes)
- Visual countdown timer
- Completion notification when session ends
- Helps maintain focus and take breaks

### 📊 Reading Statistics
- Track daily reading time
- View total reading time across all sessions
- Session counter
- Statistics displayed in popup

### ⚙️ Customizable Settings
- Adjust scroll chunk size (25% - 150%)
- Show/hide timer overlay
- Toggle reading speed display
- Toggle progress bar
- Dark mode toggle
- Font size adjustment (75% - 150%)
- Focus session duration (5-60 minutes)
- Whitelist websites to exclude

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `FocusFlow` folder
6. The extension icon will appear in your toolbar!

## Usage

1. **Enable Focus Mode**: Click the extension icon and toggle the switch
2. **Navigate**: Use the floating buttons or arrow keys to scroll by chunks
3. **Timer**: The reading timer starts automatically (pause/reset available)
4. **Disable**: Press `Escape` or click the toggle again

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↓` / `PageDown` / `Space` | Scroll to next chunk |
| `↑` / `PageUp` | Scroll to previous chunk |
| `Escape` | Exit Focus Mode |

## Settings

Access settings by:
- Click the extension icon → Settings link
- Or right-click extension icon → Options

### Available Options
- **Scroll Chunk Size**: How much to scroll at once (default: 100% of viewport)
- **Show Timer**: Toggle the reading time overlay
- **Show Reading Speed**: Display words per minute (WPM) calculation
- **Show Progress Bar**: Display reading progress at top of page
- **Dark Mode**: Invert colors for low-light reading
- **Font Size**: Adjust text size from 75% to 150%
- **Focus Session Duration**: Set Pomodoro-style session length (5-60 minutes)
- **Whitelist**: Add domains where Focus Mode should never activate

## File Structure

```
FocusFlow/
├── manifest.json           # Extension configuration
├── icons/                  # Extension icons
├── background/
│   └── service-worker.js   # Background tasks
├── content/
│   ├── content.js          # Page manipulation
│   └── content.css         # Focus mode styles
├── popup/
│   ├── popup.html          # Toolbar popup
│   ├── popup.css
│   └── popup.js
├── settings/
│   ├── settings.html       # Options page
│   ├── settings.css
│   └── settings.js
└── lib/
    └── storage.js          # Storage utilities
```

## Technical Details

- **Manifest V3** compatible
- **Vanilla JavaScript** - no frameworks
- **Chrome Storage Sync API** for cross-device settings
- **Chrome Storage Local API** for reading statistics
- Works on most article-based websites
- Real-time reading speed calculation
- Progress tracking with scroll detection

## Privacy

This extension:
- Does NOT collect any personal data
- Does NOT send any data externally
- Stores preferences locally using Chrome's sync storage

## License

MIT License - Feel free to modify and distribute!
