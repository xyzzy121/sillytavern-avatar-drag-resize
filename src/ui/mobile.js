// A toolbar outside the transformed image stays usable at every zoom level.
import { CSS_CLASSES } from '../shared/constants.js';
import { getSettings } from '../shared/settings.js';
import { getActiveAvatar } from '../shared/utils.js';
import { actionButton, bindActions } from './actions.js';

let dispose = null;

export function createMobileControls() {
    removeMobileControls();
    const toolbar = document.createElement('div');
    toolbar.id = CSS_CLASSES.MOBILE_CONTROLS;
    toolbar.className = 'am-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Avatar image controls');
    toolbar.hidden = true;
    toolbar.innerHTML = ['zoom-out', 'zoom-in', 'fit', 'close'].map(key => actionButton(key, true)).join('');
    document.body.append(toolbar);
    const unbind = bindActions(toolbar);
    let frame = null;

    function update() {
        frame = null;
        const avatar = getActiveAvatar();
        toolbar.hidden = !getSettings().enabled || !avatar?.isConnected;
        if (toolbar.hidden) return;
        const rect = avatar.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        const style = getComputedStyle(toolbar);
        const inset = side => (parseFloat(style[`scrollMargin${side}`]) || 0) + 8;
        const minX = left + inset('Left');
        const minY = top + inset('Top');
        const maxX = Math.max(minX, left + width - inset('Right') - toolbar.offsetWidth);
        const maxY = Math.max(minY, top + height - inset('Bottom') - toolbar.offsetHeight);
        const x = Math.min(maxX, Math.max(minX, rect.left + rect.width / 2 - toolbar.offsetWidth / 2));
        const y = Math.min(maxY, Math.max(minY, rect.top - toolbar.offsetHeight - 8));
        toolbar.style.left = `${x}px`;
        toolbar.style.top = `${y}px`;
        toolbar.style.zIndex = String(Math.max(1001, Number(getComputedStyle(avatar).zIndex) || 0) + 1);
    }

    function schedule() {
        if (frame === null) frame = requestAnimationFrame(update);
    }

    const listeners = [
        [document, 'am:avatars-changed'], [document, 'am:transform'],
        [document, 'am:settings-changed'], [window, 'resize'],
    ];
    if (window.visualViewport) {
        listeners.push([window.visualViewport, 'resize'], [window.visualViewport, 'scroll']);
    }
    for (const [target, event] of listeners) target.addEventListener(event, schedule);
    const sizeObserver = new ResizeObserver(schedule);
    sizeObserver.observe(toolbar);
    update();
    dispose = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        for (const [target, event] of listeners) target.removeEventListener(event, schedule);
        sizeObserver.disconnect();
        unbind();
        toolbar.remove();
    };
}

export function removeMobileControls() {
    dispose?.();
    dispose = null;
}
