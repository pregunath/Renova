// src/contexts/tests/AuthContext.unit.test.jsx
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { authAPI } from '@/utils/auth';

// Mock the authAPI
jest.mock('@/utils/auth');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/test'
}));

// Mock global fetch
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({}),
}));

const TestComponent = () => {
  const { user, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.email : 'no-user'}</span>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
    </div>
  );
};

describe('AuthContext', () => {
  let originalError;

  beforeAll(() => {
    // Store the original console.error
    originalError = console.error;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterAll(() => {
    // Restore console.error
    console.error = originalError;
  });

  it('should provide user data after successful auth check', async () => {
    const mockUser = { email: 'test@example.com', name: 'Test User' };
    authAPI.getCurrentUser.mockResolvedValue(mockUser);
    localStorage.setItem('accessToken', 'test-token');

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    // Wait for loading to complete and check the final state
    await screen.findByTestId('user');
    
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    expect(screen.getByTestId('loading')).toHaveTextContent('ready');
  });

  it('should handle auth check failure', async () => {
    // Mock console.error for this specific test to suppress expected error
    const mockConsoleError = jest.fn();
    console.error = mockConsoleError;

    authAPI.getCurrentUser.mockRejectedValue(new Error('Auth failed'));
    localStorage.setItem('accessToken', 'invalid-token');

    // Spy on localStorage methods
    const removeItemSpy = jest.spyOn(localStorage, 'removeItem');

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    // Wait for the component to settle
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(removeItemSpy).toHaveBeenCalledWith('accessToken');
    expect(removeItemSpy).toHaveBeenCalledWith('refreshToken');
    
    // Verify that console.error was called with the expected message
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Auth check failed:',
      expect.any(Error)
    );
    
    // Restore console.error
    console.error = originalError;
    removeItemSpy.mockRestore();
  });

  it('should set user to null when no token exists', async () => {
    // No token in localStorage
    localStorage.clear();

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    // Should not call getCurrentUser when no token
    expect(authAPI.getCurrentUser).not.toHaveBeenCalled();
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(screen.getByTestId('loading')).toHaveTextContent('ready');
  });

  // Optional: Test login functionality
  it('should login successfully and set user', async () => {
    const mockUser = { email: 'test@example.com', name: 'Test User' };
    const mockAuthResult = { accessToken: 'token', refreshToken: 'refresh' };
    
    authAPI.login.mockResolvedValue(mockAuthResult);
    authAPI.getCurrentUser.mockResolvedValue(mockUser);

    let authContext;
    const TestLoginComponent = () => {
      authContext = useAuth();
      return (
        <div>
          <span data-testid="user">{authContext.user ? authContext.user.email : 'no-user'}</span>
          <button onClick={() => authContext.login({ email: 'test@example.com', password: 'pass' })}>
            Login
          </button>
        </div>
      );
    };

    await act(async () => {
      render(
        <AuthProvider>
          <TestLoginComponent />
        </AuthProvider>
      );
    });

    // Trigger login
    await act(async () => {
      authContext.login({ email: 'test@example.com', password: 'pass' });
    });

    // Wait for user to be set
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    expect(authAPI.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'pass'
    });
    expect(localStorage.setItem).toHaveBeenCalledWith('accessToken', 'token');
    // AuthContext only sets accessToken, authAPI handles refreshToken
  });
});