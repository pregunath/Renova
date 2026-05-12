// components/auth/GoogleSignIn.jsx
"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function GoogleSignIn({ isLoading, setIsLoading, setError, variant = "signin" }) {
  const { googleAuth } = useAuth();
  const router = useRouter();
  const googleButtonRef = useRef(null);

  useEffect(() => {
    const initializeGoogleSignIn = async () => {
      if (!window.google || isLoading) return;

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.warn('[GoogleSignIn] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set');
        setError && setError('Google Sign-In is not configured.');
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            setIsLoading(true);
            try {
              await googleAuth(response.credential);
              router.push('/dashboard/moodboards');
            } catch (err) {
              setError(err.message || 'Google sign-in failed');
            } finally {
              setIsLoading(false);
            }
          },
        });

        if (googleButtonRef.current) {
          // Guard against double-binding
          if (googleButtonRef.current.dataset.bound === 'true') return;
          googleButtonRef.current.dataset.bound = 'true';
          // Set button text based on variant
          const buttonText = variant === "signup" ? "signup_with" : "signin_with";
          
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: buttonText, 
            width: '300', 
          });
        }
      } catch (error) {
        console.error('Failed to initialize Google Sign-In:', error);
        setError('Failed to initialize Google Sign-In');
      }
    };

    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.head.appendChild(script);
    } else {
      initializeGoogleSignIn();
    }

    return () => {
      // Cleanup
      if (googleButtonRef.current) {
        googleButtonRef.current.dataset.bound = 'false';
      }
    };
  }, [isLoading, googleAuth, router, setIsLoading, setError, variant]);

  return <div ref={googleButtonRef} />;
}