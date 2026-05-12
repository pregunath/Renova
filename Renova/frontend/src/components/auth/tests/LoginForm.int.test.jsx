// src/components/auth/tests/LoginForm.int.test.jsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LoginForm from '../LoginForm';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Mock the hooks
jest.mock('@/contexts/AuthContext');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: () => '/auth?mode=login',
  useSearchParams: () => ({ get: jest.fn() })
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock GoogleSignIn component
jest.mock('../GoogleSignIn', () => {
  return function MockGoogleSignIn({ isLoading, setIsLoading, setError }) {
    return (
      <button 
        data-testid="google-signin"
        onClick={() => {
          if (setIsLoading) setIsLoading(false);
          if (setError) setError('Google Sign-In mocked');
        }}
        disabled={isLoading}
      >
        Sign in with Google
      </button>
    );
  };
});

describe('LoginForm Integration', () => {
  const mockLogin = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAuth to return the login function but not control isLoading
    useAuth.mockReturnValue({
      login: mockLogin,
      user: null,
      isLoading: false // This doesn't control the form's isLoading state
    });
    
    useRouter.mockReturnValue({
      push: mockPush
    });

    // Mock window.origin safely without triggering navigation
    Object.defineProperty(window, 'origin', {
      writable: true,
      value: 'http://localhost:3000'
    });
  });

  it('should submit login form successfully', async () => {
    mockLogin.mockResolvedValue({});

    render(<LoginForm />);

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard/moodboards');
  });

  it('should show error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' }
    });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
    });
  });

  it('should clear error when user starts typing', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginForm />);

    // First, trigger an error
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' }
    });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
    });

    // Now type something to clear the error
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' }
    });

    // Error should be cleared
    expect(screen.queryByText(/Invalid credentials/)).not.toBeInTheDocument();
  });

  it('should disable form while submitting', async () => {
    // Create a promise that we can resolve later to simulate async login
    let resolveLogin;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    mockLogin.mockImplementation(() => loginPromise);

    render(<LoginForm />);

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // The form should be disabled while submitting
    const submitButton = screen.getByRole('button', { name: /logging in/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();

    // Resolve the login
    await act(async () => {
      resolveLogin({});
      await loginPromise;
    });

    // Form should be enabled again after login completes
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
    });
  });

  it('should show session expired error and redirect', async () => {
    mockLogin.mockRejectedValue(new Error('SESSION_EXPIRED'));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should update form data when user types', () => {
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('mypassword');
  });
});