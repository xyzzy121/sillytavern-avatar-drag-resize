import { dragState, rotationState } from './state.js';
import { CSS_VARS, DATA_ATTRS } from './constants.js';
import { getAvatarKey, clearPosition, loadPosition, getSettings, saveSettings } from './settings.js';
import { getZIndexValue, toast } from './utils.js';
import { fitDimensions, constrainTransform, normalizeTransform } from './geometry.js';
import { createPositionSaver } from './persistence.js';

const managed = new Map();
const ownedProperties = ['position', 'top', 'left', 'right', 'bottom', 'margin', 'width', 'height',
    'max-width', 'max-height', 'transform', '-webkit-transform', 'transform-origin', ...Object.values(CSS_VARS)];
const saver = createPositionSaver((key, value) => {
    getSettings().savedPositions[key] = { ...value, savedAt: Date.now() };
    saveSettings();
});
export function getViewport() {
    const viewport = window.visualViewport;
    return { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight };
}
function values(el) {
    return normalizeTransform({ x: Number(el.dataset[DATA_ATTRS.X] ?? 0),
        y: Number(el.dataset[DATA_ATTRS.Y] ?? 0), scale: Number(el.dataset[DATA_ATTRS.SCALE] ?? 1),
        rotation: Number(el.dataset[DATA_ATTRS.ROTATION] ?? 0) });
}
export function readAvatar(el) {
    if (!el) return;
    const value = values(el);
    Object.assign(dragState, { x: value.x, y: value.y, scale: value.scale });
    rotationState.rotation = value.rotation;
}
function render(el, value) {
    if (!managed.has(el)) return null;
    const viewport = getViewport();
    const img = el.querySelector('img');
    const size = fitDimensions(img?.naturalWidth || 400, img?.naturalHeight || 600, viewport);
    const transform = constrainTransform(value, size, viewport);
    for (const [key, dataKey] of Object.entries(DATA_ATTRS)) el.dataset[dataKey] = String(transform[key.toLowerCase()]);
    const properties = {
        position: 'fixed', left: `${viewport.left + viewport.width / 2}px`,
        top: `${viewport.top + viewport.height / 2}px`, right: 'auto', bottom: 'auto', margin: '0',
        width: `${size.width}px`, height: `${size.height}px`, 'max-width': 'none', 'max-height': 'none',
        transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
        'transform-origin': 'center center',
        [CSS_VARS.Z_INDEX]: String(getZIndexValue(getSettings().zIndexMode)),
    };
    for (const [key, value] of Object.entries(properties)) el.style.setProperty(key, value, 'important');
    document.dispatchEvent(new CustomEvent('am:transform', { detail: { avatar: el } }));
    return transform;
}
export function writeAvatar(el, { persist = true } = {}) {
    const value = render(el, { x: dragState.x, y: dragState.y, scale: dragState.scale, rotation: rotationState.rotation });
    if (!value) return;
    Object.assign(dragState, { x: value.x, y: value.y, scale: value.scale });
    rotationState.rotation = value.rotation;
    if (persist) saver.schedule(getAvatarKey(el), value);
}
export function resetAvatar(el) {
    if (!managed.has(el)) return;
    saver.cancel(getAvatarKey(el));
    clearPosition(el);
    render(el, { x: 0, y: 0, scale: 1, rotation: 0 });
    readAvatar(el);
    if (getSettings().showToasts) toast('Avatar fitted to screen');
}
export function restoreAvatar(el) {
    if (managed.has(el)) render(el, loadPosition(el) ?? {});
}
export function manageAvatar(el) {
    if (managed.has(el)) return;
    const properties = new Map(ownedProperties.map(key => [key,
        { value: el.style.getPropertyValue(key), priority: el.style.getPropertyPriority(key) }]));
    const data = new Map(Object.values(DATA_ATTRS).map(key => [key, el.dataset[key]]));
    const onLoad = () => { if (managed.has(el)) render(el, values(el)); };
    managed.set(el, { properties, data, onLoad });
    el.classList.add('am-managed');
    el.addEventListener('load', onLoad, true);
    restoreAvatar(el);
}
export function releaseAvatar(el) {
    const record = managed.get(el);
    if (!record) return;
    saver.flush(getAvatarKey(el));
    el.removeEventListener('load', record.onLoad, true);
    for (const [key, original] of record.properties) {
        if (original.value) el.style.setProperty(key, original.value, original.priority);
        else el.style.removeProperty(key);
    }
    for (const [key, value] of record.data) {
        if (value === undefined) delete el.dataset[key]; else el.dataset[key] = value;
    }
    el.classList.remove('am-managed', 'am-active', 'am-dragging', 'am-pinching', 'am-rotating');
    managed.delete(el);
}
export function refreshAvatars() {
    for (const el of managed.keys()) render(el, values(el));
}
export function cleanupAvatars() {
    for (const el of [...managed.keys()]) releaseAvatar(el);
    saver.flushAll();
}
