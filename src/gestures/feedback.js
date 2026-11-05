// Restore native inline feedback properties instead of deleting their values.
const originals = new WeakMap();

export function beginFeedback(target, opacity) {
    if (!originals.has(target)) {
        originals.set(target, ['opacity', 'transition'].map(name => [name, target.style.getPropertyValue(name), target.style.getPropertyPriority(name)]));
    }
    target.style.setProperty('transition', 'none');
    if (opacity !== undefined) target.style.setProperty('opacity', String(opacity));
}

export function endFeedback(target) {
    if (!target) return;
    for (const [name, value, priority] of originals.get(target) ?? []) {
        if (value) target.style.setProperty(name, value, priority);
        else target.style.removeProperty(name);
    }
    originals.delete(target);
}
