const LeftClickAction = {
    TOGGLE_DESKTOP: 0,
    HIDE_ALL: 1,
    RESTORE_ALL: 2,
    HIDE_CURRENT: 3,
    DO_NOTHING: 4,
};

const MiddleClickAction = {
    HIDE_ALL: 0,
    HIDE_CURRENT: 1,
    TOGGLE_DESKTOP: 2,
};

const IconStyle = {
    AUTO: 0,
    DESKTOP: 1,
    COMPUTER: 2,
};

export default class PanelIndicator {
    constructor(windowManager, stateStore, extension, gnomeUI, hoverHandler = null) {
        // Core dependencies
        this._windowManager = windowManager;
        this._stateStore = stateStore;
        this._extension = extension;
        this._hoverHandler = hoverHandler;

        // GNOME Shell API bindings (injected for testability)
        this._St = gnomeUI.St;
        this._Clutter = gnomeUI.Clutter;
        this._GLib = gnomeUI.GLib;
        this._Meta = gnomeUI.Meta;
        this._PanelMenu = gnomeUI.PanelMenu;
        this._Main = gnomeUI.Main;
        this._display = gnomeUI.display;
        this._workspace_manager = gnomeUI.workspace_manager;
        this._get_window_actors = gnomeUI.get_window_actors;
        this._get_current_time = gnomeUI.get_current_time;

        // UI elements
        this._panelButton = null;
        this._panelIcon = null;
        this._panelBadge = null;

        // Preferences window tracking
        this._prefsOpenedByExtension = false;
        this._prefsWindow = null;
        this._prefsWindowSignal = null;

        // Signal tracking
        this._buttonSignal = null;
    }

    // ───────────────────────────────────────────────────────────
    // Preferences window handling
    // ───────────────────────────────────────────────────────────

    /**
     * Safely opens the extension preferences.
     * Handles:
     *  - synchronous exceptions
     *  - promise rejections
     *  - missing logError()
     */
    _safeOpenPreferences() {
        try {
            const result = this._extension.openPreferences();

            // Handle async rejection (if openPreferences returns a promise)
            Promise.resolve(result).catch(err => {
                if (typeof logError === "function") logError(err);
                else console.error(err);
            });

        } catch (err) {
            // Handle synchronous throw
            if (typeof logError === "function") logError(err);
            else console.error(err);
        }
    }

    /**
     * Finds the preferences window belonging to this extension.
     * Matches by:
     *  - wmClass = org.gnome.Shell.Extensions
     *  - title containing extension name
     */
    _findPrefsWindow() {
        const extName = this._extension.metadata.name;

        const windows = this._get_window_actors()
            .map(actor => actor.meta_window)
            .filter(w => w);

        return windows.find(w => {
            const title = w.get_title() || "";
            const wmClass = w.get_wm_class() || "";
            return (
                wmClass === "org.gnome.Shell.Extensions" &&
                title.includes(extName)
            );
        });
    }

    /**
     * Tracks the prefs window so we can detect when it closes.
     */
    // Stryker disable next-line BlockStatement
    _trackPrefsWindow(win) {
        // Stryker disable next-line LogicalOperator, ConditionalExpression, BooleanLiteral
        if (!win || this._prefsWindowSignal) return;

        this._prefsWindow = win;

        // Stryker disable next-line StringLiteral
        this._prefsWindowSignal = win.connect("unmanaged", () => {
            this._prefsWindow = null;
            this._prefsWindowSignal = null;
            this._prefsOpenedByExtension = false;
        });
    }

    // ───────────────────────────────────────────────────────────
    // Click handling
    // ───────────────────────────────────────────────────────────

    _handleLeftClick(action) {
        const actions = {
            [LeftClickAction.TOGGLE_DESKTOP]: () => this._windowManager.toggleDesktop(),
            [LeftClickAction.HIDE_ALL]: () => this._windowManager.hideAllWindows(),
            [LeftClickAction.RESTORE_ALL]: () => this._windowManager.restoreAllWindows(),
            [LeftClickAction.HIDE_CURRENT]: () => {
                this._windowManager.addCurrentWindowToHidden();
                this.updateIcon();
            },
            [LeftClickAction.DO_NOTHING]: () => {},
        };

        actions[action]?.();
    }

    _handleMiddleClick(action) {
        const actions = {
            [MiddleClickAction.HIDE_ALL]: () => this._windowManager.hideAllWindows(),
            [MiddleClickAction.HIDE_CURRENT]: () => {
                this._windowManager.addCurrentWindowToHidden();
                this.updateIcon();
            },
            [MiddleClickAction.TOGGLE_DESKTOP]: () => this._windowManager.toggleDesktop(),
        };

        actions[action]?.();
    }

    /**
     * Main right‑click handler.
     * Handles:
     *  - focusing existing prefs window
     *  - opening prefs if none exists
     *  - activation errors
     *  - workspace switching
     */
    async _handlePrefsWindow() {
        if (this._prefsHandling)
            return;

        this._prefsHandling = true;

        try {
            const currentWs = this._workspace_manager.get_active_workspace();
            let prefsWin = this._findPrefsWindow();

            // Case 1: prefs window already exists
            if (prefsWin) {
                this._focusExistingPrefsWindow(prefsWin, currentWs);
                return;
            }

            // Case 2: open prefs for the first time
            this._openPrefsWindowFirstTime();

            // Try to find the window after opening
            prefsWin = this._findPrefsWindow();
            if (!prefsWin)
                return;

            this._focusNewlyOpenedPrefsWindow(prefsWin, currentWs);

        } catch (err) {
            this._logError(err);

        } finally {
            this._prefsHandling = false;
        }
    }

    _focusExistingPrefsWindow(prefsWin, currentWs) {
        this._trackPrefsWindow(prefsWin);

        // Move to current workspace if needed
        if (prefsWin.get_workspace() !== currentWs)
            prefsWin.change_workspace(currentWs);

        this._activateWindowSafely(prefsWin);
    }

    _openPrefsWindowFirstTime() {
        this._prefsOpenedByExtension = true;
        this._safeOpenPreferences();
    }

    _focusNewlyOpenedPrefsWindow(prefsWin, currentWs) {
        this._trackPrefsWindow(prefsWin);

        if (prefsWin.get_workspace() !== currentWs)
            prefsWin.change_workspace(currentWs);

        this._activateWindowSafely(prefsWin);
    }

    /**
     * Activates a window, falling back to opening prefs again if activation fails.
     */
    _activateWindowSafely(win) {
        try {
            win.activate(this._get_current_time());
        } catch (err) {
            this._logError(err);
            this._safeOpenPreferences();
        }
    }

    _logError(err) {
        if (typeof logError === "function") logError(err);
        else console.error(err);
    }

    // ───────────────────────────────────────────────────────────
    // Panel button creation
    // ───────────────────────────────────────────────────────────

    _createPanelButton() {
        if (this._panelButton) return;

        this._panelButton = new this._PanelMenu.Button(
            0.0,
            `${this._extension._extensionName}-indicator`,
            false
        );

        const box = this._createPanelButtonWidget();
        this._panelButton.add_child(box);

        this._connectButtonEvents();
    }

    /**
     * Creates the container widget holding the icon + badge.
     */
    _createPanelButtonWidget() {
        const box = new this._St.Widget({
            layout_manager: new this._Clutter.BinLayout(),
            reactive: false,
        });

        this._panelIcon = this._createIcon();
        this._panelBadge = this._createBadge();

        box.add_child(this._panelIcon);
        box.add_child(this._panelBadge);

        return box;
    }

    _createIcon() {
        return new this._St.Icon({
            icon_name: "computer-symbolic",
            style_class: "system-status-icon",
        });
    }

    _createBadge() {
        return new this._St.Label({
            style_class: "desktop-toggle-badge",
            visible: false,
            reactive: false,
        });
    }

    /**
     * Connects mouse event handling for left/middle/right click.
     */
    _connectButtonEvents() {
        this._panelButton.reactive = true;
        this._panelButton.clear_actions();

        if (this._hoverHandler) {
            this._hoverHandler.attach(this._panelButton);
        }

        this._buttonSignal = this._panelButton.connect(
            "button-release-event",
            (_, event) => this._handleButtonEvent(event)
        );
    }

    _handleButtonEvent(event) {
        const wasPeeking = this._hoverHandler ? this._hoverHandler.handleClick() : false;
        this._hoverHandler?.resetCommittedPeek?.();

        const button = event.get_button();

        switch (button) {
            case this._Clutter.BUTTON_PRIMARY: {
                const action = this._extension._settings.get_enum("left-click-action");
                if (wasPeeking && (action === LeftClickAction.TOGGLE_DESKTOP || action === LeftClickAction.HIDE_ALL)) {
                    this.updateIcon();
                    return this._Clutter.EVENT_STOP;
                }
                this._handleLeftClick(action);
                return this._Clutter.EVENT_STOP;
            }

            case this._Clutter.BUTTON_MIDDLE: {
                const action = this._extension._settings.get_enum("middle-click-action");
                if (wasPeeking && (action === MiddleClickAction.TOGGLE_DESKTOP || action === MiddleClickAction.HIDE_ALL)) {
                    this.updateIcon();
                    return this._Clutter.EVENT_STOP;
                }
                this._handleMiddleClick(action);
                return this._Clutter.EVENT_STOP;
            }

            case this._Clutter.BUTTON_SECONDARY:
                // Run prefs handler in idle to avoid blocking UI
                this._GLib.idle_add(this._GLib.PRIORITY_DEFAULT, () => {
                    this._handlePrefsWindow();
                    return this._GLib.SOURCE_REMOVE;
                });
                return this._Clutter.EVENT_STOP;
        }

        return this._Clutter.EVENT_PROPAGATE;
    }

    // ───────────────────────────────────────────────────────────
    // Panel lifecycle
    // ───────────────────────────────────────────────────────────

    addToPanel() {
        const role = `${this._extension._extensionName} Indicator`;

        const positions = ["left", "left", "center", "right", "right"];
        const offsets = [0, 1, 0, 0, 1];

        this._createPanelButton();

        this._Main.panel.addToStatusArea(
            role,
            this._panelButton,
            offsets[this._extension._settings.get_enum("button-position")],
            positions[this._extension._settings.get_enum("button-position")]
        );
    }

    destroy() {
        if (!this._panelButton) return;

        if (this._hoverHandler) {
            this._hoverHandler.detach(this._panelButton);
        }

        if (this._buttonSignal) {
            this._panelButton.disconnect(this._buttonSignal);
            this._buttonSignal = null;
        }

        if (this._prefsWindow && this._prefsWindowSignal) {
            this._prefsWindow.disconnect(this._prefsWindowSignal);
            this._prefsWindowSignal = null;
        }

        this._panelButton.destroy();
        this._panelButton = null;
        this._panelIcon = null;
        this._panelBadge = null;

        this._prefsWindow = null;
        this._prefsOpenedByExtension = false;
    }

    // ───────────────────────────────────────────────────────────
    // Icon + badge updates
    // ───────────────────────────────────────────────────────────

    updateIcon() {
        if (!this._panelIcon || !this._panelBadge || !this._extension)
            return;

        const workspace = this._workspace_manager.get_active_workspace();
        const wsIndex = workspace.index();

        const count = this._windowManager.getHiddenCountForWorkspace(wsIndex);
        const hasHidden = count > 0;

        this._updateIconName(hasHidden);
        this._updateBadge(hasHidden, count);
    }

    /**
     * Updates the icon based on icon-style and hidden window count.
     */
    _updateIconName(hasHidden) {
        const iconStyle = this._extension._settings.get_enum("icon-style");

        switch (iconStyle) {
            case IconStyle.AUTO:
                this._panelIcon.icon_name = hasHidden
                    ? "user-desktop-symbolic"
                    : "computer-symbolic";
                break;

            case IconStyle.DESKTOP:
                this._panelIcon.icon_name = "user-desktop-symbolic";
                break;

            case IconStyle.COMPUTER:
                this._panelIcon.icon_name = "computer-symbolic";
                break;

            default:
                this._panelIcon.icon_name = "computer-symbolic";
        }
    }

    /**
     * Updates the numeric badge showing hidden window count.
     */
    _updateBadge(hasHidden, count) {
        const showCount = this._extension._settings.get_boolean("show-hidden-count");

        this._panelBadge.visible = showCount && hasHidden;
        this._panelBadge.text = showCount && hasHidden ? `${count}` : "";
    }
}
