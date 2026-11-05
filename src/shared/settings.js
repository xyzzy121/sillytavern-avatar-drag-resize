import { EXT_NAME, LIMITS } from './constants.js';
import { normaliseSource } from './avatar-source.js';

function ctx() {
    const context = globalThis.SillyTavern?.getContext?.() ?? {
        extensionSettings: globalThis.extension_settings,
        saveSettingsDebounced: globalThis.saveSettingsDebounced,
    };
    if (!isRecord(context.extensionSettings)) {
        throw new Error('Avatar Manipulator: SillyTavern extension settings are not ready');
    }
    return context;
}

export const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    enableRotation: true,
    zIndexMode: 'aboveUI',
    ghostDragEffect: true,
    showToasts: true,
    zoomSpeed: 0.1,
    mobileZoomStep: 0.1,
    rotationThreshold: 0.7,
    enableMultiTouchRotate: true,
    multiTouchRotateSpeed: 1,
    doubleTapTimeout: 300,
    longPressDuration: 600,
    mobileMoveStep: 20,
    mobileRotateStep: 10,
    mobileYBias: 0, // Retained for older installations; no longer applied.
    savedPositions: {},
    customImages: {},
});

const RANGES = {
    zoomSpeed: [0.05, 0.5], mobileZoomStep: [0.05, 0.5],
    rotationThreshold: [0.1, 0.95], multiTouchRotateSpeed: [0.25, 2],
    doubleTapTimeout: [150, 600], longPressDuration: [300, 1500],
    mobileMoveStep: [5, 60], mobileRotateStep: [1, 45],
};
const INTEGER_KEYS = new Set(['doubleTapTimeout', 'longPressDuration', 'mobileMoveStep', 'mobileRotateStep']);
const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bound = (value, min, max) => Math.min(max, Math.max(min, value));

export function sanitisePosition(value) {
    if (!isRecord(value)) return null;
    const position = {
        x: finite(value.x, 0),
        y: finite(value.y, 0),
        scale: bound(finite(value.scale, 1), LIMITS.SCALE_MIN, LIMITS.SCALE_MAX),
        rotation: ((finite(value.rotation, 0) % 360) + 360) % 360,
    };
    if (Number.isFinite(value.savedAt)) position.savedAt = value.savedAt;
    return position;
}

// Mutate an existing settings object so UI bindings keep the same reference.
export function initSettings() {
    const context = ctx();
    if (!isRecord(context.extensionSettings[EXT_NAME])) context.extensionSettings[EXT_NAME] = {};
    const current = context.extensionSettings[EXT_NAME];
    for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
        if (typeof fallback === 'boolean' && typeof current[key] !== 'boolean') current[key] = fallback;
    }
    for (const [key, [min, max]] of Object.entries(RANGES)) {
        const value = bound(finite(current[key], DEFAULT_SETTINGS[key]), min, max);
        current[key] = INTEGER_KEYS.has(key) ? Math.round(value) : value;
    }
    if (!['background', 'aboveChat', 'aboveUI'].includes(current.zIndexMode)) current.zIndexMode = DEFAULT_SETTINGS.zIndexMode;
    current.mobileYBias = finite(current.mobileYBias, DEFAULT_SETTINGS.mobileYBias);
    const positions = Object.create(null);
    for (const [key, value] of Object.entries(isRecord(current.savedPositions) ? current.savedPositions : {})) {
        const position = sanitisePosition(value);
        if (position) positions[key] = position;
    }
    const images = Object.create(null);
    for (const [key, value] of Object.entries(isRecord(current.customImages) ? current.customImages : {})) {
        const source = normaliseSource(value);
        if (source) images[key] = source;
    }
    current.savedPositions = positions;
    current.customImages = images;
    return current;
}

export function getSettings() {
    return ctx().extensionSettings[EXT_NAME] || initSettings();
}

export function saveSettings() {
    ctx().saveSettingsDebounced?.();
}

export function getCustomImageSource(el) {
    const key = getAvatarKey(el);
    return key ? getSettings().customImages?.[key] ?? null : null;
}

export function setCustomImageSource(el, source) {
    const key = getAvatarKey(el);
    const valid = normaliseSource(source);
    if (!key || !valid) return;
    getSettings().customImages[key] = valid;
    saveSettings();
}

export function clearCustomImageSource(el) {
    const key = getAvatarKey(el);
    const images = getSettings().customImages;
    if (key && Object.hasOwn(images, key)) {
        delete images[key];
        saveSettings();
    }
}

// Preserve the upstream key format so existing positions and replacements work.
export function getAvatarKey(el) {
    if (!el) return null;
    if (el.dataset.amAvatarKey) return el.dataset.amAvatarKey;
    const forChar = el.getAttribute('forChar') || el.getAttribute('data-char');
    if (forChar) return (el.dataset.amAvatarKey = `char:${forChar}`);
    const image = el.querySelector('img');
    const src = el.dataset.amOriginalSrc || image?.dataset.amOriginalSrc || image?.getAttribute('src');
    if (!src) return null;
    let key;
    try { key = `img:${new URL(src, globalThis.location?.href ?? 'http://localhost/').pathname}`; }
    catch { key = `img:${src}`; }
    el.dataset.amAvatarKey = key;
    return key;
}

export function loadPosition(el) {
    const key = getAvatarKey(el);
    return key ? sanitisePosition(getSettings().savedPositions?.[key]) : null;
}

export function savePosition(el, transform) {
    const key = getAvatarKey(el);
    const position = sanitisePosition(transform);
    if (!key || !position) return;
    getSettings().savedPositions[key] = { ...position, savedAt: Date.now() };
    saveSettings();
}

export function clearPosition(el) {
    const key = getAvatarKey(el);
    const positions = getSettings().savedPositions;
    if (key && Object.hasOwn(positions, key)) {
        delete positions[key];
        saveSettings();
    }
}
