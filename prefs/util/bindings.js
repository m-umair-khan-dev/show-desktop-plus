import Gio from 'gi://Gio';

/**
 * Binds a Gtk.DropDown (ComboRow) to a GSettings enum key.
 *
 * This binding is *manual* because Gtk.DropDown does not support
 * Gio.Settings.bind() directly for enum values.
 *
 * The pattern:
 *   - updateFromSettings(): sync widget when settings change
 *   - updateFromWidget(): sync settings when widget changes
 *   - `updating` flag prevents infinite loops
 */
export function bindComboRow(settings, key, row) {
    let updating = false;

    function updateFromSettings() {
        if (updating) return;
        updating = true;
        row.set_selected(settings.get_enum(key));
        updating = false;
    }

    function updateFromWidget() {
        if (updating) return;
        updating = true;
        settings.set_enum(key, row.get_selected());
        updating = false;
    }

    // Initial sync from settings → widget
    updateFromSettings();

    // Widget → Settings
    row.connect('notify::selected', updateFromWidget);

    // Settings → Widget
    settings.connect(`changed::${key}`, updateFromSettings);
}

/**
 * Binds a Gtk.Switch (SwitchRow) to a boolean GSettings key.
 *
 * Gtk.Switch supports Gio.Settings.bind() natively, so this is simple.
 */
export function bindSwitchRow(settings, key, row) {
    settings.bind(
        key,
        row,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );
}

/**
 * Binds an AdwSpinRow to a uint GSettings key.
 */
export function bindSpinRow(settings, key, row) {
    settings.bind(
        key,
        row,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );
}

