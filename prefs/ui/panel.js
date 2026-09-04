import GLib from 'gi://GLib';
import { bindComboRow } from '../util/bindings.js';

function getDockStatusText() {
    const paths = [
        '/usr/share/gnome-shell/extensions/ubuntu-dock@ubuntu.com',
        '/usr/share/gnome-shell/extensions/dash-to-dock@micxgx.gmail.com',
        GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell', 'extensions', 'dash-to-dock@micxgx.gmail.com']),
        GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell', 'extensions', 'ubuntu-dock@ubuntu.com']),
    ];

    const exists = paths.some(p => GLib.file_test(p, GLib.FileTest.IS_DIR));
    if (exists) {
        return 'Detected on system. Button will attach to the dock container.';
    }
    return 'Not detected. If selected, button will safely fallback to the top panel.';
}

/**
 * Initializes the “Panel” section of the preferences window.
 *
 * This section controls where the indicator button appears on the GNOME panel.
 * The UI is defined in panel.ui, and this function simply binds the
 * Gtk.DropDown (ComboRow) to the corresponding GSettings enum key.
 * Initializes the “Placement” section of the preferences window.
 */
export function initPanel(builder, settings) {
    // ComboRow for selecting the panel button position (left / center / right)
    const positionRow = builder.get_object('panelButtonPosition_row');
    const locationRow = builder.get_object('displayLocation_row');
    const panelPositionRow = builder.get_object('panelButtonPosition_row');
    const dockPositionRow = builder.get_object('dockPosition_row');
    const dockStatusRow = builder.get_object('dockStatus_row');

    // Bind UI ↔ Settings
    bindComboRow(settings, 'button-position', positionRow);
    if (dockStatusRow) {
        dockStatusRow.set_subtitle(getDockStatusText());
    }

    function updateRowVisibility() {
        const location = settings.get_enum('display-location');
        // 0: panel, 1: dock, 2: both
        if (panelPositionRow)
            panelPositionRow.visible = (location === 0 || location === 2);

        if (dockPositionRow)
            dockPositionRow.visible = (location === 1 || location === 2);

        if (dockStatusRow)
            dockStatusRow.visible = (location === 1 || location === 2);
    }

    if (locationRow) {
        bindComboRow(settings, 'display-location', locationRow);
    }
    if (panelPositionRow) {
        bindComboRow(settings, 'button-position', panelPositionRow);
    }
    if (dockPositionRow) {
        bindComboRow(settings, 'dock-position', dockPositionRow);
    }

    updateRowVisibility();
    settings.connect('changed::display-location', updateRowVisibility);
}

