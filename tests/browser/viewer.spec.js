import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.ready);
});

async function assertToolbarVisible(page) {
    const toolbar = page.locator('#avatarmanip-mobile-controls');
    await expect(toolbar).toBeVisible();
    await expect.poll(async () => toolbar.evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    })).toBe(true);
    for (const label of ['Zoom out', 'Zoom in', 'Fit image', 'Close image']) {
        await expect(toolbar.getByRole('button', { name: label, exact: true })).toBeEnabled();
    }
}

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`close and fit stay reachable at ${size.width}×${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.evaluate(() => testApi.openAvatar('persona'));
        await expect(page.locator('#avatar-persona img')).toBeVisible();
        await assertToolbarVisible(page);
        await page.evaluate(() => {
            const el = document.getElementById('avatar-persona');
            testApi.avatar.readAvatar(el);
            Object.assign(testApi.state.dragState, { x: 9000, y: -9000, scale: 8 });
            testApi.state.rotationState.rotation = 117;
            testApi.avatar.writeAvatar(el);
        });
        await assertToolbarVisible(page);
        await page.setViewportSize({ width: size.height, height: size.width });
        await assertToolbarVisible(page);
        await page.locator('#avatarmanip-mobile-controls [data-am-action="fit"]').click();
        await expect(page.locator('#avatar-persona')).toHaveAttribute('data-am-scale', '1');
        await expect(page.locator('#avatar-persona')).toHaveAttribute('data-am-rotation', '0');
        await page.locator('#avatarmanip-mobile-controls [data-am-action="close"]').click();
        await expect(page.locator('.zoomed_avatar')).toHaveCount(0);
        await expect(page.locator('#avatarmanip-mobile-controls')).toBeHidden();
    });
}

test('pointer and keyboard controls act exactly once, hold stops on release', async ({ page }) => {
    await page.evaluate(() => testApi.openAvatar('character', 6000, 2000));
    const zoom = page.locator('#avatarmanip-mobile-controls [data-am-action="zoom-in"]');
    await zoom.click();
    await expect(page.locator('#avatar-character')).toHaveAttribute('data-am-scale', '1.1');
    await zoom.press('Enter');
    await expect.poll(() => page.locator('#avatar-character').getAttribute('data-am-scale')).toBe('1.2100000000000002');
    await zoom.press('Space');
    const afterKey = await page.locator('#avatar-character').getAttribute('data-am-scale');
    expect(Number(afterKey)).toBeCloseTo(1.331);
    const bounds = await zoom.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
    const afterHold = await page.locator('#avatar-character').getAttribute('data-am-scale');
    expect(Number(afterHold)).toBeGreaterThan(Number(afterKey) * 1.1);
    await page.waitForTimeout(200);
    await expect(page.locator('#avatar-character')).toHaveAttribute('data-am-scale', afterHold);
});

test('disabled and repeated regeneration restore native styling without duplicate controls', async ({ page }) => {
    await page.evaluate(async () => {
        testApi.settings.getSettings().enabled = false;
        testApi.lifecycle.syncEnabled();
        await testApi.openAvatar('native');
        const el = document.getElementById('avatar-native');
        el.style.setProperty('left', '77px', 'important');
        el.style.opacity = '0.85';
        testApi.settings.getSettings().enabled = true;
        testApi.lifecycle.syncEnabled();
    });
    await expect(page.locator('#avatar-native')).toHaveClass(/am-managed/);
    await page.evaluate(async () => {
        for (let i = 0; i < 3; i++) await testApi.lifecycle.regenerate();
        testApi.settings.getSettings().enabled = false;
        testApi.lifecycle.syncEnabled();
    });
    await expect(page.locator('#avatarmanip-settings')).toHaveCount(1);
    await expect(page.locator('#avatarmanip-mobile-controls')).toHaveCount(0);
    await expect(page.locator('#avatar-native')).not.toHaveClass(/am-managed/);
    expect(await page.locator('#avatar-native').evaluate(el => el.style.left)).toBe('77px');
    expect(await page.locator('#avatar-native').evaluate(el => el.style.opacity)).toBe('0.85');
});

test('two avatars save independent positions and fit cancels a pending write', async ({ page }) => {
    await page.evaluate(async () => {
        await testApi.openAvatar('a'); await testApi.openAvatar('b');
        for (const [key, x] of [['a', 25], ['b', -35]]) {
            const el = document.getElementById('avatar-' + key);
            testApi.avatar.readAvatar(el); testApi.state.dragState.x = x; testApi.avatar.writeAvatar(el);
        }
    });
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => testApi.settings.getSettings().savedPositions);
    expect(saved['char:a'].x).toBe(25); expect(saved['char:b'].x).toBe(-35);
    await page.evaluate(() => {
        const el = document.getElementById('avatar-a');
        testApi.avatar.readAvatar(el); testApi.state.dragState.x = 50; testApi.avatar.writeAvatar(el);
        testApi.avatar.resetAvatar(el);
    });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => testApi.settings.getSettings().savedPositions['char:a'])).toBeUndefined();
});

test('custom images reset independently and disabling restores originals', async ({ page }) => {
    await page.evaluate(async () => { await testApi.openAvatar('a'); await testApi.openAvatar('b'); });
    const original = await page.locator('#avatar-a img').getAttribute('src');
    const replacement = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
    await page.evaluate(async source => {
        for (const key of ['a', 'b']) {
            const el = document.getElementById('avatar-' + key);
            testApi.settings.setCustomImageSource(el, source);
            await testApi.images.applyCustomImage(el);
        }
    }, replacement);
    await expect(page.locator('#avatar-a img')).toHaveAttribute('src', replacement);
    await expect(page.locator('#avatar-b img')).toHaveAttribute('src', replacement);
    await page.evaluate(() => testApi.images.resetCustomImage(document.getElementById('avatar-a')));
    await expect(page.locator('#avatar-a img')).toHaveAttribute('src', original);
    await expect(page.locator('#avatar-b img')).toHaveAttribute('src', replacement);
    await page.evaluate(() => { testApi.settings.getSettings().enabled = false; testApi.lifecycle.syncEnabled(); });
    await expect(page.locator('#avatar-b img')).toHaveAttribute('src', original);
});

test('drawer respects themes, large text and narrow screens; captures previews', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#avatarmanip-settings .inline-drawer-toggle').click();
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '20px'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'artifacts/settings-mobile.png', fullPage: true });
    await page.evaluate(() => testApi.openAvatar('preview'));
    await assertToolbarVisible(page);
    await page.screenshot({ path: 'artifacts/viewer-mobile.png' });
    await page.locator('#avatarmanip-mobile-controls [data-am-action="close"]').click();
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.evaluate(() => {
        document.documentElement.style.setProperty('--SmartThemeBodyColor', '#202532');
        document.documentElement.style.setProperty('--SmartThemeBlurTintColor', '#edeff4');
        document.documentElement.style.setProperty('--SmartThemeEmColor', '#555b6a');
    });
    await page.screenshot({ path: 'artifacts/settings-desktop-light.png', fullPage: true });
});
