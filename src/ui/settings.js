import { CSS_CLASSES } from '../shared/constants.js';
import { getSettings, saveSettings } from '../shared/settings.js';
import { applyZIndexEverywhere } from '../observer.js';
import { actionButton, bindActions } from './actions.js';

let dispose = null;
let retryTimer = null;

function checkbox(key, label, settings) {
    return `<label class="checkbox_label"><input type="checkbox" data-am-key="${key}" ${settings[key] ? 'checked' : ''}><span>${label}</span></label>`;
}

function range(label, key, settings, min, max, step) {
    const value = Number(settings[key]);
    return `<div class="am-setting"><label for="am-${key}" class="am-range-label"><span>${label}</span><output for="am-${key}" data-am-value="${key}">${value}</output></label><input id="am-${key}" type="range" data-am-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function html(s) {
    return `<div id="${CSS_CLASSES.SETTINGS_CONTAINER}" class="extension_container">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header"><b>Avatar Manipulator</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content">
                <div class="am-settings-content">
                    ${checkbox('enabled', 'Enable Avatar Manipulator', s)}
                    <p class="am-hint">Open an avatar in chat, then drag to move it. Pinch or scroll to zoom. Double-tap or hold to fit the image.</p>
                    <section class="am-section" aria-label="Image controls">
                        <b>Image controls</b>
                        <div class="am-action-grid">${['zoom-out', 'zoom-in', 'fit', 'close', 'rotate-left', 'rotate-right'].map(key => actionButton(key)).join('')}</div>
                        <div class="am-move-controls" role="group" aria-label="Move image">${['move-left', 'move-up', 'move-down', 'move-right'].map(key => actionButton(key, true)).join('')}</div>
                        <div class="am-action-grid">${actionButton('image')}${actionButton('reset-image')}</div>
                        <small class="am-hint">Controls apply to the last image you touched. Image replacements affect this viewer only.</small>
                    </section>
                    <section class="am-section" aria-label="Preferences">
                        <b>Preferences</b>
                        <label for="am-zIndexMode">Image layer</label>
                        <select id="am-zIndexMode" class="text_pole" data-am-key="zIndexMode">
                            <option value="background" ${s.zIndexMode === 'background' ? 'selected' : ''}>Background</option>
                            <option value="aboveChat" ${s.zIndexMode === 'aboveChat' ? 'selected' : ''}>Above chat</option>
                            <option value="aboveUI" ${s.zIndexMode === 'aboveUI' ? 'selected' : ''}>Above interface</option>
                        </select>
                        ${checkbox('enableRotation', 'Allow rotation', s)}
                        ${checkbox('enableMultiTouchRotate', 'Rotate with two fingers', s)}
                        ${checkbox('ghostDragEffect', 'Fade image while moving', s)}
                        ${checkbox('showToasts', 'Show notifications', s)}
                    </section>
                    <details class="am-advanced"><summary>Advanced</summary><div class="am-advanced-content">
                        ${range('Wheel zoom speed', 'zoomSpeed', s, 0.05, 0.5, 0.05)}
                        ${range('Button zoom step', 'mobileZoomStep', s, 0.05, 0.5, 0.05)}
                        ${range('Button move step (px)', 'mobileMoveStep', s, 5, 60, 5)}
                        ${range('Button rotation step (°)', 'mobileRotateStep', s, 1, 45, 1)}
                        ${range('Edge rotation threshold', 'rotationThreshold', s, 0.1, 0.95, 0.05)}
                        ${range('Two-finger rotation speed', 'multiTouchRotateSpeed', s, 0.25, 2, 0.05)}
                        ${range('Double-tap interval (ms)', 'doubleTapTimeout', s, 150, 600, 50)}
                        ${range('Hold to fit delay (ms)', 'longPressDuration', s, 300, 1500, 50)}
                    </div></details>
                </div>
            </div>
        </div>
    </div>`;
}

export function createSettingsUI({ onEnabledChange } = {}) {
    removeSettingsUI();
    let attempts = 60;
    const mount = () => {
        retryTimer = null;
        const panel = document.getElementById('extensions_settings');
        if (!panel) {
            if (--attempts > 0) retryTimer = setTimeout(mount, 500);
            return;
        }
        panel.insertAdjacentHTML('beforeend', html(getSettings()));
        const root = document.getElementById(CSS_CLASSES.SETTINGS_CONTAINER);
        const unbind = bindActions(root);
        const abort = new AbortController();
        const update = event => {
            const input = event.target.closest('[data-am-key]');
            if (!input) return;
            if ((input.type === 'range') !== (event.type === 'input')) return;
            const settings = getSettings();
            const key = input.dataset.amKey;
            let value = input.type === 'checkbox' ? input.checked : input.value;
            if (input.type === 'range') {
                value = Math.min(Number(input.max), Math.max(Number(input.min), Number(value)));
                if (!Number.isFinite(value)) return;
                root.querySelector(`[data-am-value="${key}"]`).textContent = String(value);
            }
            settings[key] = value;
            saveSettings();
            if (key === 'enabled') onEnabledChange?.(value);
            if (key === 'zIndexMode') applyZIndexEverywhere();
            document.dispatchEvent(new Event('am:settings-changed'));
        };
        root.addEventListener('input', update, { signal: abort.signal });
        root.addEventListener('change', update, { signal: abort.signal });
        dispose = () => { abort.abort(); unbind(); root.remove(); };
    };
    mount();
}

export function removeSettingsUI() {
    clearTimeout(retryTimer);
    retryTimer = null;
    dispose?.();
    dispose = null;
}
