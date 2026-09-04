import { vi } from 'vitest';
import { Meta } from '../mocks/gnome/meta.js';
import StateStore from '../../core/stateStore.js';

export function createWindow(id, opts = {}) {
    return {
        id,
        minimized: false,
        skip_taskbar: !!opts.skip_taskbar,
        window_type: opts.window_type ?? Meta.WindowType.NORMAL,
        monitor: opts.monitor ?? 0,

        get_id: () => id,
        get_monitor: () => opts.monitor ?? 0,
        located_on_workspace: () => true,

        get_title: typeof opts.get_title === 'function'
            ? opts.get_title
            : () => opts.title ?? "",

        get_wm_class: typeof opts.get_wm_class === 'function'
            ? opts.get_wm_class
            : () => opts.wm_class ?? "",

        get_workspace: () => opts.workspace ?? null,

        minimize: vi.fn(function () { this.minimized = true }),
        unminimize: vi.fn(function () { this.minimized = false }),
        activate: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
    };
}

export function createStore() {
    return new StateStore();
}
