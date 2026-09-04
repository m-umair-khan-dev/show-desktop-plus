import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExtensionController from '../../../core/extensionController.js';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';

vi.mock('../../../core/gnomeUI.js', () => ({
    loadGnomeUI: vi.fn(), 
}));

import { loadGnomeUI } from '../../../core/gnomeUI.js';

describe('ExtensionController – mutation‑driven tests', () => {
    let controller, extension, gnomeAPI, settings;

    beforeEach(() => {
        settings = {
            get_boolean: vi.fn(() => true),
            get_enum: vi.fn(() => 0),
            connect: vi.fn(() => 123),
            disconnect: vi.fn(),
        };

        extension = {
            _extensionName: 'TestExt',
            _settings: settings,
            openPreferences: vi.fn(),
        };

        gnomeAPI = createMockGnomeAPI([]);

        gnomeAPI.display.disconnect = vi.fn();

        vi.mocked(loadGnomeUI).mockResolvedValue(gnomeAPI);


        global.workspace_manager = gnomeAPI.workspace_manager;
        global.get_workspace_manager = () => gnomeAPI.workspace_manager;

        global.display = gnomeAPI.display;
        global.get_display = () => gnomeAPI.display;

        global.get_current_time = gnomeAPI.get_current_time;
        global.Main = gnomeAPI.Main;
        global.PanelMenu = gnomeAPI.PanelMenu;
        global.St = gnomeAPI.St;
        global.Clutter = gnomeAPI.Clutter;
        global.GLib = gnomeAPI.GLib;
        global.Meta = gnomeAPI.Meta;

        controller = new ExtensionController(extension);
    });

    it('invokes updateIcon when WindowManager triggers state change', async () => {
        await controller.enable();

        const spy = vi.spyOn(controller._panelIndicator, 'updateIcon');

        controller._windowManager._onStateChanged();

        expect(spy).toHaveBeenCalled();
    });

    it('reacts to settings changes by updating the icon', async () => {
        await controller.enable();

        const spy = vi.spyOn(controller._panelIndicator, 'updateIcon');

        const cb = settings.connect.mock.calls[0][1];
        cb();

        expect(spy).toHaveBeenCalled();
    });

    it('rebuilds panel button when button-position changes', async () => {
        await controller.enable();

        const destroySpy = vi.spyOn(controller._panelIndicator, 'destroy');
        const addSpy = vi.spyOn(controller._panelIndicator, 'addToPanel');
        const updateSpy = vi.spyOn(controller._panelIndicator, 'updateIcon');

        // Find the callback for button-position
        const cb = settings.connect.mock.calls.find(
            ([signal]) => signal === 'changed::button-position'
        )[1];

        // Reset spies so earlier calls don't interfere
        destroySpy.mockClear();
        addSpy.mockClear();
        updateSpy.mockClear();

        // Trigger the callback
        cb();

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(addSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });


    it('disable() works even if enable() was never called', () => {
        const fresh = new ExtensionController(extension);
        expect(() => fresh.disable()).not.toThrow();
    });

    it('disconnects all settings signals on disable()', async () => {
        await controller.enable();

        controller.disable();

        expect(settings.disconnect).toHaveBeenCalledTimes(6);
    });

    it('connects all expected settings keys', async () => {
        await controller.enable();

        const calls = settings.connect.mock.calls.map(([signal]) => signal);

        expect(calls).toContain('changed::icon-style');
        expect(calls).toContain('changed::show-hidden-count');
        expect(calls).toContain('changed::current-monitor-only');
        expect(calls).toContain('changed::button-position');
        expect(calls).toContain('changed::display-location');
        expect(calls).toContain('changed::dock-position');
    });
    
    it('updates icon when show-hidden-count changes', async () => {
        await controller.enable();

        const spy = vi.spyOn(controller._panelIndicator, 'updateIcon');

        // Find the callback for show-hidden-count
        const cb = settings.connect.mock.calls.find(
            ([signal]) => signal === 'changed::show-hidden-count'
        )[1];

        spy.mockClear();

        cb();

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('updates icon when current-monitor-only changes', async () => {
        await controller.enable();

        const spy = vi.spyOn(controller._panelIndicator, 'updateIcon');

        const cb = settings.connect.mock.calls.find(
            ([signal]) => signal === 'changed::current-monitor-only'
        )[1];

        spy.mockClear();

        cb();

        expect(spy).toHaveBeenCalledTimes(1);
    });

    
    it('updates icon when icon-style changes', async () => {
        await controller.enable();

        const spy = vi.spyOn(controller._panelIndicator, 'updateIcon');

        const cb = settings.connect.mock.calls.find(
            ([signal]) => signal === 'changed::icon-style'
        )[1];

        spy.mockClear();

        cb();

        expect(spy).toHaveBeenCalledTimes(1);
    });

});

