import "./globals.css";
import { AuthProvider } from '../contexts/AuthContext';
import ClonePresetOnMount from "@/components/ClonePresetOnMount";

export const metadata = {
  title: "Renova — Design your dream room",
  description: "Create moodboards and preview AI-powered renovations.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ClonePresetOnMount />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

