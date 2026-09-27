import { useState } from "react";
import CodeEditor from "../components/CodeEditor";
import Loader from "../components/Loader";
import ReportCard from "../components/ReportCard";
import ScoreChart from "../components/ScoreChart";
import { useAnalysis } from "../hooks/useAnalysis";
import { AnalysisType } from "../types";
import { BookOpen, Bug, ShieldAlert, Wand2, TestTube2, FileText, AlertCircle, RefreshCw } from "lucide-react";

const ANALYSIS_OPTIONS: { type: AnalysisType; label: string; desc: string; icon: any }[] = [
  { type: "explain", label: "Explain Code", desc: "Purpose, logic flow & dependencies", icon: BookOpen },
  { type: "bugs", label: "Find Bugs", desc: "Logical errors & runtime issues", icon: Bug },
  { type: "security", label: "Security Scan", desc: "Vulnerability & injection scan", icon: ShieldAlert },
  { type: "refactor", label: "Refactor", desc: "Clean code & modernization", icon: Wand2 },
  { type: "tests", label: "Generate Tests", desc: "Unit test suite generation", icon: TestTube2 },
  { type: "docs", label: "Generate Docs", desc: "Markdown documentation", icon: FileText },
];

export default function Analyzer() {
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState<string | undefined>();
  const [analysisType, setAnalysisType] = useState<AnalysisType>("explain");
  const { runAnalysis, loading, error, result } = useAnalysis();

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    try {
      await runAnalysis({ code, filename, analysisType });
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Code Analyzer</h1>
          <p className="text-sm text-slate-400">
            Powered by IBM watsonx.ai Granite models & heuristic security scanner
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <CodeEditor
          value={code}
          onChange={setCode}
          onFileLoaded={(name) => setFilename(name)}
        />

        <div className="glass-card p-5 flex flex-col gap-2.5 h-fit">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Choose Analysis Mode
          </span>
          {ANALYSIS_OPTIONS.map(({ type, label, desc, icon: Icon }) => (
            <label
              key={type}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                analysisType === type
                  ? "border-guardian-blue bg-guardian-blue/15 text-guardian-accent shadow-sm shadow-guardian-blue/20"
                  : "border-guardian-border text-slate-300 hover:border-guardian-blue/40 hover:bg-guardian-panel/50"
              }`}
            >
              <input
                type="radio"
                name="analysisType"
                className="hidden"
                checked={analysisType === type}
                onChange={() => setAnalysisType(type)}
              />
              <Icon size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-medium block leading-tight">{label}</span>
                <span className="text-xs text-slate-400 block mt-0.5 leading-snug">{desc}</span>
              </div>
            </label>
          ))}

          <button
            onClick={handleAnalyze}
            disabled={loading || !code.trim()}
            className="btn-primary w-full justify-center mt-3 !py-2.5"
          >
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>
      </div>

      <div className="mt-8">
        {loading && <Loader isStepLoader={true} />}

        {error && !loading && (
          <div className="glass-card p-4 border border-red-500/30 flex items-start justify-between gap-3 text-red-300">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Analysis Request Failed</p>
                <p className="text-xs text-red-300/90 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              className="btn-secondary !px-2.5 !py-1 text-xs shrink-0 inline-flex items-center gap-1 text-slate-300"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {result && !loading && (
          <div className="grid lg:grid-cols-[220px_1fr] gap-6">
            {result.result.quality_score && (
              <div className="glass-card p-5 h-fit text-center">
                <p className="text-sm font-semibold text-slate-300 mb-3">Quality Score</p>
                <ScoreChart score={result.result.quality_score.score} />
                <div className="mt-4 pt-3 border-t border-guardian-border text-left space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Base Score:</span>
                    <span className="text-slate-200">100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Issues Penalty:</span>
                    <span className="text-red-400">
                      {String((result.result.quality_score.breakdown as any)?.issue_penalty ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Comment Bonus:</span>
                    <span className="text-emerald-400">
                      +{String((result.result.quality_score.breakdown as any)?.comment_bonus ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <ReportCard result={result.result} />
          </div>
        )}
      </div>
    </div>
  );
}
