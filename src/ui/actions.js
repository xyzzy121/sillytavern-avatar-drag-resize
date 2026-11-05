import { getSettings } from '../shared/settings.js';
import { getActiveAvatar } from '../shared/utils.js';
import { readAvatar, writeAvatar, resetAvatar } from '../shared/avatar.js';
import { dragState, rotationState } from '../shared/state.js';
import { stepZoom } from '../gestures/zoom.js';
import { pickAndApplyLocalImage, resetCustomImage } from '../shared/image.js';

const ACTIONS = {
    'zoom-out': ['fa-magnifying-glass-minus', 'Zoom out'],
    'zoom-in': ['fa-magnifying-glass-plus', 'Zoom in'],
    fit: ['fa-expand', 'Fit image'],
    close: ['fa-xmark', 'Close image'],
    'rotate-left': ['fa-rotate-left', 'Rotate left'],
    'rotate-right': ['fa-rotate-right', 'Rotate right'],
    'move-up': ['fa-arrow-up', 'Move up'],
    'move-down': ['fa-arrow-down', 'Move down'],
    'move-left': ['fa-arrow-left', 'Move left'],
    'move-right': ['fa-arrow-right', 'Move right'],
    image: ['fa-image', 'Change image'],
    'reset-image': ['fa-arrow-rotate-left', 'Restore original'],
};
const REPEATABLE = new Set(['zoom-out', 'zoom-in', 'rotate-left', 'rotate-right', 'move-up', 'move-down', 'move-left', 'move-right']);

export function actionButton(key, iconOnly = false) {
    const [icon, label] = ACTIONS[key];
    return `<button type="button" class="menu_button menu_button_icon am-action${iconOnly ? ' am-icon-action' : ''}" data-am-action="${key}" aria-label="${label}" title="${label}"><i class="fa-solid fa-fw ${icon}" aria-hidden="true"></i>${iconOnly ? '' : `<span>${label}</span>`}</button>`;
}

function available(key, target) {
    return getSettings().enabled && target?.isConnected && target.classList.contains('am-managed')
        && (!key.startsWith('rotate-') || getSettings().enableRotation);
}

function perform(key, target) {
    if (!available(key, target)) return;
    document.dispatchEvent(new Event('am:before-action'));
    const settings = getSettings();
    if (key === 'fit') return resetAvatar(target);
    if (key === 'close') return target.querySelector('.dragClose')?.click();
    if (key === 'image') return pickAndApplyLocalImage(target);
    if (key === 'reset-image') return resetCustomImage(target);
    if (key === 'zoom-in' || key === 'zoom-out') return stepZoom(target, key === 'zoom-in' ? 1 : -1);
    readAvatar(target);
    switch (key) {
        case 'rotate-left': rotationState.rotation -= settings.mobileRotateStep; break;
        case 'rotate-right': rotationState.rotation += settings.mobileRotateStep; break;
        case 'move-left': dragState.x -= settings.mobileMoveStep; break;
        case 'move-right': dragState.x += settings.mobileMoveStep; break;
        case 'move-up': dragState.y -= settings.mobileMoveStep; break;
        case 'move-down': dragState.y += settings.mobileMoveStep; break;
        default: return;
    }
    writeAvatar(target);
}

// Pointer repetition uses a fixed target; native keyboard activation runs once.
export function bindActions(root) {
    let hold = null;
    let delay = null;
    let repeat = null;
    const abort = new AbortController();
    const listen = (node, event, handler) => node.addEventListener(event, handler, { signal: abort.signal });
    function stop() {
        clearTimeout(delay);
        clearInterval(repeat);
        delay = repeat = null;
        const previous = hold;
        hold = null;
        if (previous?.button.hasPointerCapture?.(previous.pointerId)) {
            previous.button.releasePointerCapture(previous.pointerId);
        }
    }
    function sync() {
        const target = getActiveAvatar();
        for (const button of root.querySelectorAll('[data-am-action]')) {
            button.disabled = !available(button.dataset.amAction, target);
        }
        if (hold && !available(hold.key, hold.target)) stop();
    }
    listen(root, 'pointerdown', event => {
        const button = event.target.closest('button[data-am-action]');
        if (!button || button.disabled || event.button !== 0) return;
        const key = button.dataset.amAction;
        if (!REPEATABLE.has(key)) return;
        event.preventDefault();
        event.stopPropagation();
        stop();
        const target = getActiveAvatar();
        hold = { button, target, key, pointerId: event.pointerId };
        button.focus({ preventScroll: true });
        try { button.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
        perform(key, target);
        const tick = () => {
            if (!hold || !available(key, target)) return stop();
            perform(key, target);
        };
        delay = setTimeout(() => { tick(); if (hold) repeat = setInterval(tick, 90); }, 350);
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        listen(root, eventName, event => { if (hold?.pointerId === event.pointerId) stop(); });
    }
    listen(root, 'click', event => {
        const button = event.target.closest('button[data-am-action]');
        if (!button || button.disabled) return;
        event.stopPropagation();
        const key = button.dataset.amAction;
        if (REPEATABLE.has(key) && event.detail > 0) return;
        perform(key, getActiveAvatar());
    });
    listen(root, 'keydown', event => {
        if (!event.target.closest('button[data-am-action]') || !['Enter', ' '].includes(event.key)) return;
        // Prevent ST's global menu-button handler from synthesizing a second click.
        event.stopPropagation();
        if (event.repeat || event.isComposing) event.preventDefault();
    });
    listen(window, 'blur', stop);
    listen(document, 'visibilitychange', () => { if (document.hidden) stop(); });
    listen(document, 'am:avatars-changed', sync);
    listen(document, 'am:settings-changed', sync);
    sync();
    return () => { stop(); abort.abort(); };
}
