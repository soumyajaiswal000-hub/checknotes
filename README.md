# 📝 CheckNotes — Notes & Daily Checklist App

A clean, modern note-taking app with integrated daily checklists, habit routines, and streak tracking. Designed for fast daily organization, distraction-free writing, and tracking daily progress.

![CheckNotes](https://img.shields.io/badge/CheckNotes-v1.0-blue.svg)
![Python 3](https://img.shields.io/badge/Python-3.9+-green.svg)
![Nothing Phone Ready](https://img.shields.io/badge/Nothing%20Phone%203-Ready-black.svg)

---

## 📱 Using on Nothing Phone 3 (PWA & APK)

### Method 1: Instant Install as Native App via PWA (Recommended)
You can install and use the app on your Nothing Phone 3 **immediately with zero developer tools**:

1. Make sure your Mac and Nothing Phone 3 are connected to the same Wi-Fi network.
2. Start the server on your Mac:
   ```bash
   cd /Users/soumyajaiswal/.gemini/antigravity/scratch/note-checklist-app
   ./start.sh
   ```
3. On your Nothing Phone 3, open **Google Chrome** and navigate to:
   ```
   http://192.168.1.8:8080
   ```
4. In Chrome, tap the **three dots menu (⋮)** in the top right, then tap **"Install app"** (or **"Add to Home screen"**).
5. **Done!** CheckNotes will appear directly in your Nothing OS app drawer and home screen. It runs in standalone full-screen mode (no browser address bar), stores your notes offline, and works completely without internet.

---

### Method 2: Building the Standalone `.apk` File

A complete, pre-configured Android project is ready in the [`android/`](file:///Users/soumyajaiswal/.gemini/antigravity/scratch/note-checklist-app/android) folder:

#### Option A: Using Android Studio
1. Open Android Studio on any computer with the Android SDK.
2. Select **Open** and choose `/Users/soumyajaiswal/.gemini/antigravity/scratch/note-checklist-app/android`.
3. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
4. Android Studio will output `app-debug.apk` that you can transfer directly to your Nothing Phone 3.

#### Option B: Automated Cloud Build via GitHub Actions
A GitHub Actions workflow is included at [`.github/workflows/build-apk.yml`](file:///Users/soumyajaiswal/.gemini/antigravity/scratch/note-checklist-app/.github/workflows/build-apk.yml). If you push this project to a GitHub repository:
1. GitHub will automatically compile the APK using Ubuntu cloud runners with JDK 17 and Android SDK.
2. You can download the compiled `app-debug.apk` directly from the GitHub **Actions** tab onto your Nothing Phone 3.

---

## ✨ Features

### 📅 1. Daily Checklist & Habit Routines
- **Date Navigation & 7-Day Quick Strip**: Easily toggle between Today, Yesterday, Tomorrow, or any day of the week.
- **Priority & Tags**: Assign **High (🔴)**, **Medium (🟡)**, or **Low (🟢)** priority to tasks, plus categories like `#work`, `#health`, `#routine`.
- **Rollover Incomplete Tasks**: 1-click **"Rollover"** button moves any pending tasks from yesterday straight into today so nothing slips through the cracks.
- **Recurring Habits & Routines**: Save reusable routines (e.g. *Morning Planning*, *Hydration*, *Movement*, *Evening Review*) and apply them to any day with 1 click.
- **Convert Task to Note**: Convert any checklist item into a dedicated note with a single click.
- **Audio Chime**: Harmonious audio chime when completing a task (Web Audio API, toggleable on/off).

### 📝 2. Full-Featured Notes & Journaling
- **Live Markdown Support**: Edit in raw Markdown or switch between **Edit**, **Split View**, and **Live Preview**.
- **Formatting Toolbar**: Quick buttons for Bold, Italics, Headings (H1/H2), Bullet lists, Task checkboxes, Quotes, and Code blocks.
- **"Open Today's Journal"**: 1-click shortcut creates or opens a structured daily log for the selected day.
- **Pin & Color Accents**: Pin key notes to the top and organize with pastel color tints.
- **Instant Search & Tag Filtering**: Fast search across titles, contents, and click-to-filter tag chips.
- **Export to Markdown**: Download any note as a clean `.md` file.

### 📊 3. Streaks & Analytics
- **Daily Streak Counter**: Tracks consecutive days with completed tasks (`🔥 X-day streak`).
- **7-Day Visual Progress Chart**: Visualizes task completion rate for the past week.
- **Completion Progress Bar**: Real-time progress bar for each day (`X of Y completed — Z%`).

### 💾 4. Robust Storage Architecture
- **SQLite Database**: Persistent local database (`notes_checklist.db`) managed via Python 3's built-in standard library with zero external pip dependencies.
- **Offline / Standalone Fallback**: If opened directly without the server, the app gracefully falls back to browser `localStorage`.
- **JSON Backup & Restore**: Export full workspace backups to a JSON file and restore anytime.

---

## 🚀 Quick Start on Desktop

### Option A: Run with local Python server (Recommended)
```bash
cd /Users/soumyajaiswal/.gemini/antigravity/scratch/note-checklist-app
./start.sh
```
Or run Python directly:
```bash
python3 server.py 8080
```
Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Option B: Standalone / Direct Browser Opening
You can also directly double-click or open `static/index.html` in Safari, Chrome, or Firefox. It will run completely locally with `localStorage`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd / Ctrl + N` | Create a new Note |
| `Cmd / Ctrl + T` | Focus new Checklist Task input |
| `Cmd / Ctrl + Shift + D` | Toggle Dark / Light Mode |
| `Esc` | Close any open modal dialog |

---

## 📁 Project Structure

```text
note-checklist-app/
├── server.py              # Lightweight HTTP server & REST API
├── database.py            # SQLite schema, queries, migrations & seeds
├── start.sh               # Executable launcher script (starts server & opens browser)
├── notes_checklist.db     # SQLite database file (auto-created on first run)
├── static/
│   ├── index.html         # Single-page application UI with responsive layout
│   ├── manifest.json      # PWA Web App Manifest (for Nothing Phone 3 installation)
│   ├── sw.js              # Service Worker for offline caching & instant launch
│   ├── icons/             # 192x192 and 512x512 app icons
│   ├── css/
│   │   └── app.css        # Theme variables, custom scrollbars, and animations
│   └── js/
│       ├── api.js         # API connector with automatic LocalStorage fallback
│       └── app.js         # Application controller, Markdown parser, audio synthesizer
├── android/               # Complete Android Studio project (Gradle + Java WebView)
│   ├── app/
│   │   ├── src/main/java/com/nothing/checknotes/MainActivity.java
│   │   ├── src/main/assets/www/   # Embedded offline app assets
│   │   └── AndroidManifest.xml
│   ├── build.gradle
│   └── settings.gradle
└── .github/workflows/
    └── build-apk.yml      # Automated GitHub Actions workflow to build APK
```
