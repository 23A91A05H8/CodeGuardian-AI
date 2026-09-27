import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { FileCode2, ShieldAlert, TestTube2, Gauge, Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import api from "../services/api";
import Loader from "../components/Loader";
import { DashboardStats } from "../types";

const StatCard = ({ icon: Icon, label, value, colorClass = "text-guardian-accent" }: { icon: any; label: string; value: string | number; colorClass?: string }) => (
  <div className="glass-card p-5 flex items-center gap-4">
    <div className={`p-3 rounded-xl bg-guardian-blue/15 ${colorClass}`}>
      <Icon size={22} />
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    api.get("/dashboard")
      .then(({ data }) => setStats(data))
      .catch((err) => console.error("Dashboard fetch error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return <Loader label="Loading dashboard metrics..." />;
  if (!stats) return null;

  const chartData = (stats.recent || []).map((r, i) => ({
    name: `#${i + 1} (${r.analysisType})`,
    score: r.qualityScore ?? 0,
    type: r.analysisType,
  }));

  const hasData = stats.totalAnalyses > 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Project Dashboard</h1>
          <p className="text-sm text-slate-400">Overview of code quality, security audits, and generated tests</p>
        </div>
        <button
          onClick={fetchStats}
          className="btn-secondary !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileCode2} label="Total Analyses" value={stats.totalAnalyses} />
        <StatCard icon={ShieldAlert} label="Security Issues Detected" value={stats.securityIssuesFound} colorClass="text-red-400" />
        <StatCard
          icon={Gauge}
          label="Avg Quality Score"
          value={stats.avgQualityScore !== null ? `${stats.avgQualityScore}/100` : "—"}
          colorClass="text-emerald-400"
        />
        <StatCard icon={TestTube2} label="Generated Test Suites" value={stats.generatedTests} colorClass="text-blue-400" />
      </div>

      {!hasData ? (
        <div className="glass-card p-12 text-center my-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-guardian-blue/20 text-guardian-accent flex items-center justify-center mx-auto">
            <Sparkles size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No analyses performed yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Run your first code review, bug scan, or security audit in the Analyzer to see quality trends and stats.
          </p>
          <Link to="/analyzer" className="btn-primary inline-flex items-center gap-2 mt-2">
            Go to Analyzer <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="glass-card p-6">
            <h2 className="font-semibold text-slate-200 mb-4">Quality Score Progression (Recent Analyses)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232a44" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "#121729",
                    border: "1px solid #232a44",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="score" fill="#4f6df5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-200">Recent Reports</h3>
              <Link to="/history" className="text-xs text-guardian-accent hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {stats.recent.map((item) => (
                <Link
                  key={item.id}
                  to={`/report/${item.id}`}
                  className="p-2.5 rounded-lg bg-guardian-bg/40 border border-guardian-border hover:border-guardian-blue/40 flex items-center justify-between transition-colors text-xs"
                >
                  <span className="capitalize font-medium text-slate-300">{item.analysisType}</span>
                  {item.qualityScore !== undefined && item.qualityScore !== null && (
                    <span className="font-semibold text-guardian-accent">{item.qualityScore}/100</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
