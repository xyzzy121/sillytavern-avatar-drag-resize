import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    initSettings, getSettings, getAvatarKey, loadPosition, savePosition,
    clearPosition, setCustomImageSource, getCustomImageSource,
} from '../src/shared/settings.js';
import {
    normaliseSource, isImageDataUrl, resolveSourceToUrl,
    validateImageDataUrl, sourceFromLocalFile,
} from '../src/shared/avatar-source.js';
import { MAX_CUSTOM_IMAGE_BYTES } from '../src/shared/constants.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=';
let context;

function avatar(name, src = '/characters/avatar.png') {
    return {
        dataset: {},
        getAttribute: key => key === 'forChar' ? name : null,
        querySelector: () => ({ dataset: {}, getAttribute: () => src }),
    };
}

beforeEach(() => {
    context = { extensionSettings: {}, saveSettingsDebounced() {} };
    globalThis.SillyTavern = { getContext: () => context };
});

test('migrates malformed settings while preserving valid preferences and legacy bias', () => {
    const original = {
        enabled: false, enableRotation: 'false', zIndexMode: 'invalid',
        zoomSpeed: Infinity, mobileMoveStep: -2, doubleTapTimeout: 350.4,
        mobileYBias: 200, savedPositions: [], customImages: null,
    };
    context.extensionSettings.avatar_manip = original;
    const settings = initSettings();
    assert.equal(settings, original);
    assert.equal(settings.enabled, false);
    assert.equal(settings.enableRotation, true);
    assert.equal(settings.zIndexMode, 'aboveUI');
    assert.equal(settings.zoomSpeed, 0.1);
    assert.equal(settings.mobileMoveStep, 5);
    assert.equal(settings.doubleTapTimeout, 350);
    assert.equal(settings.mobileYBias, 200);
    assert.deepEqual(Object.keys(settings.savedPositions), []);
    assert.deepEqual(Object.keys(settings.customImages), []);
});

test('new settings center images, sanitize transforms, and retain valid custom image values', () => {
    context.extensionSettings.avatar_manip = {
        savedPositions: { 'char:A': { x: NaN, y: Infinity, scale: -2, rotation: -450 }, 'char:B': false },
        customImages: { 'char:A': png, 'char:B': { kind: 'dataUrl', data: 'https://example.com/image.png' } },
    };
    const settings = initSettings();
    assert.equal(settings.mobileYBias, 0);
    assert.deepEqual(settings.savedPositions['char:A'], { x: 0, y: 0, scale: 0.1, rotation: 270 });
    assert.equal(settings.savedPositions['char:B'], undefined);
    assert.equal(settings.customImages['char:A'].data, png);
    assert.equal(settings.customImages['char:B'], undefined);
});

test('legacy avatar keys stay stable when images change and positions remain independent', () => {
    initSettings();
    const a = avatar('A');
    const b = avatar('B');
    assert.equal(getAvatarKey(a), 'char:A');
    savePosition(a, { x: 50, y: -10, scale: 2, rotation: 90 });
    savePosition(b, { x: -20, y: 30, scale: 3, rotation: 0 });
    setCustomImageSource(a, { kind: 'dataUrl', data: png });
    assert.equal(getAvatarKey(a), 'char:A');
    assert.equal(getCustomImageSource(a).data, png);
    assert.equal(getCustomImageSource(b), null);
    clearPosition(a);
    assert.equal(loadPosition(a), null);
    assert.equal(loadPosition(b).x, -20);
    const noCharacter = avatar(null, '/User%20Avatars/persona.png?timestamp=1');
    assert.equal(getAvatarKey(noCharacter), 'img:/User%20Avatars/persona.png');
});

test('missing SillyTavern settings reports a useful initialization error', () => {
    context.extensionSettings = undefined;
    assert.throws(() => getSettings(), /SillyTavern extension settings are not ready/);
});

test('stored image values reject URLs, non-image data, corrupt base64, and oversized payloads', () => {
    assert.equal(resolveSourceToUrl(png), png);
    for (const value of ['https://example.com/a.png', 'javascript:alert(1)', 'data:text/html;base64,YQ==', 'data:image/png;base64,!', 'data:image/png;base64,Y']) {
        assert.equal(normaliseSource(value), null);
    }
    assert.equal(isImageDataUrl('data:image/png;base64,' + 'A'.repeat(Math.ceil(MAX_CUSTOM_IMAGE_BYTES / 3) * 4 + 4)), false);
});

test('image decoding rejects corrupt image bytes and supports lifecycle cancellation', async () => {
    const previousImage = globalThis.Image;
    globalThis.Image = class {
        set src(value) {
            queueMicrotask(() => {
                if (value === png) { this.naturalWidth = this.naturalHeight = 1; this.onload?.(); }
                else this.onerror?.();
            });
        }
        removeAttribute() {}
    };
    try {
        assert.equal(await validateImageDataUrl(png), png);
        await assert.rejects(validateImageDataUrl('data:image/png;base64,YQ=='), /INVALID_IMAGE/);
        const controller = new AbortController();
        const pending = validateImageDataUrl(png, { signal: controller.signal });
        controller.abort();
        await assert.rejects(pending, error => error.name === 'AbortError');
        await assert.rejects(sourceFromLocalFile({ size: MAX_CUSTOM_IMAGE_BYTES + 1, type: 'image/png' }), error => error.code === 'IMAGE_TOO_LARGE');
        await assert.rejects(sourceFromLocalFile({ size: 5, type: 'text/plain' }), /INVALID_IMAGE/);
    } finally {
        globalThis.Image = previousImage;
    }
});
