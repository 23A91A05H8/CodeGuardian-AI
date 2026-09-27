import { NavLink } from "react-router-dom";
import { LayoutDashboard, Sparkles, History, ShieldCheck } from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analyzer", label: "Analyzer", icon: Sparkles },
  { to: "/history", label: "History", icon: History },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-guardian-border min-h-[calc(100vh-57px)] px-3 py-6 gap-1">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? "bg-guardian-blue/15 text-guardian-accent border border-guardian-blue/30"
                : "text-slate-400 hover:bg-guardian-panel hover:text-slate-200"
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
      <div className="mt-auto pt-6 flex items-center gap-2 px-3 text-xs text-slate-500">
        <ShieldCheck size={14} /> Powered by IBM watsonx.ai
      </div>
    </aside>
  );
}
