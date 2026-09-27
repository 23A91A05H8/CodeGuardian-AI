import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analyzer from "./pages/Analyzer";
import History from "./pages/History";
import Report from "./pages/Report";

function AppShell() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="flex">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <>
                <Sidebar />
                <div className="flex-1">
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                </div>
              </>
            }
          />
          <Route
            path="/analyzer"
            element={
              <>
                <Sidebar />
                <div className="flex-1">
                  <ProtectedRoute>
                    <Analyzer />
                  </ProtectedRoute>
                </div>
              </>
            }
          />
          <Route
            path="/history"
            element={
              <>
                <Sidebar />
                <div className="flex-1">
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                </div>
              </>
            }
          />
          <Route
            path="/report/:id"
            element={
              <>
                <Sidebar />
                <div className="flex-1">
                  <ProtectedRoute>
                    <Report />
                  </ProtectedRoute>
                </div>
              </>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
