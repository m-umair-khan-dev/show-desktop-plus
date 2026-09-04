import { bindComboRow, bindSpinRow } from '../util/bindings.js';

/**
 * Initializes the “Controls” section of the preferences window.
 *
 * This section configures what happens when the user clicks or hovers over the icon:
 *   - left-click action
 *   - middle-click action
 *   - hover action (none, peek, toggle)
 *   - hover delay (milliseconds)
 *
 * Each row is bound to its corresponding GSettings key.
 */
export function initControls(builder, settings) {
    // ComboRow for selecting the left-click action
    const leftClickRow = builder.get_object('leftClickAction_row');

    // ComboRow for selecting the middle-click action
    const middleClickRow = builder.get_object('middleClickAction_row');

    // ComboRow for selecting the hover action
    const hoverActionRow = builder.get_object('hoverAction_row');

    // SpinRow for setting hover delay in milliseconds
    const hoverDelayRow = builder.get_object('hoverDelay_row');

    // Bind UI ↔ Settings
    bindComboRow(settings, 'left-click-action', leftClickRow);
    bindComboRow(settings, 'middle-click-action', middleClickRow);
    bindComboRow(settings, 'hover-action', hoverActionRow);
    bindSpinRow(settings, 'hover-delay', hoverDelayRow);
}

