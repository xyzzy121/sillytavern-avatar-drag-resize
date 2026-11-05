import { manageAvatar, releaseAvatar, refreshAvatars } from './shared/avatar.js';
import { applyCustomImage, releaseCustomImage } from './shared/image.js';

let observer = null;
const mounted = new Set();
function sync() {
    let changed = false;
    for (const el of [...mounted]) {
        if (el.isConnected) continue;
        releaseCustomImage(el);
        releaseAvatar(el);
        mounted.delete(el);
        changed = true;
    }
    for (const el of document.querySelectorAll('body > .zoomed_avatar')) {
        if (mounted.has(el)) continue;
        mounted.add(el);
        manageAvatar(el);
        applyCustomImage(el);
        for (const other of mounted) other.classList.toggle('am-active', other === el);
        changed = true;
    }
    if (mounted.size && !document.querySelector('.am-managed.am-active')) mounted.values().next().value.classList.add('am-active');
    if (changed) document.dispatchEvent(new Event('am:avatars-changed'));
}
export const applyZIndexEverywhere = refreshAvatars;
export function startObserver() {
    if (observer) return;
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true });
    sync();
    window.addEventListener('resize', refreshAvatars);
    window.visualViewport?.addEventListener('resize', refreshAvatars);
    window.visualViewport?.addEventListener('scroll', refreshAvatars);
}
export function stopObserver() {
    observer?.disconnect();
    observer = null;
    window.removeEventListener('resize', refreshAvatars);
    window.visualViewport?.removeEventListener('resize', refreshAvatars);
    window.visualViewport?.removeEventListener('scroll', refreshAvatars);
    for (const el of mounted) { releaseCustomImage(el); releaseAvatar(el); }
    mounted.clear();
    document.dispatchEvent(new Event('am:avatars-changed'));
}
