import { describe, test, expect, beforeEach, vi } from 'vitest';
import DockIndicator, { DockPosition } from '../../../core/dockIndicator.js';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';

describe('DockIndicator', () => {
    let indicator, windowManager, stateStore, extension, settings, gnomeUI, container;

    beforeEach(() => {
        settings = {
            get_enum: vi.fn((key) => {
                if (key === 'left-click-action') return 0; // toggle-desktop
                if (key === 'middle-click-action') return 0; // hide-all
                if (key === 'icon-style') return 0; // auto
                return 0;
            }),
            get_boolean: vi.fn((key) => {
                if (key === 'show-hidden-count') return true;
                return false;
            }),
        };

        extension = {
            metadata: { name: 'Show Desktop Plus' },
            _extensionName: 'Show Desktop Plus',
            _settings: settings,
            openPreferences: vi.fn(),
        };

        stateStore = {
            getWorkspaceMap: vi.fn(() => new Map()),
        };

        windowManager = {
            toggleDesktop: vi.fn(),
            hideAllWindows: vi.fn(),
            restoreAllWindows: vi.fn(),
            addCurrentWindowToHidden: vi.fn(),
            getHiddenCountForWorkspace: vi.fn(() => 2),
        };

        gnomeUI = createMockGnomeAPI([]);

        container = {
            _children: [],
            insert_child_at_index: vi.fn(function (child, idx) {
                this._children.splice(idx, 0, child);
            }),
            add_child: vi.fn(function (child) {
                this._children.push(child);
            }),
            remove_child: vi.fn(function (child) {
                this._children = this._children.filter(c => c !== child);
            }),
        };

        indicator = new DockIndicator(windowManager, stateStore, extension, gnomeUI);
    });

    test('attachToContainer with EXTREME_START inserts child at index 0', () => {
        indicator.attachToContainer(container, DockPosition.EXTREME_START);

        expect(container.insert_child_at_index).toHaveBeenCalledWith(
            indicator._dockButton,
            0
        );
        expect(indicator._dockButton).toBeTruthy();
    });

    test('attachToContainer with EXTREME_END appends child to container', () => {
        indicator.attachToContainer(container, DockPosition.EXTREME_END);

        expect(container.add_child).toHaveBeenCalledWith(indicator._dockButton);
    });

    test('primary click triggers left-click-action (toggleDesktop)', () => {
        indicator.attachToContainer(container);

        const handler = indicator._dockButton._signals['button-release-event'];
        expect(handler).toBeTruthy();

        const event = {
            get_button: () => gnomeUI.Clutter.BUTTON_PRIMARY,
        };

        const res = handler(indicator._dockButton, event);
        expect(windowManager.toggleDesktop).toHaveBeenCalledTimes(1);
        expect(res).toBe(gnomeUI.Clutter.EVENT_STOP);
    });

    test('primary click while peeking commits peek and does not restore windows', () => {
        const hoverHandler = {
            attach: vi.fn(),
            handleClick: vi.fn(() => true), // simulates committing active peek
        };

        const indicatorWithHover = new DockIndicator(
            windowManager,
            stateStore,
            extension,
            gnomeUI,
            hoverHandler
        );
        indicatorWithHover.attachToContainer(container);

        const handler = indicatorWithHover._dockButton._signals['button-release-event'];
        const event = {
            get_button: () => gnomeUI.Clutter.BUTTON_PRIMARY,
        };

        const res = handler(indicatorWithHover._dockButton, event);
        expect(hoverHandler.handleClick).toHaveBeenCalledTimes(1);
        expect(windowManager.toggleDesktop).not.toHaveBeenCalled();
        expect(res).toBe(gnomeUI.Clutter.EVENT_STOP);
    });

    test('middle click triggers middle-click-action (hideAllWindows)', () => {
        indicator.attachToContainer(container);

        const handler = indicator._dockButton._signals['button-release-event'];
        const event = {
            get_button: () => gnomeUI.Clutter.BUTTON_MIDDLE,
        };

        const res = handler(indicator._dockButton, event);
        expect(windowManager.hideAllWindows).toHaveBeenCalledTimes(1);
        expect(res).toBe(gnomeUI.Clutter.EVENT_STOP);
    });

    test('secondary click opens preferences window', () => {
        indicator.attachToContainer(container);

        const handler = indicator._dockButton._signals['button-release-event'];
        const event = {
            get_button: () => gnomeUI.Clutter.BUTTON_SECONDARY,
        };

        const res = handler(indicator._dockButton, event);
        expect(extension.openPreferences).toHaveBeenCalled();
        expect(res).toBe(gnomeUI.Clutter.EVENT_STOP);
    });

    test('updateIcon updates icon name and badge count', () => {
        indicator.attachToContainer(container);

        expect(indicator._dockIcon.icon_name).toBe('user-desktop-symbolic');
        expect(indicator._dockBadge.visible).toBe(true);
        expect(indicator._dockBadge.text).toBe('2');
    });

    test('destroy() cleans up button from container and disconnects signals', () => {
        indicator.attachToContainer(container);
        const button = indicator._dockButton;
        button._parent = container;

        indicator.destroy();

        expect(button.disconnect).toHaveBeenCalled();
        expect(button.destroy).toHaveBeenCalled();
        expect(indicator._dockButton).toBeNull();
    });
});

