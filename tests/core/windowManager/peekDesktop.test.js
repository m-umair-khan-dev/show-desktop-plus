import { describe, test, expect, beforeEach, vi } from 'vitest';
import WindowManager from '../../../core/windowManager.js';
import { createMockGnomeAPI } from '../../mocks/gnome/gnome.js';
import { createWindow, createStore } from '../../helpers/factories.js';

describe('WindowManager: Peek Desktop', () => {
    let wm, store, gnome, windows;

    beforeEach(() => {
        windows = [createWindow(1), createWindow(2)];
        gnome = createMockGnomeAPI(windows);
        store = createStore();

        wm = new WindowManager(
            store,
            { _settings: { get_boolean: () => false } },
            () => {},
            gnome
        );
    });

    test('peekDesktop() minimizes windows and sets isPeeking to true', () => {
        expect(wm.isPeeking).toBe(false);
        wm.peekDesktop();

        expect(wm.isPeeking).toBe(true);
        expect(windows[0].minimize).toHaveBeenCalled();
        expect(windows[1].minimize).toHaveBeenCalled();
        expect(store.getWorkspaceMap(0)).toBeDefined();
    });

    test('peekDesktop() does nothing if desktop is already shown', () => {
        wm.hideAllWindows();
        expect(wm.isPeeking).toBe(false);

        wm.peekDesktop();
        expect(wm.isPeeking).toBe(false);
    });

    test('cancelPeek() restores windows and resets isPeeking to false', () => {
        wm.peekDesktop();
        expect(wm.isPeeking).toBe(true);

        wm.cancelPeek();
        expect(wm.isPeeking).toBe(false);
        expect(windows[0].unminimize).toHaveBeenCalled();
        expect(windows[1].unminimize).toHaveBeenCalled();
        expect(store.getWorkspaceMap(0)).toBeUndefined();
    });

    test('commitPeek() retains hidden windows and resets isPeeking to false', () => {
        wm.peekDesktop();
        expect(wm.isPeeking).toBe(true);

        wm.commitPeek();
        expect(wm.isPeeking).toBe(false);
        // Windows should remain minimized
        expect(store.getWorkspaceMap(0)).toBeDefined();
    });

    test('disable() cancels active peek before teardown', () => {
        wm.peekDesktop();
        expect(wm.isPeeking).toBe(true);

        wm.disable();
        expect(wm.isPeeking).toBe(false);
        expect(windows[0].unminimize).toHaveBeenCalled();
    });
});

