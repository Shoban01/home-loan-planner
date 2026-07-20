/**
 * jsdom doesn't implement ResizeObserver; recharts' ResponsiveContainer
 * requires it on mount. A no-op stub is sufficient for smoke tests —
 * we assert that components render, not that charts measure themselves.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub;
}
