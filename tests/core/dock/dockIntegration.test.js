import { describe, test, expect, beforeEach, vi } from 'vitest';
import DockIntegration from '../../../core/dockIntegration.js';
import { DockPosition } from '../../../core/dockIndicator.js';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';

describe('DockIntegration', () => {
    let integration, windowManager, stateStore, extension, gnomeUI, extensionManager;

    beforeEach(() => {
        extension = {
            metadata: { name: 'Show Desktop Plus' },
            _settings: {
                get_enum: vi.fn(() => 0),
                get_boolean: vi.fn(() => true),
            },
        };

        windowManager = {
            toggleDesktop: vi.fn(),
            getHiddenCountForWorkspace: vi.fn(() => 0),
        };

        stateStore = {};
        gnomeUI = createMockGnomeAPI([]);

        extensionManager = {
            _extensions: new Map(),
            lookup: vi.fn((uuid) => extensionManager._extensions.get(uuid) || null),
            connect: vi.fn(() => 777),
            disconnect: vi.fn(),
        };

        gnomeUI.Main.extensionManager = extensionManager;

        integration = new DockIntegration(windowManager, stateStore, extension, gnomeUI);
    });

    test('getDockStatus reports not-installed when dock extension not found', () => {
        const status = integration.getDockStatus();
        expect(status.available).toBe(false);
        expect(status.status).toBe('not-installed');
    });

    test('getDockStatus reports disabled when dock extension is disabled', () => {
        extensionManager._extensions.set('ubuntu-dock@ubuntu.com', {
            state: 0, // disabled
        });

        const status = integration.getDockStatus();
        expect(status.available).toBe(false);
        expect(status.status).toBe('disabled');
        expect(status.uuid).toBe('ubuntu-dock@ubuntu.com');
    });

    test('getDockStatus reports active when dock extension is enabled', () => {
        extensionManager._extensions.set('ubuntu-dock@ubuntu.com', {
            state: 1, // enabled
        });

        const status = integration.getDockStatus();
        expect(status.available).toBe(true);
        expect(status.status).toBe('active');
        expect(status.uuid).toBe('ubuntu-dock@ubuntu.com');
    });

    test('findDockContainers finds containers via ext.stateObj.dockManager._allDocks', async () => {
        const mockContainer = {
            insert_child_at_index: vi.fn(),
            add_child: vi.fn(),
            remove_child: vi.fn(),
        };

        extensionManager._extensions.set('ubuntu-dock@ubuntu.com', {
            state: 1,
            stateObj: {
                dockManager: {
                    _allDocks: [
                        { dash: { _dashContainer: mockContainer } },
                    ],
                },
            },
        });

        const containers = await integration.findDockContainers();
        expect(containers).toHaveLength(1);
        expect(containers[0]).toBe(mockContainer);
    });

    test('findDockContainers falls back to scene graph search if dockManager not exposed', async () => {
        const mockDashContainer = {
            name: 'dashtodockDashContainer',
            get_children: () => [],
            insert_child_at_index: vi.fn(),
            add_child: vi.fn(),
            remove_child: vi.fn(),
        };

        const parentActor = {
            name: 'dashtodockContainer',
            get_children: () => [mockDashContainer],
        };

        gnomeUI.Main.layoutManager = {
            uiGroup: {
                get_children: () => [parentActor],
            },
        };

        extensionManager._extensions.set('ubuntu-dock@ubuntu.com', {
            state: 1,
            stateObj: {},
        });

        const containers = await integration.findDockContainers();
        expect(containers).toHaveLength(1);
        expect(containers[0]).toBe(mockDashContainer);
    });

    test('attach() creates and attaches dock indicator', async () => {
        const mockContainer = {
            insert_child_at_index: vi.fn(),
            add_child: vi.fn(),
            remove_child: vi.fn(),
        };

        extensionManager._extensions.set('ubuntu-dock@ubuntu.com', {
            state: 1,
            stateObj: {
                dockManager: {
                    _allDocks: [{ dash: { _dashContainer: mockContainer } }],
                },
            },
        });

        const attached = await integration.attach(DockPosition.EXTREME_END);
        expect(attached).toBe(true);
        expect(integration._dockIndicators).toHaveLength(1);
        expect(mockContainer.add_child).toHaveBeenCalled();
    });

    test('destroy() cleans up indicators and disconnects listeners', () => {
        integration.destroy();

        expect(extensionManager.disconnect).toHaveBeenCalledWith(777);
        expect(integration._dockIndicators).toHaveLength(0);
    });
});

