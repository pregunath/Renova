// components/auth/SignupForm.jsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react"; // Added useEffect import
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation"; // Added useSearchParams
import GoogleSignIn from "./GoogleSignIn";
import { Modal } from 'antd';

export default function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    occupation: "",
  });
  const [error, setError] = useState("");
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams(); // Added searchParams

  // Check for expiry message in URL parameter on mount
  useEffect(() => {
    const message = searchParams.get('message');
    const expired = searchParams.get('expired');
    console.log('[SignupForm] Checking for message in URL:', message);
    
    if (expired === 'true' || message) {
      setShowAccessDeniedModal(true);
      if (message) {
        setError(decodeURIComponent(message));
      } else {
        setError('Your session has expired. Please log in again.');
      }
    }
  }, [searchParams]);

  const handleAccessDeniedOk = () => {
    setShowAccessDeniedModal(false);
    setError('');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const userData = {
        email: formData.email,
        password: formData.password,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        occupation: formData.occupation || undefined,
      };

      await register(userData);
      router.push('/dashboard/moodboards');
    } catch (err) {
      // Handle session expiry specifically
      if (err.message === 'SESSION_EXPIRED') {
        setShowAccessDeniedModal(true);
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="auth-form-wrapper">
      <div className="auth-toggle">
        <Link 
          href="/auth?mode=login" 
          className="toggle-btn"
          scroll={false}
        >
          Log In
        </Link>
        <Link 
          href="/auth?mode=signup" 
          className="toggle-btn active"
          scroll={false}
        >
          Sign Up
        </Link>
      </div>

      {error && !showAccessDeniedModal && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              placeholder="Enter your first name"
              value={formData.firstName}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              placeholder="Enter your last name"
              value={formData.lastName}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="occupation">Occupation (Optional)</label>
          <input
            type="text"
            id="occupation"
            placeholder="e.g., Designer, Architect, Homeowner"
            value={formData.occupation}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isLoading}
            minLength={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            disabled={isLoading}
            minLength={6}
          />
        </div>

        <button 
          type="submit" 
          className="btn gradient auth-submit"
          disabled={isLoading}
        >
          {isLoading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>

      {/* Access Expired Modal View */}
      <Modal
        title="Access Expired"
        open={showAccessDeniedModal}
        onOk={handleAccessDeniedOk}
        onCancel={handleAccessDeniedOk}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="OK"
        centered
      >
        <p>{error || 'Your session has expired. Please log in again.'}</p>
      </Modal>

      <div className="auth-divider">
        <span>or continue with</span>
      </div>

      <div className="social-auth">
        <GoogleSignIn
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          setError={setError}
          variant="signup"
        />
      </div>

      <p className="auth-switch">
        Already have an account?{" "}
        <Link 
          href="/auth?mode=login" 
          className="switch-link"
          scroll={false}
        >
          Log in
        </Link>
      </p>
    </div>
  );
}