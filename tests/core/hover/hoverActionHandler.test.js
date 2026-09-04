import { describe, test, expect, beforeEach, vi } from 'vitest';
import HoverActionHandler, { HoverAction } from '../../../core/hoverActionHandler.js';

describe('HoverActionHandler', () => {
    let handler, windowManager, extension, settings, gnomeUI, actor;

    beforeEach(() => {
        settings = {
            get_enum: vi.fn(() => HoverAction.PEEK),
            get_uint: vi.fn(() => 250),
        };

        extension = {
            _settings: settings,
        };

        windowManager = {
            isPeeking: false,
            peekDesktop: vi.fn(function () { this.isPeeking = true; }),
            cancelPeek: vi.fn(function () { this.isPeeking = false; }),
            commitPeek: vi.fn(function () { this.isPeeking = false; }),
            toggleDesktop: vi.fn(),
        };

        let timeoutCallback = null;
        gnomeUI = {
            GLib: {
                PRIORITY_DEFAULT: 0,
                SOURCE_REMOVE: 0,
                timeout_add: vi.fn((priority, delay, cb) => {
                    timeoutCallback = cb;
                    return 101;
                }),
                source_remove: vi.fn(),
            },
            _fireTimeout: () => {
                if (timeoutCallback) {
                    const cb = timeoutCallback;
                    timeoutCallback = null;
                    cb();
                }
            },
        };

        actor = {
            hover: false,
            reactive: false,
            track_hover: false,
            _signals: {},
            connect: vi.fn(function (signal, handler) {
                this._signals[signal] = handler;
                return 1;
            }),
            disconnect: vi.fn(function () {
                this._signals = {};
            }),
        };

        handler = new HoverActionHandler(windowManager, extension, gnomeUI);
    });

    test('attach() sets reactive and track_hover', () => {
        handler.attach(actor);

        expect(actor.reactive).toBe(true);
        expect(actor.track_hover).toBe(true);
        expect(actor.connect).toHaveBeenCalledWith('notify::hover', expect.any(Function));
    });

    test('hover enter triggers peek when delay expires', () => {
        handler.attach(actor);

        actor.hover = true;
        actor._signals['notify::hover']();

        expect(gnomeUI.GLib.timeout_add).toHaveBeenCalledWith(0, 250, expect.any(Function));
        expect(windowManager.peekDesktop).not.toHaveBeenCalled();

        gnomeUI._fireTimeout();
        expect(windowManager.peekDesktop).toHaveBeenCalledTimes(1);
        expect(windowManager.isPeeking).toBe(true);
    });

    test('hover enter triggers toggle when action is TOGGLE', () => {
        settings.get_enum.mockReturnValue(HoverAction.TOGGLE);
        handler.attach(actor);

        actor.hover = true;
        actor._signals['notify::hover']();

        gnomeUI._fireTimeout();
        expect(windowManager.toggleDesktop).toHaveBeenCalledTimes(1);
    });

    test('hover enter does nothing when action is NONE', () => {
        settings.get_enum.mockReturnValue(HoverAction.NONE);
        handler.attach(actor);

        actor.hover = true;
        actor._signals['notify::hover']();

        expect(gnomeUI.GLib.timeout_add).not.toHaveBeenCalled();
    });

    test('hover leave cancels pending timeout before firing', () => {
        handler.attach(actor);

        actor.hover = true;
        actor._signals['notify::hover']();

        actor.hover = false;
        actor._signals['notify::hover']();

        expect(gnomeUI.GLib.source_remove).toHaveBeenCalledWith(101);
        expect(windowManager.peekDesktop).not.toHaveBeenCalled();
    });

    test('hover leave cancels peek if currently peeking', () => {
        handler.attach(actor);

        actor.hover = true;
        actor._signals['notify::hover']();
        gnomeUI._fireTimeout();

        expect(windowManager.isPeeking).toBe(true);

        actor.hover = false;
        actor._signals['notify::hover']();

        expect(windowManager.cancelPeek).toHaveBeenCalledTimes(1);
    });

    test('handleClick() commits peek and cancels timeout', () => {
    test('handleClick() commits peek, cancels timeout, and returns true if peeking', () => {
        handler.attach(actor);

        actor.hover = true;
        actor._signals['notify::hover']();
        gnomeUI._fireTimeout();

        expect(windowManager.isPeeking).toBe(true);

        handler.handleClick();
        const committed = handler.handleClick();

        expect(committed).toBe(true);
        expect(windowManager.commitPeek).toHaveBeenCalledTimes(1);

        handler.resetCommittedPeek();

        // Subsequent click when not peeking returns false
        expect(handler.handleClick()).toBe(false);
    });

    test('destroy() cleans up timeouts, peek, and disconnects actor', () => {
        handler.attach(actor);

        actor.hover = true;
        actor._signals['notify::hover']();

        handler.destroy();

        expect(gnomeUI.GLib.source_remove).toHaveBeenCalled();
        expect(actor.disconnect).toHaveBeenCalled();
    });
});

