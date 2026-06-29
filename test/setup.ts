import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Vitest setup file. Runs once before any test file is loaded.
 *
 * IMPORTANT: We deliberately do NOT import application modules here
 * (such as `@/hooks/useAuthStore`). Test files must import those
 * modules themselves, AFTER declaring their own `vi.mock(...)` calls,
 * otherwise vite will have already cached the real module and our
 * mock factories won't take effect.
 *
 * Responsibilities:
 *   1. Register `@testing-library/jest-dom` matchers.
 *   2. Auto-clean DOM after every test.
 *   3. Clear all vi.fn() call history between tests.
 *
 * Per-test responsibilities (handled in each test file):
 *   - Reset the Zustand store state in `beforeEach` after importing it.
 *   - Reset mock implementations in `beforeEach` after declaring the mock.
 */

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
