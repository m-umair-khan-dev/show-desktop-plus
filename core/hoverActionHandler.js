export const HoverAction = {
    NONE: 0,
    PEEK: 1,
    TOGGLE: 2,
};

/**
 * Handles hover events (peek at desktop and auto-toggle) and coordinates
 * with click actions to provide a seamless Show Desktop experience.
 */
export default class HoverActionHandler {
    constructor(windowManager, extension, gnomeUI) {
        this._windowManager = windowManager;
        this._extension = extension;
        this._GLib = gnomeUI.GLib;

        this._hoverTimeoutId = 0;
        this._trackedActors = new Map(); // actor -> signalIds[]
        this._committedPeek = false;
    }

    /**
     * Attaches hover tracking to an interactive St or Clutter actor.
     */
    attach(actor) {
        if (!actor || this._trackedActors.has(actor))
            return;

        actor.reactive = true;
        actor.track_hover = true;

        const signals = [];

        signals.push(actor.connect('notify::hover', () => {
            this._onHoverChanged(actor);
        }));

        // Intercept clicks early to commit peeks before hover is lost
        signals.push(actor.connect('button-press-event', () => {
            this.handleClick();
            return false; // Clutter.EVENT_PROPAGATE
        }));

        this._trackedActors.set(actor, signals);
    }

    /**
     * Detaches hover tracking from an actor.
     */
    detach(actor) {
        const signals = this._trackedActors.get(actor);
        if (!signals)
            return;

        for (const id of signals) {
            try {
                actor.disconnect(id);
            } catch {}
        }

        this._trackedActors.delete(actor);

        if (this._trackedActors.size === 0) {
            this._clearHoverTimeout();
            if (this._windowManager?.isPeeking) {
                this._windowManager.cancelPeek();
            }
        }
    }

    _onHoverChanged(actor) {
        if (actor.hover) {
            this._handleMouseEnter();
        } else {
            this._handleMouseLeave();
        }
    }

    _handleMouseEnter() {
        this._clearHoverTimeout();

        const settings = this._extension?._settings;
        if (!settings)
            return;

        const action = settings.get_enum('hover-action');
        if (action === HoverAction.NONE)
            return;

        const delay = settings.get_uint('hover-delay') || 250;

        this._hoverTimeoutId = this._GLib.timeout_add(
            this._GLib.PRIORITY_DEFAULT,
            delay,
            () => {
                this._hoverTimeoutId = 0;
                this._triggerHoverAction(action);
                return this._GLib.SOURCE_REMOVE;
            }
        );
    }

    _handleMouseLeave() {
        this._clearHoverTimeout();

        if (this._windowManager?.isPeeking) {
            this._windowManager.cancelPeek();
            // Delay cancel slightly to allow a click to commit the peek
            // before the windows are unintentionally restored.
            this._leaveTimeoutId = this._GLib.timeout_add(
                this._GLib.PRIORITY_DEFAULT,
                150,
                () => {
                    this._leaveTimeoutId = 0;
                    if (this._windowManager?.isPeeking) {
                        this._windowManager.cancelPeek();
                    }
                    return false;
                }
            );
        }
    }

    _triggerHoverAction(action) {
        // If any tracked actor is still hovered
        const isStillHovered = Array.from(this._trackedActors.keys()).some(a => a.hover);
        if (!isStillHovered)
            return;

        if (action === HoverAction.PEEK) {
            this._windowManager.peekDesktop();
        } else if (action === HoverAction.TOGGLE) {
            this._windowManager.toggleDesktop();
        }
    }

    /**
     * Must be called when any click occurs on the button.
     * Cancels any pending hover timers and commits any active peek so mouse leave
     * doesn't unintentionally restore windows.
     * @returns {boolean} true if an active peek was committed, false otherwise.
     */
    handleClick() {
        this._clearHoverTimeout();
        if (this._windowManager?.isPeeking) {
            this._windowManager.commitPeek();
            this._committedPeek = true;
            return true;
        }
        if (this._committedPeek) {
            return true;
        }
        return false;
    }

    /**
     * Resets the committed peek flag once the full click event is processed.
     */
    resetCommittedPeek() {
        const was = this._committedPeek;
        this._committedPeek = false;
        return was;
    }

    _clearHoverTimeout() {
        if (this._hoverTimeoutId) {
            this._GLib.source_remove(this._hoverTimeoutId);
            this._hoverTimeoutId = 0;
        }
        if (this._leaveTimeoutId) {
            this._GLib.source_remove(this._leaveTimeoutId);
            this._leaveTimeoutId = 0;
        }
    }

    /**
     * Cleans up all timeouts, signals, and active peek states.
     */
    destroy() {
        this._clearHoverTimeout();

        if (this._windowManager?.isPeeking) {
            this._windowManager.cancelPeek();
        }

        for (const [actor, signals] of this._trackedActors) {
            for (const id of signals) {
                try {
                    actor.disconnect(id);
                } catch {}
            }
        }
        this._trackedActors.clear();
    }
}

