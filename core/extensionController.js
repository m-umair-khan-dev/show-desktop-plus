import StateStore from './stateStore.js';
import WindowManager from './windowManager.js';
import PanelIndicator from './panelIndicator.js';
import HotkeyManager from './hotkeyManager.js';
import HoverActionHandler from './hoverActionHandler.js';
import DockIntegration from './dockIntegration.js';
import { loadGnomeUI } from './gnomeUI.js';

const DisplayLocation = {
    PANEL: 0,
    DOCK: 1,
    BOTH: 2,
};

export default class ExtensionController {
    constructor(extension) {
        // Extension metadata + settings
        this._extension = extension;

        // Persistent hidden-window state
        this._stateStore = new StateStore();

        // Runtime components (initialized in enable())
        this._windowManager = null;
        this._panelIndicator = null;
        this._dockIntegration = null;
        this._hoverHandler = null;
        this._hotkeyManager = null;
        this._gnomeUI = null;

        // Signal tracking
        this._workspaceSignal = null;
        this._settingsSignals = [];

        // Concurrency guard
        this._isUpdatingIndicators = false;
        this._needsReupdate = false;
        this._enabled = false;
    }

    /**
     * Main entry point when the extension is enabled.
     * Wires together:
     *  - GNOME UI bindings
     *  - WindowManager
     *  - HoverActionHandler
     *  - PanelIndicator
     *  - DockIntegration
     *  - HotkeyManager
     *  - workspace + settings signals
     */
    async enable() {
        this._gnomeUI = await loadGnomeUI();

        this._hoverHandler = new HoverActionHandler(
            null,
            this._extension,
            this._gnomeUI
        );

        this._windowManager = new WindowManager(
            this._stateStore,
            this._extension,
            () => this._updateAllIcons(),
            this._gnomeUI
        );

        this._hoverHandler._windowManager = this._windowManager;

        this._panelIndicator = new PanelIndicator(
            this._windowManager,
            this._stateStore,
            this._extension,
            this._gnomeUI,
            this._hoverHandler
        );

        this._dockIntegration = new DockIntegration(
            this._windowManager,
            this._stateStore,
            this._extension,
            this._gnomeUI,
            this._hoverHandler
        );

        this._dockIntegration.setDockChangedCallback(() => {
            this._updateIndicators().catch(() => {});
        });

        this._hotkeyManager = new HotkeyManager(
            this._windowManager,
            this._extension,
            this._gnomeUI
        );

        this._hotkeyManager.enable();

        this._enabled = true;

        // Update indicators based on display-location setting
        await this._updateIndicators();

        // Update icon when workspace changes
        this._workspaceSignal = this._gnomeUI.workspace_manager.connect(
            'active-workspace-changed',
            () => this._updateAllIcons()
        );

        this._connectSettings();
    }

    /**
     * Updates visibility and attachment of panel and dock indicators.
     */
    async _updateIndicators() {
        if (!this._enabled || !this._panelIndicator || !this._dockIntegration)
            return;

        if (this._isUpdatingIndicators) {
            this._needsReupdate = true;
            return;
        }

        this._isUpdatingIndicators = true;
        try {
            let location = DisplayLocation.PANEL;
            try {
                const val = this._extension._settings.get_enum('display-location');
                if (typeof val === 'number' && !isNaN(val))
                    location = val;
            } catch {}

            let dockPos = 1;
            try {
                const val = this._extension._settings.get_enum('dock-position');
                if (typeof val === 'number' && !isNaN(val))
                    dockPos = val;
            } catch {}

            if (location === DisplayLocation.PANEL) {
                this._dockIntegration.detach();
                this._panelIndicator.addToPanel();
            } else if (location === DisplayLocation.DOCK) {
                const attached = await this._dockIntegration.attach(dockPos);
                if (attached) {
                    this._panelIndicator.destroy();
                } else {
                    // Fallback to panel if dock is not available
                    this._panelIndicator.addToPanel();
                }
            } else if (location === DisplayLocation.BOTH) {
                this._panelIndicator.addToPanel();
                await this._dockIntegration.attach(dockPos);
            }

            this._updateAllIcons();
        } catch {
            // Guard against unhandled promise rejections
        } finally {
            this._isUpdatingIndicators = false;
            if (this._needsReupdate) {
                this._needsReupdate = false;
                try {
                    await this._updateIndicators();
                } catch {}
            }
        }
    }

    /**
     * Refreshes icon and badge count across all active indicators.
     */
    _updateAllIcons() {
        this._panelIndicator?.updateIcon?.();
        this._dockIntegration?.updateIcons?.();
    }

    /**
     * Called when the extension is disabled.
     * Ensures all signals and components are safely torn down.
     */
    disable() {
        this._enabled = false;
        if (this._workspaceSignal) {
            this._gnomeUI.workspace_manager.disconnect(this._workspaceSignal);
            this._workspaceSignal = null;
        }

        // Disconnect all settings signals
        for (const id of this._settingsSignals) {
            this._extension._settings.disconnect(id);
        }

        this._settingsSignals = [];

        this._hotkeyManager?.disable();
        this._hotkeyManager = null;

        this._windowManager?.disable?.();
        this._windowManager = null;

        this._dockIntegration?.destroy?.();
        this._dockIntegration = null;

        this._panelIndicator?.destroy?.();
        this._panelIndicator = null;

        this._hoverHandler?.destroy?.();
        this._hoverHandler = null;

        // Clear hidden-window state
        this._stateStore.clear();
    }

    /**
     * Connects settings keys to their respective update handlers.
     * Ensures UI reacts immediately to settings changes.
     */
    _connectSettings() {
        const connectChanged = (key, callback) => {
            const id = this._extension._settings.connect(`changed::${key}`, callback);
            this._settingsSignals.push(id);
        };

        connectChanged('icon-style', () => this._updateAllIcons());
        connectChanged('show-hidden-count', () => this._updateAllIcons());
        connectChanged('current-monitor-only', () => this._updateAllIcons());

        // Rebuild panel button when position changes
        connectChanged('button-position', () => {
            this._panelIndicator?.destroy?.();
            this._updateIndicators().catch(() => {});
        });

        connectChanged('display-location', () => this._updateIndicators().catch(() => {}));
        connectChanged('dock-position', () => this._updateIndicators().catch(() => {}));
    }
}
