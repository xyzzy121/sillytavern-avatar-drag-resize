// ============================================================================
//  Pinch - two-finger pinch to zoom + optional two-finger rotate.
// ============================================================================

import { dragState, rotationState, touchState } from '../shared/state.js';
import { CSS_CLASSES, LIMITS } from '../shared/constants.js';
import { clamp, twoPointAngle, twoPointDistance, wrapAngleDelta } from '../shared/utils.js';
import { readAvatar } from '../shared/avatar.js';
import { getSettings } from '../shared/settings.js';
import { beginFeedback, endFeedback } from './feedback.js';

export function startPinch(target, touches) {
    if (touches.length < 2) return;
    dragState.mode = 'pinch';
    dragState.target = target;
    touchState.isPinching = true;
    readAvatar(target);

    touchState.pinchDistance0 = twoPointDistance(touches[0], touches[1]);
    touchState.pinchScale0 = dragState.scale;
    touchState.pinchAngle0 = twoPointAngle(touches[0], touches[1]);
    touchState.pinchRotation0 = rotationState.rotation;
    touchState.pinchX0 = dragState.x;
    touchState.pinchY0 = dragState.y;
    touchState.pinchCenterX = (touches[0].clientX + touches[1].clientX) / 2;
    touchState.pinchCenterY = (touches[0].clientY + touches[1].clientY) / 2;

    target.classList.add(CSS_CLASSES.PINCHING);
    beginFeedback(target, getSettings().ghostDragEffect ? 0.8 : undefined);
}

export function updatePinch(touches) {
    if (!touchState.isPinching || touches.length < 2) return;
    const settings = getSettings();
    dragState.x = touchState.pinchX0 + (touches[0].clientX + touches[1].clientX) / 2 - touchState.pinchCenterX;
    dragState.y = touchState.pinchY0 + (touches[0].clientY + touches[1].clientY) / 2 - touchState.pinchCenterY;

    // Scale
    const currentDist = twoPointDistance(touches[0], touches[1]);
    if (touchState.pinchDistance0 > 0 && currentDist > 0) {
        const factor = currentDist / touchState.pinchDistance0;
        dragState.scale = clamp(touchState.pinchScale0 * factor, LIMITS.SCALE_MIN, LIMITS.SCALE_MAX);
    }

    // Rotate (opt-in)
    if (settings.enableRotation && settings.enableMultiTouchRotate) {
        const currentAngle = twoPointAngle(touches[0], touches[1]);
        const delta = wrapAngleDelta(currentAngle - touchState.pinchAngle0);
        const speed = settings.multiTouchRotateSpeed ?? 1.0;
        rotationState.rotation = touchState.pinchRotation0 + delta * (180 / Math.PI) * speed;
    }
}

export function endPinch(target) {
    touchState.isPinching = false;
    touchState.pinchDistance0 = 0;
    if (!target) return;
    target.classList.remove(CSS_CLASSES.PINCHING);
    endFeedback(target);
}
