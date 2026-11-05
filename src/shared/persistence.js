// Each identity owns its pending snapshot; never read shared state in a delayed save.
export function createPositionSaver(write, delay = 250) {
    const pending = new Map();
    function cancel(key) {
        const item = pending.get(key);
        if (item) clearTimeout(item.timer);
        pending.delete(key);
    }
    function flush(key) {
        const item = pending.get(key);
        if (!item) return;
        cancel(key);
        write(key, item.value);
    }
    return {
        schedule(key, value) {
            if (!key) return;
            cancel(key);
            pending.set(key, { value: { ...value }, timer: setTimeout(() => flush(key), delay) });
        },
        cancel, flush,
        flushAll() { for (const key of [...pending.keys()]) flush(key); },
        cancelAll() { for (const key of [...pending.keys()]) cancel(key); },
    };
}
