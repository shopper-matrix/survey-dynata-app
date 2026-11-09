import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks ResizeObserver, which Radix UI and Recharts use to measure elements.
class ResizeObserverStub {
  observe(): void {
    // no-op
  }
  unobserve(): void {
    // no-op
  }
  disconnect(): void {
    // no-op
  }
}
globalThis.ResizeObserver = ResizeObserverStub;

afterEach(() => {
  cleanup();
});
