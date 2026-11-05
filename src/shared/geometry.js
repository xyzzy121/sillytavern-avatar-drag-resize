export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
export function fitDimensions(width, height, viewport) {
    width = Math.max(1, finite(width, 400));
    height = Math.max(1, finite(height, 600));
    const ratio = Math.min(1, Math.max(1, viewport.width - 32) / width, Math.max(1, viewport.height - 112) / height);
    return { width: width * ratio, height: height * ratio };
}
export function normalizeTransform(value = {}) {
    return { x: finite(value.x), y: finite(value.y), scale: clamp(finite(value.scale, 1), 0.1, 8),
        rotation: ((finite(value.rotation) % 360) + 360) % 360 };
}
// Keep some image reachable without preventing deliberate zoom beyond the viewport.
export function constrainTransform(value, size, viewport) {
    const result = normalizeTransform(value);
    const angle = result.rotation * Math.PI / 180;
    const width = result.scale * (Math.abs(size.width * Math.cos(angle)) + Math.abs(size.height * Math.sin(angle)));
    const height = result.scale * (Math.abs(size.width * Math.sin(angle)) + Math.abs(size.height * Math.cos(angle)));
    const maxX = Math.max(0, (viewport.width + width) / 2 - 48);
    const maxY = Math.max(0, (viewport.height + height) / 2 - 48);
    result.x = clamp(result.x, -maxX, maxX);
    result.y = clamp(result.y, -maxY, maxY);
    return result;
}
