import { toast } from './utils.js';
import {
    getAvatarKey, getCustomImageSource, setCustomImageSource,
    clearCustomImageSource, getSettings,
} from './settings.js';
import { resolveSourceToUrl, sourceFromLocalFile, validateImageDataUrl } from './avatar-source.js';

// One lifecycle record per mounted avatar. Nothing is cached by a different
// identity scheme, and all observers, decoders and file pickers are disposable.
const records = new Map();
const operations = new Map();

function isManaged(el) {
    return Boolean(el?.isConnected && el.classList.contains('am-managed') && getSettings().enabled);
}

function notifyImageChanged(el) {
    if (isManaged(el)) document.dispatchEvent(new CustomEvent('am:image-changed', { detail: { avatar: el } }));
}

function inform(message) {
    if (getSettings().showToasts) toast(message);
}

function setAttributeOrRemove(element, name, value) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
}

function ensureRecord(el) {
    let record = records.get(el);
    if (record) return record;
    record = {
        key: getAvatarKey(el), images: new Map(), controller: new AbortController(),
        validatedUrl: null, pendingUrl: null, rejectedUrl: null, decodeController: null,
        observer: null,
    };
    record.observer = new MutationObserver(() => {
        if (!isManaged(el)) { releaseCustomImage(el); return; }
        applyCustomImage(el);
    });
    record.observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-izoomify-url'] });
    records.set(el, record);
    return record;
}

function applyValidatedSource(el, record, url) {
    if (!isManaged(el) || records.get(el) !== record) return;
    let changed = false;
    for (const image of el.querySelectorAll('img')) {
        let original = record.images.get(image);
        const currentSrc = image.getAttribute('src');
        const currentZoom = image.getAttribute('data-izoomify-url');
        if (!original) {
            original = { src: currentSrc, zoom: currentZoom, appliedSrc: null, appliedZoom: null };
            record.images.set(image, original);
            image.addEventListener('load', () => notifyImageChanged(el), { signal: record.controller.signal });
        } else {
            // A native source change while an override is active becomes the
            // source to restore. Do not mistake our prior override for native.
            if (currentSrc !== original.appliedSrc) original.src = currentSrc;
            if (currentZoom !== original.appliedZoom) original.zoom = currentZoom;
        }
        original.appliedSrc = url;
        original.appliedZoom = url;
        if (currentSrc !== url) { image.setAttribute('src', url); changed = true; }
        if (currentZoom !== url) image.setAttribute('data-izoomify-url', url);
    }
    if (changed) notifyImageChanged(el);
}

export function applyCustomImage(el) {
    if (!isManaged(el)) return;
    const url = resolveSourceToUrl(getCustomImageSource(el));
    if (!url) {
        if (records.has(el)) releaseCustomImage(el);
        return;
    }
    const record = ensureRecord(el);
    if (record.validatedUrl === url) { applyValidatedSource(el, record, url); return; }
    if (record.pendingUrl === url || record.rejectedUrl === url) return;
    record.decodeController?.abort();
    const decoder = new AbortController();
    record.decodeController = decoder;
    record.pendingUrl = url;
    validateImageDataUrl(url, { signal: decoder.signal }).then(() => {
        if (records.get(el) !== record || decoder.signal.aborted || !isManaged(el)) return;
        record.pendingUrl = null;
        record.validatedUrl = url;
        if (resolveSourceToUrl(getCustomImageSource(el)) === url) applyValidatedSource(el, record, url);
    }).catch(error => {
        if (records.get(el) !== record || decoder.signal.aborted) return;
        record.pendingUrl = null;
        record.rejectedUrl = url;
        // Invalid imported settings must never replace the working native image.
        if (error.name !== 'AbortError') console.warn('[AvatarManip] Ignored an invalid saved image');
    });
}

export function releaseCustomImage(el) {
    operations.get(el)?.abort();
    operations.delete(el);
    const record = records.get(el);
    if (!record) return;
    records.delete(el);
    record.observer.disconnect();
    record.decodeController?.abort();
    record.controller.abort();
    for (const [image, original] of record.images) {
        // Restore only attributes we still own; preserve subsequent native edits.
        if (image.getAttribute('src') === original.appliedSrc) setAttributeOrRemove(image, 'src', original.src);
        if (image.getAttribute('data-izoomify-url') === original.appliedZoom) setAttributeOrRemove(image, 'data-izoomify-url', original.zoom);
    }
    notifyImageChanged(el);
}

export function cleanupImages() {
    for (const controller of operations.values()) controller.abort();
    operations.clear();
    for (const el of [...records.keys()]) releaseCustomImage(el);
}

export function resetCustomImage(el) {
    if (!isManaged(el)) return;
    const key = getAvatarKey(el);
    clearCustomImageSource(el);
    releaseCustomImage(el);
    for (const [other, record] of [...records]) {
        if (record.key === key) releaseCustomImage(other);
    }
    inform('Avatar image reset');
}

export async function pickAndApplyLocalImage(el) {
    if (!isManaged(el)) { toast('Open an avatar first'); return; }
    operations.get(el)?.abort();
    const operation = new AbortController();
    operations.set(el, operation);
    try {
        const file = await pickImageFile(operation.signal);
        if (!file || operation.signal.aborted || !isManaged(el)) return;
        const source = await sourceFromLocalFile(file, { signal: operation.signal });
        if (operation.signal.aborted || !isManaged(el)) return;
        setCustomImageSource(el, source);
        const record = ensureRecord(el);
        record.decodeController?.abort();
        record.pendingUrl = null;
        record.validatedUrl = source.data;
        applyValidatedSource(el, record, source.data);
        // Multiple mounted views of the same identity share the same override.
        for (const other of document.querySelectorAll('.zoomed_avatar.am-managed')) {
            if (other !== el && getAvatarKey(other) === record.key) applyCustomImage(other);
        }
        inform('Avatar image updated');
    } catch (error) {
        if (error.name !== 'AbortError' && !operation.signal.aborted && isManaged(el)) {
            toast(error.code === 'IMAGE_TOO_LARGE' ? 'Image is too large (max 6 MB)' : 'Could not read a valid image');
        }
    } finally {
        if (operations.get(el) === operation) operations.delete(el);
    }
}

function pickImageFile(signal) {
    return new Promise(resolve => {
        if (signal.aborted) return resolve(null);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.className = 'am-image-picker';
        input.hidden = true;
        document.body.appendChild(input);
        let settled = false;
        const done = (file) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', cancel);
            input.remove();
            resolve(file);
        };
        const cancel = () => done(null);
        signal.addEventListener('abort', cancel, { once: true });
        input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true });
        input.addEventListener('cancel', cancel, { once: true });
        input.click();
    });
}
