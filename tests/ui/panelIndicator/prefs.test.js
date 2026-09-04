import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';
import { createMockWindow } from '../../mocks/gnome/window.js';
import PanelIndicator from '../../../core/panelIndicator.js';

describe('PanelIndicator preferences window behavior', () => {
        let g;
        let mockWindowManager;
        let mockExtension;
        let indicator;

        beforeEach(() => {
        g = createMockGnomeAPI();

        globalThis.St = g.St;
        globalThis.Clutter = g.Clutter;
        globalThis.PanelMenu = g.PanelMenu;
        globalThis.Main = g.Main;
        globalThis.GLib = g.GLib;
        globalThis.Meta = g.Meta;
        globalThis.display = g.display;
        globalThis.workspace_manager = g.workspace_manager;

        globalThis.log = vi.fn();

        // FIXED — initialize with an empty window list
        g.set_window_actors([]);

        mockWindowManager = {
            getHiddenCountForWorkspace: () => 0,
        };

        mockExtension = {
            _extensionName: 'show-desktop-plus',
            metadata: { name: 'show-desktop-plus' },
            _settings: {
                get_enum: vi.fn(() => 0),
                get_boolean: vi.fn(() => false),
            },
            openPreferences: vi.fn(),
        };

        indicator = new PanelIndicator(
            mockWindowManager,
            {},
            mockExtension,
            g
        );

        indicator.addToPanel();
    });


    it('opens preferences when no prefs window exists', () => {
        // keep SAME style (replace function, not mockReturnValue)
        g.display.get_tab_list = vi.fn(() => []);

        indicator._panelButton.emit('button-press-event', {
            get_button: () => 3,
        });

        expect(mockExtension.openPreferences).toHaveBeenCalledTimes(1);
    });

    it('focuses existing prefs window on same workspace', () => {
        const ws = g.workspace_manager.get_active_workspace();

        const prefsWin = createMockWindow(1, 0, {
            title: 'show-desktop-plus Preferences',
            wmClass: 'org.gnome.Shell.Extensions',
            workspace: ws.index(),
        });

        prefsWin.get_workspace = () => ws;

        g.set_window_actors([{ meta_window: prefsWin }]);

        indicator._panelButton.emit('button-press-event', {
            get_button: () => 3,
        });

        expect(prefsWin.activate).toHaveBeenCalledTimes(1);
        expect(mockExtension.openPreferences).not.toHaveBeenCalled();
    });

    it('moves prefs window to current workspace and activates it', () => {
        const wsCurrent = g.workspace_manager.get_active_workspace();

        const wsOther = {
            index: () => 1,
            list_windows: () => [],
        };

        const prefsWin = createMockWindow(1, 0, {
            title: 'show-desktop-plus Preferences',
            wmClass: 'org.gnome.Shell.Extensions',
            workspace: wsOther.index(),
        });

        prefsWin.get_workspace = () => wsOther;

        g.set_window_actors([{ meta_window: prefsWin }]);

        indicator._prefsOpenedByExtension = true;

        indicator._panelButton.emit('button-press-event', {
            get_button: () => 3,
        });

        expect(prefsWin.change_workspace).toHaveBeenCalledWith(wsCurrent);
        expect(prefsWin.activate).toHaveBeenCalledTimes(1);
        expect(mockExtension.openPreferences).not.toHaveBeenCalled();
    });
});
