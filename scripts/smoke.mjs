import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ST_URL || 'http://127.0.0.1:4188', { waitUntil: 'networkidle' });
    if (await page.locator('.onboarding').isVisible()) {
        await page.locator('dialog .popup-input').fill('Avatar UI Test');
        await page.locator('dialog .popup-button-ok').click();
    }
    await page.waitForSelector('#avatarmanip-settings', { state: 'attached' });
    await page.locator('#extensions-settings-button .drawer-toggle').click();
    await page.locator('#avatarmanip-settings .inline-drawer-toggle').click();
    await page.waitForTimeout(600); // Native drawer slide animation.
    await page.locator('#avatarmanip-settings .inline-drawer-toggle').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/st-settings-desktop.png' });
    await page.locator('#extensions-settings-button .drawer-toggle').click();
    await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1500; canvas.height = 6000;
        const paint = canvas.getContext('2d');
        paint.fillStyle = '#43596c'; paint.fillRect(0, 0, 1500, 6000);
        paint.fillStyle = '#b4cec4'; paint.beginPath(); paint.arc(750, 1800, 500, 0, Math.PI * 2); paint.fill();
        const el = document.createElement('div'); el.className = 'mes'; el.id = 'am-smoke-message'; el.setAttribute('is_user', 'true');
        const avatar = document.createElement('div'); avatar.className = 'avatar';
        const image = document.createElement('img'); image.src = canvas.toDataURL(); avatar.append(image); el.append(avatar);
        const text = document.createElement('p'); text.textContent = 'Large persona image — isolated integration test'; el.append(text);
        document.getElementById('chat').append(el);
        SillyTavern.getContext().powerUserSettings.zoomed_avatar_magnification = true;
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#am-smoke-message .avatar').click();
    await page.waitForSelector('.zoomed_avatar.am-managed img', { state: 'visible' });
    const toolbar = page.locator('#avatarmanip-mobile-controls');
    await toolbar.waitFor({ state: 'visible' });
    await toolbar.locator('[data-am-action="zoom-in"]').click();
    await toolbar.locator('[data-am-action="fit"]').click();
    const rect = await page.locator('.zoomed_avatar.am-managed').boundingBox();
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 391 && rect.y + rect.height <= 845);
    await page.screenshot({ path: 'artifacts/st-viewer-mobile.png' });
    for (const mode of [true, false]) {
        await page.evaluate(mode => document.body.classList.toggle('waifuMode', mode), mode);
        await page.setViewportSize({ width: 844, height: 390 });
        await toolbar.locator('[data-am-action="fit"]').click();
        const bounds = await toolbar.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 844 && bounds.y + bounds.height <= 390);
    }
    await toolbar.locator('[data-am-action="close"]').click();
    await page.waitForSelector('.zoomed_avatar.am-managed', { state: 'detached' });
    await page.evaluate(async () => { await AvatarManip.regenerate(); await AvatarManip.regenerate(); });
    assert.equal(await page.locator('#avatarmanip-settings').count(), 1);
    assert.deepEqual(errors, []);
    console.log('SillyTavern 1.18 integration passed: native drawer, chat avatar click, large mobile image, hover magnification, VN layout, close and regeneration.');
} finally { await browser.close(); }
