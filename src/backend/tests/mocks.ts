import { vi } from 'vitest';

export const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

export const mockUow = {
  getRepository: vi.fn(),
  runInTransaction: vi.fn(async (callback) => {
    // Mock a simple transaction: just execute the callback with dummy tx
    return await callback({ getRepository: vi.fn() }, {});
  }),
};
