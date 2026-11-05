import test from 'node:test';
import assert from 'node:assert/strict';
import { fitDimensions, constrainTransform, normalizeTransform } from '../src/shared/geometry.js';
import { createPositionSaver } from '../src/shared/persistence.js';

test('tall and wide images fit within a small mobile viewport without distortion', () => {
    for (const [width, height] of [[4000, 12000], [16000, 2000]]) {
        const size = fitDimensions(width, height, { width: 320, height: 568 });
        assert.ok(size.width <= 288 && size.height <= 456);
        assert.ok(Math.abs(size.width / size.height - width / height) < 1e-9);
    }
});
test('bad transforms become finite and positions remain reachable after rotation and resize', () => {
    assert.deepEqual(normalizeTransform({ x: Infinity, y: NaN, scale: -1, rotation: -90 }),
        { x: 0, y: 0, scale: 0.1, rotation: 270 });
    const result = constrainTransform({ x: 9000, y: -9000, scale: 8, rotation: 90 },
        { width: 100, height: 400 }, { width: 320, height: 568 });
    assert.ok(result.x <= 1712 + 1e-8 && result.y >= -636 - 1e-8);
    assert.equal(result.scale, 8);
});
test('pending saves snapshot each identity independently', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const saved = new Map();
    const saver = createPositionSaver((key, value) => saved.set(key, value));
    const shared = { x: 10, y: 20, scale: 2, rotation: 30 };
    saver.schedule('first', shared);
    shared.x = 90;
    saver.schedule('second', shared);
    t.mock.timers.tick(250);
    assert.equal(saved.get('first').x, 10);
    assert.equal(saved.get('second').x, 90);
});
test('reset cancels only its own pending save and cleanup flushes remaining snapshots', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const saved = new Map();
    const saver = createPositionSaver((key, value) => saved.set(key, value));
    saver.schedule('reset', { x: 20 }); saver.schedule('other', { x: 40 });
    saver.cancel('reset'); saver.flushAll();
    t.mock.timers.tick(1000);
    assert.equal(saved.has('reset'), false);
    assert.deepEqual(saved.get('other'), { x: 40 });
});
