import { dragState, touchState } from '../shared/state.js';
import { getSettings } from '../shared/settings.js';
import { resetAvatar } from '../shared/avatar.js';

export const TAP_SLOP = 8;
const DOUBLE_TAP_DISTANCE = 24;

export function clearTapHistory() {
    touchState.lastTapTime = 0;
    touchState.lastTapTarget = null;
    touchState.lastTapPoint = null;
}

// Called only after a completed, short, stationary single-finger tap.
export function handleDoubleTap(event, target) {
    const now = Date.now();
    const previous = touchState.lastTapPoint;
    if (target === touchState.lastTapTarget && now - touchState.lastTapTime <= getSettings().doubleTapTimeout &&
        previous && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= DOUBLE_TAP_DISTANCE) {
        clearTapHistory();
        resetAvatar(target);
        return true;
    }
    touchState.lastTapTime = now;
    touchState.lastTapTarget = target;
    touchState.lastTapPoint = { x: event.clientX, y: event.clientY };
    return false;
}

export function startLongPress(target, onReset = () => resetAvatar(target)) {
    clearLongPress();
    touchState.touchMoved = false;
    touchState.longPressTimer = setTimeout(() => {
        touchState.longPressTimer = null;
        if (target.isConnected && getSettings().enabled && !touchState.touchMoved && dragState.target === target && !touchState.isPinching) onReset();
    }, getSettings().longPressDuration);
}

export function clearLongPress() {
    if (touchState.longPressTimer !== null) clearTimeout(touchState.longPressTimer);
    touchState.longPressTimer = null;
}

export function markTouchMoved() { touchState.touchMoved = true; }
