export default class WindowManager {
    constructor(stateStore, extension, onStateChanged, gnome) {
        // Persistent state storage (per‑workspace hidden window maps)
        this._stateStore = stateStore;

        // Extension metadata + settings
        this._extension = extension;

        // Callback used by PanelIndicator to refresh the UI
        this._onStateChanged = onStateChanged;

        // GNOME Shell API bindings (injected for testability)
        this._Meta = gnome.Meta;
        this._Main = gnome.Main;
        this._workspace_manager = gnome.workspace_manager;
        this._display = gnome.display;
        this._get_current_time = gnome.get_current_time;

        // Signal tracking
        this._displaySignals = [];
        this._windowSignals = new Map();

        // Peek state tracking
        this._isPeeking = false;

        // Start listening for window events
        this._connectSignals();
    }

    // ───────────────────────────────────────────────────────────
    // Display‑level signal wiring
    // ───────────────────────────────────────────────────────────

    /**
     * Connects global display signals.
     * Currently only listens for "window-created" so we can track new windows.
     */
    _connectSignals() {
        const id = this._display.connect('window-created', (_d, win) => {
            this._trackWindow(win);
            this._onStateChanged();
        });

        this._displaySignals.push(id);
    }

    /**
     * Disconnects all display‑level signals.
     * Called during extension disable().
     */
    _disconnectDisplaySignals() {
        for (const id of this._displaySignals)
            this._display.disconnect(id);

        this._displaySignals = [];
    }

    // ───────────────────────────────────────────────────────────
    // Per‑window tracking
    // ───────────────────────────────────────────────────────────

    /**
     * Tracks a window so we can detect:
     *  - when it is unmanaged (closed)
     *  - when it becomes unminimized
     *
     * This allows us to keep the hidden‑window state accurate.
     */
    _trackWindow(win) {
        if (!win || win._dtpTracked) return;
        win._dtpTracked = true;

        const ids = [];

        // Window closed → remove from state
        ids.push(win.connect('unmanaged', () => {
            this._removeWindowFromState(win);
            this._onStateChanged();
        }));

        // Window restored manually → remove from state
        ids.push(win.connect('notify::minimized', () => {
            if (!win.minimized) {
                this._removeWindowFromState(win);
                this._onStateChanged();
            }
        }));

        this._windowSignals.set(win, ids);
    }

    /**
     * Disconnects all per‑window signals and clears tracking flags.
     */
    _disconnectWindowSignals() {
        for (const [win, ids] of this._windowSignals) {
            for (const id of ids)
                win.disconnect(id);

            delete win._dtpTracked;
        }

        this._windowSignals.clear();
    }

    /**
     * Called when the extension is disabled.
     * Ensures all signals are cleaned up.
     */
    disable() {
        if (this._isPeeking) {
            this.cancelPeek();
        }
        this._disconnectDisplaySignals();
        this._disconnectWindowSignals();
    }

    // ───────────────────────────────────────────────────────────
    // Window classification / ID / resolution
    // ───────────────────────────────────────────────────────────

    /**
     * Determines whether a window is a "normal" user window.
     * Hidden‑window logic only applies to normal windows.
     */
    _isNormalWindow(w) {
        return (
            w &&
            !w.minimized &&
            !w.skip_taskbar &&
            w.window_type === this._Meta.WindowType.NORMAL
        );
    }

    _shouldBeIgnored(w) {
        return !this._isNormalWindow(w);
    }

    /**
     * Safely retrieves a window's unique ID.
     * Some window actors may throw or not implement get_id().
     */
    _getWindowId(w) {
        try {
            return w?.get_id?.() ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Returns all workspaces, supporting both:
     *  - GNOME Shell with multiple workspaces
     *  - fallback environments with only one
     */
    _getAllWorkspaces() {
        const wm = this._workspace_manager;

        if (wm.get_n_workspaces) {
            return Array.from({ length: wm.n_workspaces }, (_, i) =>
                wm.get_workspace_by_index(i)
            );
        }

        return [wm.get_active_workspace()];
    }

    /**
     * Resolves a window ID back to a MetaWindow instance.
     * Used when restoring windows from stored state.
     */
    _resolveWindowById(id) {
        if (!id) return null;

        for (const ws of this._getAllWorkspaces()) {
            for (const w of ws.list_windows()) {
                if (this._getWindowId(w) === id)
                    return w;
            }
        }

        return null;
    }

    // ───────────────────────────────────────────────────────────
    // Workspace map helpers (stateStore)
    // ───────────────────────────────────────────────────────────

    /**
     * Removes a window ID from a workspace's hidden‑window map.
     */
    _removeIdFromWorkspaceMap(map, id) {
        for (const [key, list] of map.entries()) {
            const filtered = list.filter(wid => wid !== id);

            if (filtered.length > 0)
                map.set(key, filtered);
            else
                map.delete(key);
        }
    }

    /**
     * Cleans a workspace map by removing IDs that no longer resolve
     * (e.g., windows that were closed).
     */
    _cleanWorkspaceMap(map) {
        for (const [key, list] of map.entries()) {
            const filtered = list.filter(id => this._resolveWindowById(id));
            if (filtered.length > 0)
                map.set(key, filtered);
            else
                map.delete(key);
        }
    }

    /**
     * Ensures a workspace has a hidden‑window map.
     */
    _ensureWorkspaceMap(wsIndex) {
        let map = this._stateStore.getWorkspaceMap(wsIndex);
        if (!map) {
            map = new Map();
            this._stateStore.setWorkspaceMap(wsIndex, map);
        }
        return map;
    }

    _deleteWorkspaceIfEmpty(wsIndex, map) {
        if (map.size === 0)
            this._stateStore.deleteWorkspace(wsIndex);
    }

    // ───────────────────────────────────────────────────────────
    // Public API used by PanelIndicator
    // ───────────────────────────────────────────────────────────

    /**
     * Returns the number of hidden windows for a workspace.
     * Cleans stale IDs before counting.
     */
    getHiddenCountForWorkspace(wsIndex) {
        const map = this._stateStore.getWorkspaceMap(wsIndex);
        if (!map) return 0;

        this._cleanWorkspaceMap(map);

        let count = 0;
        for (const list of map.values())
            count += list.length;

        return count;
    }

    /**
     * Removes a window from all workspace maps.
     * Called when a window is closed or unminimized.
     */
    _removeWindowFromState(win) {
        const id = this._getWindowId(win);
        if (!id) return;

        for (const [wsIndex, map] of this._stateStore.entries()) {
            this._removeIdFromWorkspaceMap(map, id);
            this._deleteWorkspaceIfEmpty(wsIndex, map);
        }
    }

    // ───────────────────────────────────────────────────────────
    // Hiding / restoring / toggling
    // ───────────────────────────────────────────────────────────

    _getActiveWorkspaceIndex() {
        return this._workspace_manager.get_active_workspace().index();
    }

    _getMonitorKeyForWindow(win) {
        const ignoreExternal =
            this._extension._settings.get_boolean('current-monitor-only');

        return ignoreExternal ? win.get_monitor() : -1;
    }

    _getMonitorKeyForCurrentMonitor() {
        const ignoreExternal =
            this._extension._settings.get_boolean('current-monitor-only');

        const currentMonitor = this._display.get_current_monitor();
        return ignoreExternal ? currentMonitor : -1;
    }

    /**
     * Hides only the currently focused window.
     * Used by left/middle click actions.
     */
    addCurrentWindowToHidden() {
        const ws = this._workspace_manager.get_active_workspace();
        const wsIndex = ws.index();

        const focusWin = this._display.get_focus_window();
        if (!focusWin || this._shouldBeIgnored(focusWin)) return;

        const id = this._getWindowId(focusWin);
        if (!id) return;

        const map = this._ensureWorkspaceMap(wsIndex);
        const key = this._getMonitorKeyForWindow(focusWin);

        if (!map.has(key))
            map.set(key, []);

        const list = map.get(key);

        if (!list.includes(id)) {
            list.push(id);
            this._trackWindow(focusWin);
            focusWin.minimize();
        }

        this._onStateChanged();
    }

    /**
     * Hides all windows on the active workspace (optionally only on current monitor).
     * Stores their IDs so they can be restored later.
     */
    hideAllWindows() {
        const ws = this._workspace_manager.get_active_workspace();
        const wsIndex = ws.index();

        const windows = this._getWindowsToHide(ws);
        if (windows.length === 0) return;

        const map = this._buildHiddenMap(wsIndex, windows);
        this._stateStore.setWorkspaceMap(wsIndex, map);

        this._minimizeWindows(windows);
        this._hideOverviewIfVisible();

        this._onStateChanged();
    }

    /**
     * Returns the list of windows eligible to be hidden.
     */
    _getWindowsToHide(workspace) {
        const ignoreExternal =
            this._extension._settings.get_boolean('current-monitor-only');
        const currentMonitor = this._display.get_current_monitor();

        return this._display
            .sort_windows_by_stacking(workspace.list_windows())
            .filter(
                w =>
                    !this._shouldBeIgnored(w) &&
                    w.located_on_workspace(workspace) &&
                    (!ignoreExternal || w.get_monitor() === currentMonitor)
            );
    }

    /**
     * Builds the hidden‑window map for hideAllWindows().
     */
    _buildHiddenMap(wsIndex, windows) {
        const ignoreExternal =
            this._extension._settings.get_boolean('current-monitor-only');
        const currentMonitor = this._display.get_current_monitor();
        const key = ignoreExternal ? currentMonitor : -1;

        return new Map([
            [
                key,
                windows.map(w => this._getWindowId(w)).filter(Boolean)
            ]
        ]);
    }

    /**
     * Minimizes all windows and ensures they are tracked.
     */
    _minimizeWindows(windows) {
        for (const w of windows) {
            this._trackWindow(w);
            w.minimize();
        }
    }

    _hideOverviewIfVisible() {
        if (this._Main.overview.visible)
            this._Main.overview.hide();
    }

    /**
     * Restores all previously hidden windows on the active workspace.
     */
    restoreAllWindows() {
        const ws = this._workspace_manager.get_active_workspace();
        const wsIndex = ws.index();

        const map = this._stateStore.getWorkspaceMap(wsIndex);
        if (!map) return;

        const last = this._restoreWindowsFromMap(map);

        if (last)
            this._activateWindowSafely(last);

        this._stateStore.deleteWorkspace(wsIndex);
        this._hideOverviewIfVisible();

        this._onStateChanged();
    }

    /**
     * Unminimizes all windows stored in the workspace map.
     * Returns the last window restored (to activate it).
     */
    _restoreWindowsFromMap(map) {
        let last = null;

        for (const list of map.values()) {
            for (const id of list) {
                const w = this._resolveWindowById(id);
                if (!w) continue;

                try {
                    if (typeof w.unminimize === 'function')
                        w.unminimize();

                    last = w;
                } catch {}
            }
        }

        return last;
    }

    /**
     * Activates a window safely, ignoring activation errors.
     */
    _activateWindowSafely(win) {
        try {
            if (typeof win.activate === 'function')
                win.activate(this._get_current_time());
        } catch {}
    }

    /**
     * Toggles between:
     *  - hiding all windows
     *  - restoring all windows
     */
    toggleDesktop() {
        this._isPeeking = false;
        const wsIndex = this._getActiveWorkspaceIndex();

        if (!this._stateStore.getWorkspaceMap(wsIndex))
            this.hideAllWindows();
        else
            this.restoreAllWindows();
    }

    /**
     * Whether a temporary desktop peek is currently active.
     */
    get isPeeking() {
        return this._isPeeking;
    }

    /**
     * Temporarily shows the desktop by hiding windows.
     * If desktop is already shown, does nothing.
     */
    peekDesktop() {
        const wsIndex = this._getActiveWorkspaceIndex();
        if (this._stateStore.getWorkspaceMap(wsIndex))
            return;

        this.hideAllWindows();
        this._isPeeking = true;
        this._peekingWorkspaceIndex = wsIndex;
    }

    /**
     * Cancels an active peek, restoring the windows.
     */
    cancelPeek() {
        if (!this._isPeeking)
            return;

        this._isPeeking = false;

        if (this._peekingWorkspaceIndex !== undefined) {
            const map = this._stateStore.getWorkspaceMap(this._peekingWorkspaceIndex);
            if (map) {
                const last = this._restoreWindowsFromMap(map);
                if (last)
                    this._activateWindowSafely(last);
                this._stateStore.deleteWorkspace(this._peekingWorkspaceIndex);
                this._hideOverviewIfVisible();
                this._onStateChanged();
            }
            this._peekingWorkspaceIndex = undefined;
            return;
        }

        this.restoreAllWindows();
    }

    /**
     * Commits the peek state into a permanent show-desktop state
     * (e.g. if the user clicks while hovering).
     */
    commitPeek() {
        this._isPeeking = false;
        this._peekingWorkspaceIndex = undefined;
    }
}
