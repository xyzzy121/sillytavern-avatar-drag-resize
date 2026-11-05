// A gesture owns one avatar and at most two pointers until completion.
import { dragState, touchState } from './shared/state.js';
import { CSS_CLASSES } from './shared/constants.js';
import { getSettings } from './shared/settings.js';
import { getAvatar, isExcludedTarget } from './shared/utils.js';
import { readAvatar, writeAvatar, resetAvatar } from './shared/avatar.js';
import { startDrag, updateDrag, endDrag } from './gestures/drag.js';
import { shouldRotate, startRotate, updateRotate, endRotate } from './gestures/rotate.js';
import { wheelZoom } from './gestures/zoom.js';
import { startPinch, updatePinch, endPinch } from './gestures/pinch.js';
import { handleDoubleTap, startLongPress, clearLongPress, markTouchMoved, clearTapHistory, TAP_SLOP } from './gestures/tap.js';

const pointers = new Map();
let registered = false;
let suppressTouchDoubleClickUntil = 0;

function point(event) {
    return { pointerId: event.pointerId, pointerType: event.pointerType, clientX: event.clientX, clientY: event.clientY };
}

function markActive(target) {
    document.querySelectorAll(`.${CSS_CLASSES.AVATAR}.${CSS_CLASSES.ACTIVE}`)
        .forEach(el => el.classList.remove(CSS_CLASSES.ACTIVE));
    target.classList.add(CSS_CLASSES.ACTIVE);
    document.dispatchEvent(new Event('am:avatars-changed'));
}

function endMode() {
    const target = dragState.target;
    if (dragState.mode === 'drag') endDrag(target);
    if (dragState.mode === 'rotate') endRotate(target);
    if (dragState.mode === 'pinch') endPinch(target);
    dragState.mode = null;
}

function release(target, id) {
    try { if (target?.hasPointerCapture(id)) target.releasePointerCapture(id); } catch { /* Removed node. */ }
}

function finishGesture() {
    clearLongPress();
    const target = dragState.target;
    const ids = [...pointers.keys()];
    endMode();
    pointers.clear();
    touchState.touches.clear();
    touchState.isPinching = false;
    touchState.touchMoved = false;
    dragState.target = null;
    ids.forEach(id => release(target, id));
}

function targetIsLive() {
    return dragState.target?.isConnected && dragState.target.classList.contains('am-managed') && getSettings().enabled;
}

function beginSingle(record, target) {
    readAvatar(target);
    if (record.current.pointerType !== 'touch' && shouldRotate(record.current, target)) startRotate(record.current, target);
    else startDrag(record.current, target);
}

function onPointerDown(event) {
    if (!getSettings().enabled || (event.pointerType !== 'touch' && event.button !== 0)) return;
    const target = getAvatar(event.target);
    if (!target || !target.classList.contains('am-managed') || isExcludedTarget(event.target)) return;
    if (dragState.target && !targetIsLive()) finishGesture();
    if (pointers.size && (dragState.target !== target || event.pointerType !== 'touch' ||
        [...pointers.values()].some(p => p.current.pointerType !== 'touch') || pointers.size >= 2)) return;
    event.preventDefault();
    event.stopPropagation();
    const current = point(event);
    const record = { current, initial: current, startedAt: Date.now(), moved: false, multiple: false };
    pointers.set(event.pointerId, record);
    if (event.pointerType === 'touch') touchState.touches.set(event.pointerId, current);
    dragState.target = target;
    markActive(target);
    try { target.setPointerCapture(event.pointerId); } catch { /* Synthetic events or an older browser. */ }

    if (pointers.size === 2) {
        clearLongPress();
        clearTapHistory();
        pointers.forEach(p => { p.multiple = true; });
        endMode();
        startPinch(target, [...pointers.values()].map(p => p.current));
    } else {
        beginSingle(record, target);
        if (event.pointerType === 'touch') {
            startLongPress(target, () => {
                finishGesture();
                clearTapHistory();
                resetAvatar(target);
                suppressTouchDoubleClickUntil = Date.now() + 500;
            });
        }
    }
}

function updatePointer(event) {
    const record = pointers.get(event.pointerId);
    if (!record) return;
    record.current = point(event);
    if (event.pointerType === 'touch') touchState.touches.set(event.pointerId, record.current);
    if (Math.hypot(event.clientX - record.initial.clientX, event.clientY - record.initial.clientY) > TAP_SLOP) {
        record.moved = true;
        markTouchMoved();
        clearLongPress();
        clearTapHistory();
    }
    // Keep small finger jitter from moving the image or cancelling a long press.
    if (!record.moved && dragState.mode !== 'pinch' && event.pointerType === 'touch') return;
    readAvatar(dragState.target);
    if (dragState.mode === 'drag') updateDrag(event);
    else if (dragState.mode === 'rotate') updateRotate(event, dragState.target);
    else if (dragState.mode === 'pinch') updatePinch([...pointers.values()].map(p => p.current));
    writeAvatar(dragState.target);
}

function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    if (!targetIsLive()) { finishGesture(); return; }
    event.preventDefault();
    event.stopPropagation();
    updatePointer(event);
}

function onPointerUp(event) {
    const record = pointers.get(event.pointerId);
    if (!record) return;
    if (!targetIsLive()) { finishGesture(); return; }
    event.preventDefault();
    updatePointer(event);
    const target = dragState.target;
    clearLongPress();
    pointers.delete(event.pointerId);
    touchState.touches.delete(event.pointerId);
    release(target, event.pointerId);
    if (pointers.size) {
        endMode();
        const remaining = [...pointers.values()][0];
        remaining.moved = true;
        // Resume at the current finger and current transform, with no jump.
        readAvatar(target);
        startDrag(remaining.current, target);
        return;
    }
    finishGesture();
    if (event.pointerType === 'touch') {
        suppressTouchDoubleClickUntil = Date.now() + 500;
        if (!record.moved && !record.multiple && Date.now() - record.startedAt < getSettings().longPressDuration) {
            handleDoubleTap(event, target);
        } else clearTapHistory();
    }
}

function onPointerCancel(event) {
    if (pointers.has(event.pointerId)) { finishGesture(); clearTapHistory(); }
}

function onLostCapture(event) {
    // Explicit release after pointerup has already removed that pointer.
    if (pointers.has(event.pointerId)) { finishGesture(); clearTapHistory(); }
}

function onBlur() { finishGesture(); clearTapHistory(); }
function onAvatarsChanged() { if (dragState.target && !targetIsLive()) onBlur(); }

function onWheel(event) {
    if (!getSettings().enabled) return;
    const target = getAvatar(event.target);
    if (!target || !target.classList.contains('am-managed') || isExcludedTarget(event.target)) return;
    event.preventDefault();
    if (pointers.size) finishGesture();
    markActive(target);
    wheelZoom(target, event.deltaY);
}

function onDoubleClick(event) {
    if (!getSettings().enabled || Date.now() < suppressTouchDoubleClickUntil) return;
    const target = getAvatar(event.target);
    if (!target || !target.classList.contains('am-managed') || isExcludedTarget(event.target)) return;
    event.preventDefault();
    finishGesture();
    markActive(target);
    resetAvatar(target);
}

const listeners = [
    ['pointerdown', onPointerDown, { passive: false }],
    ['pointermove', onPointerMove, { passive: false }],
    ['pointerup', onPointerUp, { passive: false }],
    ['pointercancel', onPointerCancel],
    ['lostpointercapture', onLostCapture],
    ['wheel', onWheel, { passive: false }],
    ['dblclick', onDoubleClick],
    ['am:avatars-changed', onAvatarsChanged],
    ['am:before-action', onBlur],
];

export function registerInputHandlers() {
    if (registered) return;
    registered = true;
    listeners.forEach(([name, handler, options]) => document.addEventListener(name, handler, options));
    window.addEventListener('blur', onBlur);
}

export function unregisterInputHandlers() {
    listeners.forEach(([name, handler, options]) => document.removeEventListener(name, handler, options));
    window.removeEventListener('blur', onBlur);
    onBlur();
    registered = false;
}
