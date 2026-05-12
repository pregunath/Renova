// components/auth/LoginForm.jsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Modal } from 'antd';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleSignIn from "./GoogleSignIn";

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false); // Local state for modal
  
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for expiry message in URL parameter on mount
  useEffect(() => {
    const message = searchParams.get('message');
    const expired = searchParams.get('expired');
    console.log('[LoginForm] Checking for message in URL:', message);
    
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
    setIsLoading(true);
    setError("");

    try {
      await login(formData);
      router.push('/dashboard/moodboards');
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') {
        setShowAccessDeniedModal(true);
        setError('Your session has expired. Please log in again.');
      } else {
        setError(err.message || "Login failed. Please try again.");
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
          className="toggle-btn active"
          scroll={false}
        >
          Log In
        </Link>
        <Link 
          href="/auth?mode=signup" 
          className="toggle-btn"
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
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-options">
          <label className="checkbox">
            <input type="checkbox" disabled={isLoading} />
            <span>Remember me</span>
          </label>
          <a href="#" className="forgot-link">Forgot password?</a>
        </div>

        <button 
          type="submit" 
          className="btn gradient auth-submit"
          disabled={isLoading}
        >
          {isLoading ? "Logging in..." : "Log In"}
        </button>
      </form>

      {/* Access Expired Modal View */}
      <Modal
        title="Access Expired"
        open={showAccessDeniedModal}
        onOk={handleAccessDeniedOk}
        onCancel={handleAccessDeniedOk}
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
          variant="signin"
        />
      </div>

      <p className="auth-switch">
        Don't have an account?{" "}
        <Link 
          href="/auth?mode=signup" 
          className="switch-link"
          scroll={false}
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}