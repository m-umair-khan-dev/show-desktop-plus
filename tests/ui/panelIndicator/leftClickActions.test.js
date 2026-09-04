import { describe, it, expect, vi, beforeEach } from 'vitest';
import PanelIndicator from '../../../core/panelIndicator.js';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';

describe('PanelIndicator – left‑click behavior', () => {
    let indicator;
    let mockWindowManager;
    let mockExtension;
    let g;
    let clickHandler;

    beforeEach(() => {
        g = createMockGnomeAPI([]);

        const OriginalButton = g.PanelMenu.Button;
        g.PanelMenu.Button = vi.fn(function () {
            this.connect = vi.fn((signal, handler) => {
                if (signal === 'button-release-event') clickHandler = handler;
                return 1;
            });
            this.add_child = vi.fn();
            this.clear_actions = vi.fn();
            this.destroy = vi.fn();
            this.reactive = true;
        });

        mockWindowManager = {
            hideAllWindows: vi.fn(),
            restoreAllWindows: vi.fn(),
            addCurrentWindowToHidden: vi.fn(),
            toggleDesktop: vi.fn(),
            getHiddenCountForWorkspace: vi.fn(() => 0),
        };

        mockExtension = {
            _extensionName: 'show-desktop-plus',
            _settings: {
                get_enum: vi.fn(),
                get_boolean: vi.fn(),
            },
        };

        indicator = new PanelIndicator(
            mockWindowManager,
            {},
            mockExtension,
            g
        );

        indicator._createPanelButton();
    });

    const clickLeft = () =>
        clickHandler(null, { get_button: () => 1 });

    it('left-click: toggle desktop', () => {
        mockExtension._settings.get_enum.mockReturnValue(0);

        clickLeft();

        expect(mockWindowManager.toggleDesktop).toHaveBeenCalledTimes(1);
    });

    it('left-click: hide all windows', () => {
        mockExtension._settings.get_enum.mockReturnValue(1);

        clickLeft();

        expect(mockWindowManager.hideAllWindows).toHaveBeenCalledTimes(1);
    });

    it('left-click: restore windows', () => {
        mockExtension._settings.get_enum.mockReturnValue(2);

        clickLeft();

        expect(mockWindowManager.restoreAllWindows).toHaveBeenCalledTimes(1);
    });

    it('left-click: hide focused window', () => {
        mockExtension._settings.get_enum.mockReturnValue(3);

        clickLeft();

        expect(mockWindowManager.addCurrentWindowToHidden).toHaveBeenCalledTimes(1);
    });

    it('left-click: none (do nothing)', () => {
        mockExtension._settings.get_enum.mockReturnValue(99);

        clickLeft();

        expect(mockWindowManager.hideAllWindows).not.toHaveBeenCalled();
        expect(mockWindowManager.restoreAllWindows).not.toHaveBeenCalled();
        expect(mockWindowManager.toggleDesktop).not.toHaveBeenCalled();
        expect(mockWindowManager.addCurrentWindowToHidden).not.toHaveBeenCalled();
    });

    it('left-click: commits peek when peeking and does not toggle/restore windows', () => {
        const hoverHandler = {
            attach: vi.fn(),
            handleClick: vi.fn(() => true),
        };

        const peekingIndicator = new PanelIndicator(
            mockWindowManager,
            {},
            mockExtension,
            g,
            hoverHandler
        );
        peekingIndicator._createPanelButton();

        mockExtension._settings.get_enum.mockReturnValue(0); // TOGGLE_DESKTOP

        clickLeft();

        expect(hoverHandler.handleClick).toHaveBeenCalledTimes(1);
        expect(mockWindowManager.toggleDesktop).not.toHaveBeenCalled();
    });
});
