import { vi } from 'vitest';
import { Meta as MetaBase } from './meta.js';
import { createMockWorkspace } from './workspace.js';
import { createWindow } from '../../helpers/factories.js';

export function createMockGnomeAPI(workspacesOrWindows) {
    const first = workspacesOrWindows?.[0];

    const workspaces =
        first && typeof first.list_windows === 'function'
            ? workspacesOrWindows
            : [createMockWorkspace(0, workspacesOrWindows || [])];

    // -----------------------------
    // WORKSPACE MANAGER
    // -----------------------------
    const workspace_manager = {
        n_workspaces: workspaces.length,
        get_n_workspaces: () => workspaces.length,
        _active: 0,

        get_active_workspace: () => workspaces[workspace_manager._active],
        get_workspace_by_index: (i) => workspaces[i],

        switch_to(i) {
            if (i >= 0 && i < workspaces.length) {
                workspace_manager._active = i;
            }
        },

        _signals: {},

        connect: vi.fn(function (signal, handler) {
            this._signals[signal] = handler;
            return 999;
        }),

        emit(signal, ...args) {
            if (this._signals[signal]) {
                this._signals[signal](this, ...args);
            }
        },

        disconnect: vi.fn(),
    };

    // -----------------------------
    // DISPLAY (ONLY ONCE!)
    // -----------------------------
    const display = {
        _signals: {},

        _currentMonitor: 0,
        get_current_monitor() {
            return this._currentMonitor;
        },
        set_current_monitor(m) {
            this._currentMonitor = m;
        },

        get_focus_window: () => null,
        sort_windows_by_stacking: (ws) => ws,

        connect: vi.fn(function (signal, handler) {
            this._signals[signal] = handler;
            return 555;
        }),

        emit(signal, win, ...args) {
            if (this._signals[signal]) {
                this._signals[signal](this, win, ...args);
            }
        },

        get_tab_list: vi.fn(() => []),
        get_window_actors: vi.fn(() => []),
        disconnect: vi.fn(),
    };

    // -----------------------------
    // MAIN
    // -----------------------------
    const Main = {
        overview: { visible: false, hide: vi.fn() },
        panel: { addToStatusArea: vi.fn() },
        wm: { addKeybinding: vi.fn(), removeKeybinding: vi.fn() },
    };

    const PanelMenu = {
        Button: vi.fn(function () {
            this._signals = {};
            this._children = [];

            this.add_child = vi.fn((child) => {
                this._children.push(child);
            });

            this.remove_child = vi.fn((child) => {
                this._children = this._children.filter(c => c !== child);
            });

            this.connect = vi.fn((signal, handler) => {
                this._signals[signal] = handler;
                return 1;
            });

            this.disconnect = vi.fn();

            this.emit = (signal, ...args) => {
                if (this._signals[signal]) {
                    this._signals[signal](this, ...args);
                }
            };

            this.clear_actions = vi.fn(() => {
                this._signals = {};
            });

            this.destroy = vi.fn(() => {
                this._children = [];
                this._signals = {};
            });
        }),
    };
    
    const Clutter = {
        BinLayout: vi.fn(function BinLayout() {}),

        BUTTON_PRIMARY: 1,
        BUTTON_MIDDLE: 2,
        BUTTON_SECONDARY: 3,

        EVENT_STOP: 1,
        EVENT_PROPAGATE: 2,

        ActorAlign: {
            FILL: 0,
            START: 1,
            CENTER: 2,
            END: 3,
        },

        ModifierType: {
            SHIFT_MASK: 1 << 0,
            CONTROL_MASK: 1 << 1,
            MOD1_MASK: 1 << 2,
        },
    };
    
    

    class Widget {
        constructor(props = {}) {
            this.layout_manager = props.layout_manager;
            this.reactive = props.reactive;

            this._children = [];

            this.add_child = vi.fn((child) => {
                this._children.push(child);
            });

            this.remove_child = vi.fn((child) => {
                this._children = this._children.filter(c => c !== child);
            });

            this.destroy = vi.fn(() => {
                this._children = [];
            });

            this.clear_actions = vi.fn();
        }
    }

    const St = {
        Widget,
        Button: vi.fn(function Button(props = {}) {
            this._signals = {};
            this.reactive = props.reactive;
            this.can_focus = props.can_focus;
            this.track_hover = props.track_hover;
            this._child = null;

            this.set_child = vi.fn((child) => {
                this._child = child;
            });
            this.get_parent = vi.fn(() => this._parent || null);
            this.connect = vi.fn((signal, handler) => {
                this._signals[signal] = handler;
                return 1;
            });
            this.disconnect = vi.fn();
            this.destroy = vi.fn();
        }),
        Icon: vi.fn(function Icon(props = {}) {
            this.icon_name = props.icon_name;
        }),
        Label: vi.fn(function Label(props = {}) {
            this.text = props.text;
        }),
    };
    
    const Shell = {
        ActionMode: {
            NORMAL: 1,
            OVERVIEW: 2,
            POPUP: 4,
        },
    };
    
    const idleQueue = [];
    
    const GLib = {
        PRIORITY_DEFAULT: 0,
        SOURCE_REMOVE: 0,

        idle_add(priority, callback) {
            const result = callback();
            return 1;
        },
        timeout_add(priority, ms, callback) { 
            // Run immediately
            callback();
            return 1;
        },
    };


    const Meta = {
        ...MetaBase,
        KeyBindingFlags: { NONE: 0, IGNORE_AUTOREPEAT: 1 },
        TabList: { NORMAL_ALL: 0 },
    };

    globalThis.log = vi.fn();

    return {
        Meta,
        Main,
        PanelMenu,
        St,
        Clutter,
        GLib,
        Shell,
        workspace_manager,
        display,

    // SINGLE SOURCE OF TRUTH
    get_window_actors: () => display.get_window_actors(),

    // Allow tests to override this cleanly
    set_window_actors(list) {
        display.get_window_actors = vi.fn(() => list);
    },

    get_current_time: () => Date.now(),
    };
}
