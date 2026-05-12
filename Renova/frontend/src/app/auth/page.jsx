// app/auth/page.jsx
"use client";

import { Suspense } from "react";
import AuthInfo from "@/components/auth/AuthInfo";
import LoginForm from "@/components/auth/LoginForm";
import SignupForm from "@/components/auth/SignupForm";
import AuthBackground from "@/components/auth/AuthBackground";
import "../../styles/auth.css";
import { useSearchParams } from "next/navigation";

export default function AuthPage() {
  return (
    <>
      <main className="auth-page">
        <section className="auth-section auth-bg-wrap">
          <AuthBackground />
          <div className="container auth-container" style={{ position: "relative", zIndex: 1 }}>
            <AuthInfo />
            <Suspense fallback={<div style={{ height: 80 }} />}>
              <AuthFormSwitcher />
            </Suspense>
          </div>
        </section>
      </main>
    </>
  );
}

function AuthFormSwitcher() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const isLogin = mode !== "signup";
  return <div className="auth-form-container">{isLogin ? <LoginForm /> : <SignupForm />}</div>;
}
