import test from 'node:test';
import assert from 'node:assert/strict';
import { registerInputHandlers, unregisterInputHandlers } from '../src/input.js';
import { manageAvatar, cleanupAvatars } from '../src/shared/avatar.js';
import { initSettings } from '../src/shared/settings.js';
import { dragState, touchState, resetInteractionState } from '../src/shared/state.js';

class Avatar extends EventTarget {
    constructor(name) {
        super();
        this.name = name;
        this.dataset = {};
        this.isConnected = true;
        const classes = new Set(['zoomed_avatar']);
        this.classList = { add: (...items) => items.forEach(item => classes.add(item)),
            remove: (...items) => items.forEach(item => classes.delete(item)), contains: item => classes.has(item) };
        const styles = new Map();
        this.style = { getPropertyValue: name => styles.get(name)?.value ?? '',
            getPropertyPriority: name => styles.get(name)?.priority ?? '',
            setProperty: (name, value, priority = '') => styles.set(name, { value: String(value), priority }),
            removeProperty: name => styles.delete(name) };
    }
    getAttribute(name) { return name === 'forChar' ? this.name : null; }
    querySelector(selector) { return selector === 'img' ? { naturalWidth: 400, naturalHeight: 600 } : null; }
    closest(selector) { return selector.startsWith('.zoomed_avatar') && this.classList.contains('am-managed') ? this : null; }
    getBoundingClientRect() { return { left: 100, top: 100, width: 200, height: 300 }; }
    setPointerCapture() {}
    hasPointerCapture() { return false; }
}

function fixture(t) {
    globalThis.document = new EventTarget();
    globalThis.window = new EventTarget();
    Object.assign(window, { innerWidth: 390, innerHeight: 844 });
    const context = { extensionSettings: {}, saveSettingsDebounced() {} };
    globalThis.SillyTavern = { getContext: () => context };
    const settings = initSettings();
    settings.showToasts = false;
    const avatars = [new Avatar('first'), new Avatar('second')];
    document.querySelectorAll = selector => avatars.filter(avatar => avatar.isConnected &&
        (!selector.includes('.am-active') || avatar.classList.contains('am-active')));
    avatars.forEach(manageAvatar);
    resetInteractionState();
    registerInputHandlers();
    t.after(() => {
        unregisterInputHandlers();
        cleanupAvatars();
        delete globalThis.document;
        delete globalThis.window;
        delete globalThis.SillyTavern;
    });
    const send = (type, avatar, id, x, y, pointerType = 'touch') => {
        const event = new Event(type, { cancelable: true });
        for (const [key, value] of Object.entries({ target: avatar, pointerId: id, clientX: x, clientY: y, pointerType, button: 0 })) {
            Object.defineProperty(event, key, { value });
        }
        document.dispatchEvent(event);
        return event;
    };
    return { avatars, send, settings };
}

test('one-finger touches near an image edge drag instead of rotating', t => {
    const { avatars: [avatar], send } = fixture(t);
    send('pointerdown', avatar, 1, 100, 100);
    assert.equal(dragState.mode, 'drag');
    send('pointermove', avatar, 1, 140, 120);
    send('pointerup', avatar, 1, 140, 120);
    assert.equal(Number(avatar.dataset.amX), 40);
    assert.equal(Number(avatar.dataset.amRotation), 0);
    assert.equal(dragState.target, null);
});

test('a second avatar cannot steal the first avatar’s in-progress gesture', t => {
    const { avatars: [first, second], send } = fixture(t);
    send('pointerdown', first, 1, 150, 150);
    send('pointerdown', second, 2, 220, 150);
    send('pointermove', second, 2, 260, 200);
    assert.equal(dragState.target, first);
    assert.equal(touchState.touches.size, 1);
    assert.equal(Number(second.dataset.amX), 0);
    send('pointerup', second, 2, 260, 200);
    send('pointermove', first, 1, 180, 160);
    assert.equal(Number(first.dataset.amX), 30);
});

test('pinch transitions back to dragging the remaining finger without jumping', t => {
    const { avatars: [avatar], send } = fixture(t);
    send('pointerdown', avatar, 1, 100, 200);
    send('pointerdown', avatar, 2, 200, 200);
    assert.equal(dragState.mode, 'pinch');
    assert.equal(avatar.classList.contains('am-dragging'), false);
    send('pointermove', avatar, 2, 250, 200);
    assert.equal(Number(avatar.dataset.amScale), 1.5);
    send('pointerup', avatar, 2, 250, 200);
    assert.equal(dragState.mode, 'drag');
    assert.equal(avatar.classList.contains('am-pinching'), false);
    const previousX = Number(avatar.dataset.amX);
    send('pointermove', avatar, 1, 120, 200);
    assert.equal(Number(avatar.dataset.amX), previousX + 20);
    send('pointerup', avatar, 1, 120, 200);
    assert.equal(dragState.mode, null);
});

test('rapid drags are not interpreted as double-tap reset, while stationary taps are', t => {
    const { avatars: [avatar], send } = fixture(t);
    for (let id = 1; id <= 2; id++) {
        send('pointerdown', avatar, id, 150, 150);
        send('pointermove', avatar, id, 180, 150);
        send('pointerup', avatar, id, 180, 150);
    }
    assert.equal(Number(avatar.dataset.amX), 60);
    for (let id = 3; id <= 4; id++) {
        send('pointerdown', avatar, id, 150, 150);
        send('pointerup', avatar, id, 150, 150);
    }
    assert.equal(Number(avatar.dataset.amX), 0);
    assert.equal(Number(avatar.dataset.amScale), 1);
});

test('cancellation clears both pinch pointers and restores native feedback styling', t => {
    const { avatars: [avatar], send } = fixture(t);
    avatar.style.setProperty('opacity', '0.42', 'important');
    avatar.style.setProperty('transition', 'opacity 1s');
    send('pointerdown', avatar, 1, 100, 200);
    send('pointerdown', avatar, 2, 200, 200);
    send('pointercancel', avatar, 2, 200, 200);
    assert.equal(dragState.target, null);
    assert.equal(touchState.touches.size, 0);
    assert.equal(touchState.isPinching, false);
    assert.equal(avatar.style.getPropertyValue('opacity'), '0.42');
    assert.equal(avatar.style.getPropertyPriority('opacity'), 'important');
    assert.equal(avatar.style.getPropertyValue('transition'), 'opacity 1s');
});

test('small finger jitter allows long-press fit; movement cancels it', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { avatars: [avatar], send, settings } = fixture(t);
    avatar.dataset.amX = '90';
    send('pointerdown', avatar, 1, 100, 200);
    send('pointermove', avatar, 1, 103, 202);
    t.mock.timers.tick(settings.longPressDuration);
    assert.equal(Number(avatar.dataset.amX), 0);
    assert.equal(dragState.target, null);
    send('pointerdown', avatar, 2, 100, 200);
    send('pointermove', avatar, 2, 120, 200);
    t.mock.timers.tick(settings.longPressDuration);
    assert.equal(Number(avatar.dataset.amX), 20);
    assert.equal(dragState.target, avatar);
});

test('blur and avatar removal terminate gestures and long-press callbacks', t => {
    const { avatars: [avatar], send } = fixture(t);
    send('pointerdown', avatar, 1, 100, 200);
    window.dispatchEvent(new Event('blur'));
    assert.equal(dragState.target, null);
    assert.equal(touchState.longPressTimer, null);
    send('pointerdown', avatar, 2, 100, 200);
    avatar.isConnected = false;
    document.dispatchEvent(new Event('am:avatars-changed'));
    assert.equal(dragState.target, null);
    assert.equal(touchState.longPressTimer, null);
});
