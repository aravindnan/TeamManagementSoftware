import React, { Suspense, lazy, useEffect } from "react";
import "./App.css";
import "aos/dist/aos.css";
import AOS from "aos";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./common/ErrorBoundary";
import HomePage from "./pages/HomePage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ErrorPage from "./pages/ErrorPage";

// The authenticated app is split into its own chunks so the landing/login pages load fast.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProjectPage = lazy(() => import("./pages/ProjectPage"));
const TaskPage = lazy(() => import("./pages/TaskPage"));

const PageFallback = () => (
  <div className="w-[100vw] h-[100vh] flex justify-center items-center text-C11 text-[16px] font-light">Loading...</div>
);

function App() {
  useEffect(() => {
    AOS.init();
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/project-page" element={<ProjectPage />} />
            <Route path="/task-page" element={<TaskPage />} />
            <Route path="*" element={<ErrorPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
