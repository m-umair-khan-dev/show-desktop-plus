import DockIndicator, { DockPosition } from './dockIndicator.js';

const DOCK_UUIDS = [
    'ubuntu-dock@ubuntu.com',
    'dash-to-dock@micxgx.gmail.com',
];

/**
 * Handles discovery, attachment, and dynamic lifecycle integration with
 * Ubuntu Dock and Dash-to-Dock.
 */
export default class DockIntegration {
    constructor(windowManager, stateStore, extension, gnomeUI, hoverHandler = null) {
        this._windowManager = windowManager;
        this._stateStore = stateStore;
        this._extension = extension;
        this._gnomeUI = gnomeUI;
        this._hoverHandler = hoverHandler;

        this._Main = gnomeUI.Main;
        this._dockIndicators = [];
        this._extensionListenerId = null;
        this._onDockChanged = null;

        this._listenToExtensionState();
    }

    _listenToExtensionState() {
        if (!this._Main?.extensionManager)
            return;

        try {
            this._extensionListenerId = this._Main.extensionManager.connect(
                'extension-state-changed',
                (_mgr, ext) => {
                    if (ext && DOCK_UUIDS.includes(ext.uuid)) {
                        this._onDockChanged?.();
                    }
                }
            );
        } catch {}
    }

    setDockChangedCallback(callback) {
        this._onDockChanged = callback;
    }

    getDockStatus() {
        if (!this._Main?.extensionManager) {
            return {
                available: false,
                status: 'not-installed',
                message: 'ExtensionManager is not available.',
            };
        }

        for (const uuid of DOCK_UUIDS) {
            const ext = this._Main.extensionManager.lookup(uuid);
            if (ext) {
                // ExtensionState.ENABLED is 1
                const isEnabled = ext.state === 1 || ext.state === 'ENABLED';
                if (isEnabled) {
                    return {
                        available: true,
                        status: 'active',
                        uuid,
                        message: `Active (${uuid})`,
                    };
                } else {
                    return {
                        available: false,
                        status: 'disabled',
                        uuid,
                        message: `Installed but disabled (${uuid})`,
                    };
                }
            }
        }

        return {
            available: false,
            status: 'not-installed',
            message: 'Ubuntu Dock / Dash to Dock not detected',
        };
    }

    isDockAvailable() {
        return this.getDockStatus().available;
    }

    /**
     * Finds all dash containers (_dashContainer) across active docks.
     */
    async findDockContainers() {
        const containers = [];

        // Method 1: Check active dock extension
        for (const uuid of DOCK_UUIDS) {
            const ext = this._Main?.extensionManager?.lookup(uuid);
            const isEnabled = ext && (ext.state === 1 || ext.state === 'ENABLED');
            if (!isEnabled)
                continue;

            try {
                if (ext.path) {
                    const dockingModule = await import(`file://${ext.path}/docking.js`);
                    const dockManager = dockingModule.DockManager?.getDefault?.();
                    const docks = dockManager?._allDocks || [];
                    for (const dock of docks) {
                        const container = dock.dash?._container || dock.dash?._dashContainer;
                        if (container && !containers.includes(container)) {
                            containers.push(container);
                        }
                    }
                }
            } catch {}

            // Try stateObj.dockManager if present
            if (containers.length === 0 && ext.stateObj?.dockManager) {
                const docks = ext.stateObj.dockManager._allDocks || [];
                for (const dock of docks) {
                    const container = dock.dash?._container || dock.dash?._dashContainer;
                    if (container && !containers.includes(container)) {
                        containers.push(container);
                    }
                }
            }
        }

        // Method 2: Fallback to scene graph traversal
        if (containers.length === 0 && this._Main?.layoutManager?.uiGroup) {
            const findContainersRecursively = (actor) => {
                if (!actor) return;
                if (actor.name === 'dashtodockDashContainer') {
                    if (!containers.includes(actor))
                        containers.push(actor);
                    return;
                }
                const children = actor.get_children ? actor.get_children() : [];
                for (const child of children) {
                    findContainersRecursively(child);
                }
            };

            findContainersRecursively(this._Main.layoutManager.uiGroup);
        }

        return containers;
    }

    async attach(dockPosition = DockPosition.EXTREME_END) {
        this.detach();

        const containers = await this.findDockContainers();
        if (containers.length === 0)
            return false;

        for (const container of containers) {
            const indicator = new DockIndicator(
                this._windowManager,
                this._stateStore,
                this._extension,
                this._gnomeUI,
                this._hoverHandler
            );
            indicator.attachToContainer(container, dockPosition);
            this._dockIndicators.push(indicator);
        }

        return true;
    }

    updateIcons() {
        for (const ind of this._dockIndicators) {
            ind.updateIcon();
        }
    }

    detach() {
        for (const ind of this._dockIndicators) {
            ind.destroy();
        }
        this._dockIndicators = [];
    }

    destroy() {
        if (this._extensionListenerId && this._Main?.extensionManager) {
            try {
                this._Main.extensionManager.disconnect(this._extensionListenerId);
            } catch {}
            this._extensionListenerId = null;
        }

        this.detach();
        this._onDockChanged = null;
    }
}

