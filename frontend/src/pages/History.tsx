import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Loader from "../components/Loader";
import { AnalysisRecord } from "../types";
import { Search, Filter, ArrowRight, BookOpen, Bug, ShieldAlert, Wand2, TestTube2, FileText } from "lucide-react";

const typeLabel: Record<string, { label: string; icon: any; color: string }> = {
  explain: { label: "Explain Code", icon: BookOpen, color: "text-blue-400" },
  bugs: { label: "Bug Detection", icon: Bug, color: "text-amber-400" },
  security: { label: "Security Scan", icon: ShieldAlert, color: "text-red-400" },
  refactor: { label: "Refactor", icon: Wand2, color: "text-purple-400" },
  tests: { label: "Test Generation", icon: TestTube2, color: "text-emerald-400" },
  docs: { label: "Documentation", icon: FileText, color: "text-cyan-400" },
};

export default function History() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    api.get("/history")
      .then(({ data }) => setRecords(data.history || []))
      .catch((err) => console.error("History fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Loading analysis history..." />;

  const filtered = records.filter((r) => {
    const matchesType = filterType === "all" || r.analysisType === filterType;
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      (r.filename && r.filename.toLowerCase().includes(query)) ||
      r.analysisType.toLowerCase().includes(query) ||
      (r.language && r.language.toLowerCase().includes(query));
    return matchesType && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Analysis History</h1>
          <p className="text-sm text-slate-400">Review past code inspections, vulnerability reports, and test suites</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-guardian-bg/60 border border-guardian-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-guardian-blue/60"
            />
          </div>

          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-guardian-bg/60 border border-guardian-border rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-guardian-blue/60"
            >
              <option value="all">All Types</option>
              <option value="explain">Explain</option>
              <option value="bugs">Bugs</option>
              <option value="security">Security</option>
              <option value="refactor">Refactor</option>
              <option value="tests">Tests</option>
              <option value="docs">Docs</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400 space-y-3">
          <Filter size={32} className="mx-auto text-slate-600" />
          <p className="text-sm font-medium">No analyses match your search or filter.</p>
          {records.length === 0 && (
            <Link to="/analyzer" className="btn-primary inline-flex items-center gap-1.5 text-xs mt-2">
              Start an Analysis <ArrowRight size={13} />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const meta = typeLabel[r.analysisType] || {
              label: r.analysisType,
              icon: BookOpen,
              color: "text-slate-400",
            };
            const Icon = meta.icon;

            return (
              <Link
                to={`/report/${r._id}`}
                key={r._id}
                className="glass-card p-4 flex items-center justify-between hover:border-guardian-blue/50 transition-all group"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl bg-guardian-panel ${meta.color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-200 group-hover:text-guardian-accent transition-colors">
                        {meta.label}
                      </p>
                      {r.language && r.language !== "auto" && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                          {r.language}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.filename ? `File: ${r.filename}` : "Code Snippet"} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {r.qualityScore != null && (
                    <div className="text-right">
                      <span className="text-sm font-bold text-guardian-accent">{r.qualityScore}</span>
                      <span className="text-[10px] text-slate-500">/100</span>
                    </div>
                  )}
                  <ArrowRight size={15} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
