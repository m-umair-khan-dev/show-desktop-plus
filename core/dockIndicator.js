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

export const DockPosition = {
    EXTREME_START: 0,
    EXTREME_END: 1,
};

/**
 * Manages the Show Desktop button inside Ubuntu Dock / Dash-to-Dock.
 */
export default class DockIndicator {
    constructor(windowManager, stateStore, extension, gnomeUI, hoverHandler = null) {
        this._windowManager = windowManager;
        this._stateStore = stateStore;
        this._extension = extension;
        this._hoverHandler = hoverHandler;

        // GNOME Shell bindings
        this._St = gnomeUI.St;
        this._Clutter = gnomeUI.Clutter;
        this._GLib = gnomeUI.GLib;
        this._Main = gnomeUI.Main;
        this._workspace_manager = gnomeUI.workspace_manager;
        this._get_window_actors = gnomeUI.get_window_actors;
        this._get_current_time = gnomeUI.get_current_time;

        // UI elements
        this._dockButton = null;
        this._dockIcon = null;
        this._dockBadge = null;
        this._parentContainer = null;

        // Signals
        this._buttonSignal = null;
        this._prefsHandling = false;
        this._prefsWindow = null;
        this._prefsWindowSignal = null;
    }

    /**
     * Attaches the button to a dock container (_dashContainer).
     */
    attachToContainer(container, dockPosition = DockPosition.EXTREME_END) {
        if (!container)
            return;

        this.destroy();
        this._parentContainer = container;

        // Clean up any stale or duplicate Show Desktop buttons in this container
        const existingChildren = container.get_children ? container.get_children() : [];
        for (const child of existingChildren) {
            if (child?._isDesktopButton || child?.has_style_class_name?.('show-desktop-dock-button')) {
                try {
                    container.remove_child(child);
                    child.destroy?.();
                } catch {}
            }
        }

        this._createDockButton();
        this._dockButton._isDesktopButton = true;

        if (dockPosition === DockPosition.EXTREME_START) {
            container.insert_child_at_index(this._dockButton, 0);
        } else {
            container.add_child(this._dockButton);
        }

        this.updateIcon();
    }

    _createDockButton() {
        if (this._dockButton)
            return;

        this._dockButton = new this._St.Button({
            style_class: 'show-desktop-dock-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_align: this._Clutter.ActorAlign.CENTER,
            y_align: this._Clutter.ActorAlign.CENTER,
        });

        const box = new this._St.Widget({
            layout_manager: new this._Clutter.BinLayout(),
            reactive: false,
        });

        this._dockIcon = new this._St.Icon({
            icon_name: 'computer-symbolic',
            style_class: 'show-desktop-dock-icon',
            icon_size: 24,
        });

        this._dockBadge = new this._St.Label({
            style_class: 'desktop-toggle-badge',
            visible: false,
            reactive: false,
        });

        box.add_child(this._dockIcon);
        box.add_child(this._dockBadge);
        this._dockButton.set_child(box);

        this._connectButtonEvents();
    }

    _connectButtonEvents() {
        if (this._hoverHandler) {
            this._hoverHandler.attach(this._dockButton);
        }

        this._buttonSignal = this._dockButton.connect(
            'button-release-event',
            (_, event) => this._handleButtonEvent(event)
        );
    }

    _handleButtonEvent(event) {
        const wasPeeking = this._hoverHandler ? this._hoverHandler.handleClick() : false;
        this._hoverHandler?.resetCommittedPeek?.();

        const button = event.get_button();

        switch (button) {
            case this._Clutter.BUTTON_PRIMARY: {
                const action = this._extension._settings.get_enum('left-click-action');
                if (wasPeeking && (action === LeftClickAction.TOGGLE_DESKTOP || action === LeftClickAction.HIDE_ALL)) {
                    this.updateIcon();
                    return this._Clutter.EVENT_STOP;
                }
                this._handleLeftClick(action);
                return this._Clutter.EVENT_STOP;
            }

            case this._Clutter.BUTTON_MIDDLE: {
                const action = this._extension._settings.get_enum('middle-click-action');
                if (wasPeeking && (action === MiddleClickAction.TOGGLE_DESKTOP || action === MiddleClickAction.HIDE_ALL)) {
                    this.updateIcon();
                    return this._Clutter.EVENT_STOP;
                }
                this._handleMiddleClick(action);
                return this._Clutter.EVENT_STOP;
            }

            case this._Clutter.BUTTON_SECONDARY:
                this._GLib.idle_add(this._GLib.PRIORITY_DEFAULT, () => {
                    this._handlePrefsWindow();
                    return this._GLib.SOURCE_REMOVE;
                });
                return this._Clutter.EVENT_STOP;
        }

        return this._Clutter.EVENT_PROPAGATE;
    }

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

    async _handlePrefsWindow() {
        if (this._prefsHandling)
            return;

        this._prefsHandling = true;
        try {
            const currentWs = this._workspace_manager.get_active_workspace();
            let prefsWin = this._findPrefsWindow();

            if (prefsWin) {
                this._focusWindow(prefsWin, currentWs);
                return;
            }

            this._safeOpenPreferences();
            prefsWin = this._findPrefsWindow();
            if (prefsWin) {
                this._focusWindow(prefsWin, currentWs);
            }
        } catch (err) {
            console.error(err);
        } finally {
            this._prefsHandling = false;
        }
    }

    _safeOpenPreferences() {
        try {
            const result = this._extension.openPreferences();
            Promise.resolve(result).catch(err => console.error(err));
        } catch (err) {
            console.error(err);
        }
    }

    _findPrefsWindow() {
        const extName = this._extension.metadata.name;
        const windows = this._get_window_actors()
            .map(actor => actor.meta_window)
            .filter(w => w);

        return windows.find(w => {
            const title = w.get_title() || '';
            const wmClass = w.get_wm_class() || '';
            return wmClass === 'org.gnome.Shell.Extensions' && title.includes(extName);
        });
    }

    _focusWindow(win, currentWs) {
        if (win.get_workspace() !== currentWs)
            win.change_workspace(currentWs);

        try {
            win.activate(this._get_current_time());
        } catch {}
    }

    updateIcon() {
        if (!this._dockIcon || !this._dockBadge || !this._extension)
            return;

        const workspace = this._workspace_manager.get_active_workspace();
        const wsIndex = workspace.index();

        const count = this._windowManager.getHiddenCountForWorkspace(wsIndex);
        const hasHidden = count > 0;

        this._updateIconName(hasHidden);
        this._updateBadge(hasHidden, count);
    }

    _updateIconName(hasHidden) {
        const iconStyle = this._extension._settings.get_enum('icon-style');

        switch (iconStyle) {
            case IconStyle.AUTO:
                this._dockIcon.icon_name = hasHidden
                    ? 'user-desktop-symbolic'
                    : 'computer-symbolic';
                break;
            case IconStyle.DESKTOP:
                this._dockIcon.icon_name = 'user-desktop-symbolic';
                break;
            case IconStyle.COMPUTER:
                this._dockIcon.icon_name = 'computer-symbolic';
                break;
            default:
                this._dockIcon.icon_name = 'computer-symbolic';
        }
    }

    _updateBadge(hasHidden, count) {
        const showCount = this._extension._settings.get_boolean('show-hidden-count');
        this._dockBadge.visible = showCount && hasHidden;
        this._dockBadge.text = showCount && hasHidden ? `${count}` : '';
    }

    destroy() {
        if (!this._dockButton)
            return;

        if (this._hoverHandler) {
            this._hoverHandler.detach(this._dockButton);
        }

        if (this._buttonSignal) {
            this._dockButton.disconnect(this._buttonSignal);
            this._buttonSignal = null;
        }

        if (this._parentContainer && this._dockButton.get_parent() === this._parentContainer) {
            this._parentContainer.remove_child(this._dockButton);
        try {
            if (this._parentContainer && this._dockButton.get_parent() === this._parentContainer) {
                this._parentContainer.remove_child(this._dockButton);
            }
            this._dockButton.destroy();
        } catch (e) {
            // Ignore already disposed errors
        }

        this._dockButton.destroy();
        this._dockButton = null;
        this._dockIcon = null;
        this._dockBadge = null;
        this._parentContainer = null;
    }
}

