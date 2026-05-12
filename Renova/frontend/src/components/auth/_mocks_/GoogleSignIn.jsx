// src/components/auth/__mocks__/GoogleSignIn.jsx
export default function MockGoogleSignIn({ isLoading, setIsLoading, setError }) {
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
}