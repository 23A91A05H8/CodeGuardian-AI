import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, LayoutDashboard, Sparkles, History } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-guardian-border bg-guardian-bg/80 backdrop-blur-glass">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <ShieldCheck className="text-guardian-accent" size={22} />
          <span className="bg-gradient-to-r from-guardian-blue to-guardian-purple bg-clip-text text-transparent">
            CodeGuardian AI
          </span>
        </Link>

        {user ? (
          <div className="flex items-center gap-1">
            <Link to="/dashboard" className="btn-secondary !px-3 !py-1.5 text-sm">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
            <Link to="/analyzer" className="btn-secondary !px-3 !py-1.5 text-sm">
              <Sparkles size={16} /> Analyzer
            </Link>
            <Link to="/history" className="btn-secondary !px-3 !py-1.5 text-sm">
              <History size={16} /> History
            </Link>
            <button onClick={handleLogout} className="btn-secondary !px-3 !py-1.5 text-sm ml-1">
              <LogOut size={16} /> Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn-primary !py-1.5 text-sm">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
