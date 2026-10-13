import { useState } from "react";
import { AnalysisResult, Issue } from "../types";
import {
  AlertTriangle,
  ShieldAlert,
  Wand2,
  TestTube2,
  FileText,
  BookOpen,
  Copy,
  Check,
  Download,
  Info,
} from "lucide-react";

const severityClass: Record<string, string> = {
  critical: "severity-critical",
  high: "severity-high",
  medium: "severity-medium",
  low: "severity-low",
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-guardian-panel border border-guardian-border hover:border-guardian-blue/50 text-slate-300 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      <span>{copied ? "Copied!" : label}</span>
    </button>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues || issues.length === 0) {
    return <p className="text-sm text-slate-400">No issues flagged in this category.</p>;
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, i) => (
        <div key={i} className={`border rounded-xl p-4 ${severityClass[issue.severity] || "border-guardian-border"}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-sm">{issue.title}</span>
            <span className="text-xs uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-black/30">
              {issue.severity}
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{issue.description}</p>
          {issue.line && (
            <p className="text-xs text-slate-400 mt-1">📍 Near line: {issue.line}</p>
          )}
          {issue.recommendation && (
            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-start gap-1.5 text-xs text-slate-300">
              <span className="text-guardian-accent font-semibold shrink-0">Recommendation:</span>
              <span>{issue.recommendation}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ReportCard({ result }: { result: AnalysisResult }) {
  const downloadMarkdown = () => {
    let md = `# CodeGuardian AI — Analysis Report\n\n`;
    md += `**Analysis Type:** ${result.analysis_type}\n`;
    if (result.quality_score) {
      md += `**Quality Score:** ${result.quality_score.score}/100\n`;
    }
    md += `**Execution Mode:** ${result.mock_mode ? "Demo / Mock Mode" : "IBM watsonx.ai (Granite Model)"}\n\n---\n\n`;

    if (result.explanation) {
      md += `## Purpose\n${result.explanation.purpose}\n\n`;
      md += `### Logic Flow\n` + result.explanation.logic_flow.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n\n";
      md += `### Dependencies\n` + result.explanation.dependencies.map((d) => `- ${d}`).join("\n") + "\n\n";
      if (result.explanation.potential_problems?.length) {
        md += `### Potential Problems\n` + result.explanation.potential_problems.map((p) => `- ${p}`).join("\n") + "\n\n";
      }
    }

    if (result.bugs) {
      md += `## Bug Detection\n${result.bugs.summary}\n\n`;
      result.bugs.issues.forEach((iss, i) => {
        md += `### ${i + 1}. ${iss.title} [${iss.severity.toUpperCase()}]\n${iss.description}\n`;
        if (iss.recommendation) md += `*Recommendation:* ${iss.recommendation}\n\n`;
      });
    }

    if (result.security) {
      md += `## Security Audit\nOverall Risk: ${result.security.overall_risk.toUpperCase()}\n${result.security.summary}\n\n`;
      result.security.issues.forEach((iss, i) => {
        md += `### ${i + 1}. ${iss.title} [${iss.severity.toUpperCase()}]\n${iss.description}\n`;
        if (iss.recommendation) md += `*Recommendation:* ${iss.recommendation}\n\n`;
      });
    }

    if (result.refactor) {
      md += `## Refactoring Suggestions\n${result.refactor.rationale}\n\n`;
      result.refactor.suggestions.forEach((s) => (md += `- ${s}\n`));
      if (result.refactor.refactored_code) {
        md += `\n\`\`\`\n${result.refactor.refactored_code}\n\`\`\`\n`;
      }
    }

    if (result.tests) {
      md += `## Generated Unit Tests (${result.tests.framework})\n\n\`\`\`\n${result.tests.test_code}\n\`\`\`\n`;
    }

    if (result.docs) {
      md += `## Generated Documentation\n\n${result.docs.documentation}\n`;
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `codeguardian-report-${result.analysis_type}-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-guardian-border">
        <div className="flex items-center gap-2">
          {result.mock_mode ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Info size={13} /> Demo Mode (Heuristic Fallback)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Check size={13} /> IBM watsonx.ai Live
            </span>
          )}
        </div>

        <button
          onClick={downloadMarkdown}
          className="btn-secondary !px-3 !py-1 text-xs inline-flex items-center gap-1.5"
        >
          <Download size={14} /> Export Markdown
        </button>
      </div>

      {result.mock_mode && result.fallback_reason && (
        <p className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          <span className="font-semibold">Why demo mode?</span> {result.fallback_reason}
        </p>
      )}

      {result.explanation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-100">
              <BookOpen size={20} className="text-guardian-accent" /> Code Explanation
            </h3>
            <CopyButton text={result.explanation.purpose} label="Copy Purpose" />
          </div>
          <p className="text-slate-300 leading-relaxed bg-guardian-bg/40 p-4 rounded-xl border border-guardian-border">
            {result.explanation.purpose}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-guardian-bg/30 p-4 rounded-xl border border-guardian-border">
              <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3">Logic Flow</h4>
              <ol className="list-decimal list-inside text-sm space-y-2 text-slate-300">
                {result.explanation.logic_flow.map((step, i) => (
                  <li key={i} className="pl-1 leading-normal">{step}</li>
                ))}
              </ol>
            </div>
            <div className="bg-guardian-bg/30 p-4 rounded-xl border border-guardian-border">
              <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3">Dependencies</h4>
              <ul className="list-disc list-inside text-sm space-y-2 text-slate-300">
                {result.explanation.dependencies.map((dep, i) => (
                  <li key={i} className="pl-1 leading-normal">{dep}</li>
                ))}
              </ul>
            </div>
          </div>
          {result.explanation.potential_problems && result.explanation.potential_problems.length > 0 && (
            <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20">
              <h4 className="text-xs uppercase font-semibold text-amber-400 tracking-wider mb-2">Potential Smells & Risks</h4>
              <ul className="list-disc list-inside text-sm space-y-1.5 text-slate-300">
                {result.explanation.potential_problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result.bugs && (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-100">
            <AlertTriangle size={20} className="text-amber-400" /> Bug Detection
          </h3>
          <p className="text-sm text-slate-300 bg-guardian-bg/40 p-3 rounded-lg border border-guardian-border">
            {result.bugs.summary}
          </p>
          <IssueList issues={result.bugs.issues} />
        </div>
      )}

      {result.security && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-100">
              <ShieldAlert size={20} className="text-red-400" /> Security Vulnerability Audit
            </h3>
            <span className="text-xs uppercase font-semibold px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
              Overall Risk: {result.security.overall_risk}
            </span>
          </div>
          <p className="text-sm text-slate-300 bg-guardian-bg/40 p-3 rounded-lg border border-guardian-border">
            {result.security.summary}
          </p>
          <IssueList issues={result.security.issues} />
        </div>
      )}

      {result.refactor && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-100">
              <Wand2 size={20} className="text-guardian-accent" /> Refactoring & Modernization
            </h3>
            {result.refactor.refactored_code && (
              <CopyButton text={result.refactor.refactored_code} label="Copy Refactored Code" />
            )}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{result.refactor.rationale}</p>
          <div className="bg-guardian-bg/40 p-4 rounded-xl border border-guardian-border">
            <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">Key Improvements</h4>
            <ul className="list-disc list-inside text-sm space-y-1.5 text-slate-300">
              {result.refactor.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          {result.refactor.refactored_code && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-mono">Suggested Implementation</span>
              </div>
              <pre className="bg-[#0b0f19] border border-guardian-border rounded-xl p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                <code>{result.refactor.refactored_code}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {result.tests && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-100">
              <TestTube2 size={20} className="text-emerald-400" /> Generated Tests ({result.tests.framework})
            </h3>
            <CopyButton text={result.tests.test_code} label="Copy Tests" />
          </div>
          {result.tests.notes && (
            <p className="text-xs text-slate-400 bg-guardian-bg/40 p-3 rounded-lg border border-guardian-border">
              💡 {result.tests.notes}
            </p>
          )}
          <pre className="bg-[#0b0f19] border border-guardian-border rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
            <code>{result.tests.test_code}</code>
          </pre>
        </div>
      )}

      {result.docs && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-lg text-slate-100">
              <FileText size={20} className="text-blue-400" /> Generated Documentation
            </h3>
            <CopyButton text={result.docs.documentation} label="Copy Markdown" />
          </div>
          <pre className="bg-[#0b0f19] border border-guardian-border rounded-xl p-4 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {result.docs.documentation}
          </pre>
        </div>
      )}
    </div>
  );
}
