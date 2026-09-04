import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';
import PanelIndicator from '../../../core/panelIndicator.js';

describe('PanelIndicator – right-click prefs safety', () => {
    let g;
    let mockExtension;
    let indicator;

    beforeEach(() => {
        g = createMockGnomeAPI();

        g.GLib.idle_add = vi.fn((priority, fn) => {
            fn();
            return 1;
        });

        g.get_window_actors = vi.fn(() => []);

        globalThis.St = g.St;
        globalThis.Clutter = g.Clutter;
        globalThis.PanelMenu = g.PanelMenu;
        globalThis.Main = g.Main;
        globalThis.GLib = g.GLib;
        globalThis.Meta = g.Meta;
        globalThis.global = g;
        globalThis.log = vi.fn();

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
            {},
            {},
            mockExtension,
            g
        );

        indicator.addToPanel();
    });

    it('opens preferences when no valid prefs window exists', async () => {

        g.Clutter.BUTTON_SECONDARY = 3;

        indicator._panelButton.emit('button-press-event', {
            get_button: () => 3,
        });


        await new Promise(r => setTimeout(r, 0));

        expect(mockExtension.openPreferences).toHaveBeenCalledTimes(1);
    });
});
