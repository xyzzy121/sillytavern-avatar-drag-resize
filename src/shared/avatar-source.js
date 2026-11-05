import { AVATAR_SOURCE_KINDS, MAX_CUSTOM_IMAGE_BYTES } from './constants.js';

function abortError() {
    return new DOMException('Image operation cancelled', 'AbortError');
}

export function readAsDataUrl(file, { signal } = {}) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        const reader = new FileReader();
        const cleanup = () => signal?.removeEventListener('abort', cancel);
        const cancel = () => reader.abort();
        reader.onload = () => { cleanup(); resolve(reader.result); };
        reader.onerror = () => { cleanup(); reject(reader.error ?? new Error('Read failed')); };
        reader.onabort = () => { cleanup(); reject(abortError()); };
        signal?.addEventListener('abort', cancel, { once: true });
        reader.readAsDataURL(file);
    });
}

// Stored overrides are image data URLs only. Never turn a malformed setting into
// a network request, and apply the same byte limit to imported saved settings.
export function isImageDataUrl(value) {
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_CUSTOM_IMAGE_BYTES / 3) * 4 + 256) return false;
    const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/]*={0,2})$/i.exec(value);
    if (!match || !match[1].length || match[1].length % 4 !== 0) return false;
    const padding = match[1].endsWith('==') ? 2 : match[1].endsWith('=') ? 1 : 0;
    return match[1].length / 4 * 3 - padding <= MAX_CUSTOM_IMAGE_BYTES;
}

export function validateImageDataUrl(data, { signal } = {}) {
    if (!isImageDataUrl(data)) return Promise.reject(new Error('INVALID_IMAGE'));
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        const image = new Image();
        let settled = false;
        const timer = setTimeout(() => finish(new Error('IMAGE_DECODE_TIMEOUT')), 10000);
        const finish = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
            image.onload = image.onerror = null;
            image.removeAttribute('src');
            if (error) reject(error);
            else resolve(data);
        };
        const cancel = () => finish(abortError());
        image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : new Error('INVALID_IMAGE'));
        image.onerror = () => finish(new Error('INVALID_IMAGE'));
        signal?.addEventListener('abort', cancel, { once: true });
        image.src = data;
    });
}

export async function sourceFromLocalFile(file, options = {}) {
    if (!file) throw new Error('NO_FILE');
    if (file.size > MAX_CUSTOM_IMAGE_BYTES) {
        const error = new Error('IMAGE_TOO_LARGE');
        error.code = 'IMAGE_TOO_LARGE';
        throw error;
    }
    if (!file.type?.startsWith('image/')) throw new Error('INVALID_IMAGE');
    const data = await readAsDataUrl(file, options);
    await validateImageDataUrl(data, options);
    return { kind: AVATAR_SOURCE_KINDS.DATA_URL, data };
}

export function normaliseSource(raw) {
    const source = typeof raw === 'string' ? { kind: AVATAR_SOURCE_KINDS.DATA_URL, data: raw } : raw;
    if (source?.kind !== AVATAR_SOURCE_KINDS.DATA_URL || !isImageDataUrl(source.data)) return null;
    return { kind: AVATAR_SOURCE_KINDS.DATA_URL, data: source.data };
}

export function resolveSourceToUrl(source) {
    return normaliseSource(source)?.data ?? null;
}
