import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExtensionController from '../../../core/extensionController.js';

// ------------------------------------------------------------
// Vitest‑safe mocks
// ------------------------------------------------------------

vi.mock('../../../core/gnomeUI.js', () => ({
    loadGnomeUI: vi.fn(async () => ({
        Meta: {},
        Shell: {},
        Main: {
            wm: {
                addKeybinding: vi.fn(),
                removeKeybinding: vi.fn(),
            },
            panel: {
                addToStatusArea: vi.fn(),
            },
        },
        St: {
            Widget: vi.fn(),
            Icon: vi.fn(),
            Label: vi.fn(),
        },
        Clutter: {
            BinLayout: vi.fn(),
            EVENT_STOP: 1,
            EVENT_PROPAGATE: 2,
        },
        GLib: {
            PRIORITY_DEFAULT: 0,
            SOURCE_REMOVE: 0,
            idle_add: vi.fn((_, cb) => {
                cb();
                return 0;
            }),
        },

        workspace_manager: {
            connect: vi.fn(() => 123),
            disconnect: vi.fn(),
        },
    })),
}));

vi.mock('../../../core/panelIndicator.js', () => {
    const addToPanel = vi.fn();
    const destroy = vi.fn();
    const updateIcon = vi.fn();

    return {
        default: vi.fn().mockImplementation(() => ({
            addToPanel,
            destroy,
            updateIcon,
        })),
        __mocks: { addToPanel, destroy, updateIcon },
    };
});

vi.mock('../../../core/hotkeyManager.js', () => {
    const enable = vi.fn();
    const disable = vi.fn();

    return {
        default: vi.fn().mockImplementation(() => ({
            enable,
            disable,
        })),
        __mocks: { enable, disable },
    };
});

vi.mock('../../../core/stateStore.js', () => {
    const clear = vi.fn();

    return {
        default: vi.fn().mockImplementation(() => ({
            clear,
        })),
        __mocks: { clear },
    };
});

vi.mock('../../../core/windowManager.js', () => ({
    default: vi.fn().mockImplementation(() => ({})),
}));

// ------------------------------------------------------------
// Test Suite
// ------------------------------------------------------------

describe('ExtensionController lifecycle', () => {
    let controller;
    let mockExtension;

    beforeEach(() => {
        global.workspace_manager = { disconnect: vi.fn() };
        global.get_workspace_manager = () => global.workspace_manager;

        mockExtension = {
            _extensionName: 'show-desktop-plus',
            _settings: {
                connect: vi.fn(() => 42),
                disconnect: vi.fn(),
                get_enum: vi.fn(),
                get_boolean: vi.fn(),
            },
        };

        controller = new ExtensionController(mockExtension);
    });
    
    it('enable() wires everything correctly', async () => {
        const panelMocks = vi.mocked(
            await import('../../../core/panelIndicator.js')
        ).__mocks;

        const hotkeyMocks = vi.mocked(
            await import('../../../core/hotkeyManager.js')
        ).__mocks;

        await controller.enable();

        expect(panelMocks.addToPanel).toHaveBeenCalledTimes(1);
        expect(hotkeyMocks.enable).toHaveBeenCalledTimes(1);
        expect(panelMocks.updateIcon).toHaveBeenCalledTimes(1);

        const gnomeUI = await import('../../../core/gnomeUI.js');
        const loaded = await gnomeUI.loadGnomeUI.mock.results[0].value;
        const wsMgr = loaded.workspace_manager;

        expect(wsMgr.connect).toHaveBeenCalledTimes(1);
        expect(mockExtension._settings.connect).toHaveBeenCalledTimes(6);
    });

     it('disable() unwires everything correctly', async () => {
        const panelMocks = vi.mocked(
            await import('../../../core/panelIndicator.js')
        ).__mocks;

        const hotkeyMocks = vi.mocked(
            await import('../../../core/hotkeyManager.js')
        ).__mocks;

        const stateMocks = vi.mocked(
            await import('../../../core/stateStore.js')
        ).__mocks;

        await controller.enable();

        const wsMgr = controller._gnomeUI.workspace_manager;

        const id = wsMgr.connect.mock.results[0].value;

        controller.disable();

        expect(wsMgr.disconnect).toHaveBeenCalledWith(id);

        expect(mockExtension._settings.disconnect).toHaveBeenCalledTimes(6);
        expect(hotkeyMocks.disable).toHaveBeenCalledTimes(1);
        expect(panelMocks.destroy).toHaveBeenCalledTimes(1);
        expect(stateMocks.clear).toHaveBeenCalledTimes(1);
    });

    it('disable() is safe when called before enable()', () => {
        const fresh = new ExtensionController(mockExtension);

        expect(() => fresh.disable()).not.toThrow();
        expect(global.workspace_manager.disconnect).not.toHaveBeenCalled();
    });
});

