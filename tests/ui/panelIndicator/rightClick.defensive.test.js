import { describe, it, expect, beforeEach, vi } from 'vitest';
import PanelIndicator from '../../../core/panelIndicator.js';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';

describe('PanelIndicator – right-click defensive behavior', () => {
    let indicator, mockExtension, gnome, ws;

    function simulateRightClick() {
        const event = { get_button: () => 3 };
        indicator._panelButton.emit('button-press-event', event);
    }

    beforeEach(() => {
        gnome = createMockGnomeAPI([]);

        gnome.GLib.idle_add = vi.fn((prio, cb) => {
            cb();
            return 1;
        });

        gnome.GLib.timeout_add = vi.fn((prio, ms, cb) => {
            cb();
            return 1;
        });

        ws = { index: () => 0 };

        gnome.workspace_manager._active = 0;
        gnome.workspace_manager.get_workspace_by_index = () => ws;
        gnome.workspace_manager.get_active_workspace = () => ws;
        gnome.workspace_manager.n_workspaces = 1;

        mockExtension = {
            _extensionName: 'show-desktop-plus',
            metadata: { name: 'show-desktop-plus' },
            _settings: { get_enum: () => 0 },
            openPreferences: vi.fn(),
        };

        indicator = new PanelIndicator(
            {
                toggleDesktop: vi.fn(),
                hideAllWindows: vi.fn(),
                restoreAllWindows: vi.fn(),
                addCurrentWindowToHidden: vi.fn(),
            },
            { getHiddenCountForWorkspace: () => 0 },
            mockExtension,
            gnome
        );

        indicator._createPanelButton();
    });


    function withWindow(win) {
        win.connect = vi.fn(() => 1);
        win.disconnect = vi.fn();
        return win;
    }

    it('opens preferences when no prefs window exists', () => {
        gnome.set_window_actors([]);

        simulateRightClick();

        expect(mockExtension.openPreferences).toHaveBeenCalled();
    });

    it('focuses existing prefs window (get_title)', () => {
        const prefsWin = withWindow({
            get_title: () => 'show-desktop-plus Preferences',
            get_wm_class: () => 'org.gnome.Shell.Extensions',
            activate: vi.fn(),
            get_workspace: () => ws,
            change_workspace: vi.fn(),
        });

        gnome.set_window_actors([
            { meta_window: prefsWin },
        ]);

        simulateRightClick();

        expect(prefsWin.activate).toHaveBeenCalledWith(expect.any(Number));
    });

    it('falls back to openPreferences() if activate throws', async () => {
        const prefsWin = withWindow({
            get_title: () => 'show-desktop-plus Preferences',
            get_wm_class: () => 'org.gnome.Shell.Extensions',
            activate: function () { throw new Error('boom'); },
            get_workspace: () => ws,
            change_workspace: vi.fn(),
        });

        gnome.set_window_actors([{ meta_window: prefsWin }]);

        simulateRightClick();

        expect(mockExtension.openPreferences).toHaveBeenCalled();
    });
    
    it('falls back to openPreferences() if activate throws in second activation path', () => {
        const prefsWin = withWindow({
            get_title: () => 'show-desktop-plus Preferences',
            get_wm_class: () => 'org.gnome.Shell.Extensions',
            activate: () => { throw new Error('boom'); },
            get_workspace: () => ws,
            change_workspace: vi.fn(),
        });


        indicator._get_window_actors = vi
            .fn()
            .mockReturnValueOnce([]) 
            .mockReturnValueOnce([{ meta_window: prefsWin }]);

        simulateRightClick();

        expect(mockExtension.openPreferences).toHaveBeenCalledTimes(2);
    });
});

