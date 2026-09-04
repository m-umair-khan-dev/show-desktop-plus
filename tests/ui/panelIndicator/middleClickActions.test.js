import { describe, it, expect, vi, beforeEach } from 'vitest';
import PanelIndicator from '../../../core/panelIndicator.js';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';

describe('PanelIndicator – middle‑click behavior', () => {
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
                if (signal === 'button-press-event') clickHandler = handler;
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

    const clickMiddle = () =>
        clickHandler(null, { get_button: () => 2 });

    it('middle-click: hide all windows', () => {
        mockExtension._settings.get_enum.mockReturnValue(0);

        clickMiddle();

        expect(mockWindowManager.hideAllWindows).toHaveBeenCalledTimes(1);
    });

    it('middle-click: hide focused window', () => {
        mockExtension._settings.get_enum.mockReturnValue(1);

        clickMiddle();

        expect(mockWindowManager.addCurrentWindowToHidden).toHaveBeenCalledTimes(1);
    });

    it('middle-click: toggle desktop', () => {
        mockExtension._settings.get_enum.mockReturnValue(2);

        clickMiddle();

        expect(mockWindowManager.toggleDesktop).toHaveBeenCalledTimes(1);
    });

    it('middle-click does NOT trigger left-click actions', () => {
        mockExtension._settings.get_enum.mockReturnValue(0);

        clickMiddle();

        expect(mockWindowManager.restoreAllWindows).not.toHaveBeenCalled();
    });

    it('middle-click does NOT trigger right-click actions', () => {
        mockExtension._settings.get_enum.mockReturnValue(0);

        clickMiddle();

        expect(mockWindowManager.restoreAllWindows).not.toHaveBeenCalled();
    });
});
