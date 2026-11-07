import React from "react";
import APIResponseStatus from "./APIResponseStatus";

interface State {
  hasError: boolean;
}

// Catches render-time crashes so one broken component doesn't leave a blank white page.
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center w-full h-[100vh] gap-4">
        <APIResponseStatus status={false} message="Something went wrong" />
        <button
          className="bg-[#012b39f2] hover:bg-[#012B39] rounded-[8px] text-white font-bold text-[14px] py-2 px-6"
          onClick={() => window.location.assign("/dashboard")}
        >
          Back to dashboard
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
