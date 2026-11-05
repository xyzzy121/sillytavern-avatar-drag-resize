import { test, expect } from '@playwright/test';

test('real touch pointer capture supports pinch followed by one-finger dragging', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/'); await page.waitForFunction(() => window.ready);
    await page.evaluate(async () => {
        testApi.settings.getSettings().enableMultiTouchRotate = false;
        await testApi.openAvatar('touch', 400, 600);
    });
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    const send = (type, touchPoints) => client.send('Input.dispatchTouchEvent', { type, touchPoints });
    await send('touchStart', [{ id: 1, x: 160, y: 300 }]);
    await send('touchMove', [{ id: 1, x: 180, y: 340 }]);
    await send('touchStart', [{ id: 1, x: 180, y: 340 }, { id: 2, x: 240, y: 340 }]);
    await send('touchMove', [{ id: 1, x: 160, y: 340 }, { id: 2, x: 260, y: 340 }]);
    await expect.poll(() => page.locator('#avatar-touch').evaluate(el => Number(el.dataset.amScale))).toBeGreaterThan(1.5);
    // CDP touchEnd lists the released contacts, rather than the remaining ones.
    await send('touchEnd', [{ id: 2, x: 260, y: 340 }]);
    const before = await page.locator('#avatar-touch').evaluate(el => Number(el.dataset.amX));
    await send('touchMove', [{ id: 1, x: 185, y: 360 }]);
    await send('touchEnd', []);
    const after = await page.locator('#avatar-touch').evaluate(el => Number(el.dataset.amX));
    expect(after - before).toBeCloseTo(25);
    expect(await page.evaluate(() => testApi.state.dragState.mode)).toBeNull();
    await expect(page.locator('#avatar-touch')).not.toHaveClass(/am-pinching|am-dragging/);
    await client.detach();
});

test('invalid saved image stays native and a pending picker is cancelled on disable', async ({ page }) => {
    await page.goto('/'); await page.waitForFunction(() => window.ready);
    await page.evaluate(() => testApi.openAvatar('a'));
    const original = await page.locator('#avatar-a img').getAttribute('src');
    await page.evaluate(() => {
        const el = document.getElementById('avatar-a');
        testApi.settings.setCustomImageSource(el, 'data:image/png;base64,YWJjZA==');
        testApi.images.applyCustomImage(el);
    });
    await page.waitForTimeout(50);
    await expect(page.locator('#avatar-a img')).toHaveAttribute('src', original);
    // Avoid opening an OS chooser while testing the lifetime of its pending promise.
    await page.evaluate(() => {
        const click = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function () { if (this.type !== 'file') click.call(this); };
        window.pendingPick = testApi.images.pickAndApplyLocalImage(document.getElementById('avatar-a'));
        testApi.settings.getSettings().enabled = false; testApi.lifecycle.syncEnabled();
        HTMLInputElement.prototype.click = click;
    });
    await page.evaluate(() => pendingPick);
    await expect(page.locator('input.am-image-picker')).toHaveCount(0);
    await expect(page.locator('#avatar-a img')).toHaveAttribute('src', original);
});
