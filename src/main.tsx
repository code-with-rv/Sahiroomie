import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-6 bg-white text-[#0F172A]">
          <div className="max-w-sm w-full p-5 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
            <h1 className="text-base font-extrabold">Something went wrong</h1>
            <p className="text-xs text-[#64748B]">
              Please refresh the page to reload Sahiroomie cleanly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 h-10 rounded-full bg-[#4F46E5] text-white text-xs font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
