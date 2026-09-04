# ⭐ Show Desktop Plus  
*A smarter, workspace‑aware “Show Desktop” extension for GNOME Shell.*

<p align="center">
  <img src="https://img.shields.io/badge/GNOME-45–50-blue?logo=gnome&logoColor=white" />
  <img src="https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen?logo=vitest" />
  <img src="https://img.shields.io/badge/Core%20Coverage-96%25-brightgreen?logo=vitest" />
  <img src="https://img.shields.io/badge/Core%20Mutation%20Score-90%25-brightgreen?logo=stryker" />
  <img src="https://img.shields.io/github/license/attentivecoder/show-desktop-plus" />
  <img src="https://img.shields.io/badge/version-1-blue" />
</p>

Show Desktop Plus enhances GNOME’s desktop toggling by letting you hide and restore windows **per workspace**, optionally **per monitor**, with a clean panel indicator and intuitive mouse actions.

Originally based on the “Show Desktop Applet” extension — now heavily rewritten, modernized, and fully tested.

---

## 🚀 Features

- **Flexible Placement:**
  - Place on the **Top Panel**, **Ubuntu Dock / Dash-to-Dock**, or **Both**.
  - Dock position supports **Extreme Left / Top (Start)** or **Extreme Right / Bottom (End)**, integrating cleanly with extended panel mode and centered icons.
  - Graceful fallback to the top panel if Ubuntu Dock is not installed or is disabled.
- **Hover Actions (Peek & Auto-Toggle):**
  - **Peek at desktop:** Temporarily reveals the desktop when hovering mouse over the icon; restores open windows automatically when cursor leaves. Clicking while hovering commits the show-desktop state.
  - **Auto-toggle desktop:** Automatically toggles desktop after a configurable hover delay.
  - **Hover delay:** Adjustable delay in milliseconds (prevents accidental triggers).
- **Left‑click:** Toggle show/hide all windows on the current workspace
- **Middle‑click:**
  - Hide the focused window, **or**
  - Toggle desktop (configurable)
- **Right‑click:**
  - Focus the preferences window if already open
  - Otherwise open preferences normally
- **Per‑workspace window sessions:**
  - Hidden windows are tracked per workspace
  - Restores all windows and re‑activates the last focused one
- **Monitor‑aware behavior (optional):**
  - Hide/restore windows only on the active monitor
- **Dynamic panel icon:**
- **Dynamic icon & badge:**
  - Icon changes based on hidden state
  - Optional badge shows number of hidden windows
- **Configurable panel position**
- **Configurable panel position:** Left-end, Left, Center, Right, Right-end
- **Optional global hotkey** (overrides GNOME’s built‑in Show Desktop)
- **Automatic updates on workspace switch**
- **Fully unit‑tested with Vitest**
- **Fully unit‑tested with Vitest (174 tests passing)**

---

## ⚙️ Settings

### Panel
- `button-position` – button position in the top bar
### Placement
- `display-location` – where the icon appears:
  - `panel` – top panel only
  - `dock` – Ubuntu Dock / Dash-to-Dock only
  - `both` – top panel and dock
- `panel-position` (`button-position`) – button position in the top bar (`left-end`, `left`, `center`, `right`, `right-end`)
- `dock-position` – button position in Ubuntu Dock (`extreme-start`, `extreme-end`)

### Controls
- `hover-action` – what happens when hovering mouse over the icon:
  - `none` – disabled (click only)
  - `peek` – peek at desktop while hovered
  - `toggle` – auto-toggle desktop after delay
- `hover-delay` – delay in milliseconds before hover action triggers (default `250ms`)

- `left-click-action` – what happens when left-clicking the icon:
  - toggle desktop
  - hide all windows
  - restore windows
  - hide focused window
  - do nothing

- `middle-click-action` – what happens when middle-clicking the icon:
  - hide all windows
  - hide focused window
  - toggle desktop

### Shortcuts
- `enable-hotkey` – enable keyboard shortcut (overrides GNOME “Show Desktop”)

### Appearance
- `icon-style` – auto / desktop / computer
- `show-hidden-count` – show/hide badge with number of hidden windows

### Behavior
- `current-monitor-only` – limit window hiding to the active monitor

## Installation
### 📦 Recommended (stable release)

Download the latest `.zip` from the Releases page:

👉 [Download latest release](https://github.com/attentivecoder/show-desktop-plus/releases/latest)

Then install it with:

```bash
gnome-extensions install show-desktop-plus@attentivecoder.zip
gnome-extensions enable show-desktop-plus@attentivecoder
```

### From source (development)
Clone into your local GNOME extensions directory:

```bash
git clone https://github.com/attentivecoder/show-desktop-plus.git \
  ~/.local/share/gnome-shell/extensions/show-desktop-plus@attentivecoder
```

Compile schemas:

```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/show-desktop-plus@attentivecoder/schemas/
```

Restart GNOME Shell:
- Xorg: press Alt+F2, type r, press Enter
- Wayland: log out and back in

Enable the extension:

```bash
gnome-extensions enable show-desktop-plus@attentivecoder
```

## 🛠️ Development Notes

### Recompile schemas after changes

```bash
glib-compile-schemas schemas/
```

Or if you need to install system-wide (rare):

```bash
sudo cp schemas/org.gnome.shell.extensions.show-desktop-plus.gschema.xml \
    /usr/share/glib-2.0/schemas/

sudo glib-compile-schemas /usr/share/glib-2.0/schemas/
```

Verify schema changes:

```bash
gsettings list-keys org.gnome.shell.extensions.show-desktop-plus
```

## Testing
This extension includes a full Vitest test suite.
Run tests:

```bash
npm test
```

Or use npx for more indepth analysis if needed.

```bash
npx vitest --reporter verbose
```

Or use npx to check code coverage.

```bash
npx vitest --coverage
```

## Mutation Testing (Stryker)
This project uses Stryker, a mutation testing tool that evaluates how effective the test suite is by introducing small changes (“mutants”) into the code and verifying that the tests catch them.

Run mutation tests:

```bash
npx stryker run
```

A detailed HTML report is generated in:

```bash
reports/mutation/mutation.html
```

## Testing when making .zip

### Create a ZIP package of the extension

```bash
 zip -r show-desktop-plus@attentivecoder.zip \
            extension.js \
            prefs.js \
            prefs.ui \
            metadata.json \
            core \
            prefs \
            schemas \
            stylesheet.css \
            -x "schemas/gschemas.compiled"
```

This produces a clean extension bundle identical to what GNOME Extensions expects.

### Activate your Python virtual environment
Use a virtualenv for testing tools:

```bash
. venv/bin/activate
```

### Test the extension in a sandboxed GNOME Shell session
Using shexli (Shell Extension Live Installer):

```bash
shexli show-desktop-plus@attentivecoder.zip
```

### View project tree (excluding node_modules):
```bash
tree -I 'node_modules|coverage|dist|build|venv'
```

### Debug GNOME Shell logs:

```bash
journalctl -f /usr/bin/gnome-shell
```

### Useful commands:

```bash
gsettings list-keys org.gnome.shell.extensions.show-desktop-plus
gsettings get org.gnome.shell.extensions.show-desktop-plus button-position
```

## 🏷️ Releases

> Maintainer notes for creating releases.

This project uses Git tags to trigger automated releases via GitHub Actions.

### Create a release tag

```bash
git tag -s v1.0 -m "Release v1.0"
git push origin v1.0
```

### Delete a tag

```bash
git tag -d v1.0
git push origin :refs/tags/v0.1
```

## ❤️ Credits
- Original extension by **Valent-in**: https://github.com/Valent-in/Show-Desktop-Applet
- Rewritten, modernized, and expanded by @attentivecoder
