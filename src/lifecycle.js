import { initSettings, getSettings } from './shared/settings.js';
import { resetInteractionState } from './shared/state.js';
import { cleanupAvatars } from './shared/avatar.js';
import { cleanupImages } from './shared/image.js';
import { registerInputHandlers, unregisterInputHandlers } from './input.js';
import { startObserver, stopObserver } from './observer.js';
import { createSettingsUI, removeSettingsUI } from './ui/settings.js';
import { createMobileControls, removeMobileControls } from './ui/mobile.js';

let started = false;
let active = false;
function deactivate() {
    unregisterInputHandlers();
    removeMobileControls();
    stopObserver();
    cleanupImages();
    cleanupAvatars();
    resetInteractionState();
    active = false;
}
export function syncEnabled() {
    if (!started) return;
    if (!getSettings().enabled) { deactivate(); return; }
    if (active) return;
    try {
        startObserver();
        registerInputHandlers();
        createMobileControls();
        active = true;
    } catch (error) {
        deactivate();
        throw error;
    }
}
export async function init() {
    if (started) return;
    try {
        initSettings();
        started = true;
        createSettingsUI({ onEnabledChange: syncEnabled });
        syncEnabled();
    } catch (error) {
        cleanup();
        console.error('[AvatarManip] initialization failed', error);
        throw error;
    }
}
export function cleanup() {
    deactivate();
    removeSettingsUI();
    started = false;
}
export async function regenerate() { cleanup(); await init(); }
