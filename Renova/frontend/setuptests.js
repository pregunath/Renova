// setupTests.js
require('@testing-library/jest-dom');

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useParams: () => ({ id: 'test-board-id' }),
  useSearchParams: () => new URLSearchParams(),
}));

// Enhanced localStorage mock
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch globally
global.fetch = jest.fn();

// crypto.randomUUID — jsdom doesn't expose this; boardStore uses it for item IDs.
if (!globalThis.crypto) globalThis.crypto = {};
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let _uuidCounter = 0;
  globalThis.crypto.randomUUID = () => `test-uuid-${++_uuidCounter}`;
}

// URL blob helpers — used by GenerationsView download flow.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = jest.fn(() => 'blob:mock-url');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = jest.fn();
}

// Clear localStorage between tests so state never leaks across cases.
beforeEach(() => {
  localStorage.clear();
});

// Suppress console.errors for expected errors
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Not implemented: navigation')
  ) {
    return;
  }
  originalError.call(console, ...args);
};