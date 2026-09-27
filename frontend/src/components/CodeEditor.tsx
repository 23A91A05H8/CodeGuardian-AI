import { useRef } from "react";
import { UploadCloud, Trash2, Sparkles } from "lucide-react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onFileLoaded?: (filename: string, content: string) => void;
}

const SAMPLE_SNIPPETS = [
  {
    name: "Vulnerable Python SQL",
    code: `import sqlite3

def get_user_profile(user_input_id):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    # Unsafe string concatenation query
    query = "SELECT * FROM users WHERE id = '" + user_input_id + "'"
    cursor.execute(query)
    record = cursor.fetchone()
    return record`,
  },
  {
    name: "Buggy JS Async Loop",
    code: `async function fetchAllUserData(userIds) {
  let results = [];
  // Logical flaw: forEach does not await async operations
  userIds.forEach(async (id) => {
    try {
      const res = await fetch('/api/user/' + id);
      const data = await res.json();
      results.push(data);
    } catch {
      // Swallowing errors silently
    }
  });
  return results; // Returns empty array immediately!
}`,
  },
  {
    name: "TypeScript Factorial & Cache",
    code: `// Computes factorial with simple memoization
const memo: Record<number, number> = {};

export function factorial(n: number): number {
  if (n < 0) throw new Error("n must be non-negative");
  if (n === 0 || n === 1) return 1;
  if (memo[n]) return memo[n];
  memo[n] = n * factorial(n - 1);
  return memo[n];
}`,
  },
];

export default function CodeEditor({ value, onChange, onFileLoaded }: CodeEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large. Please select a source code file under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      onChange(content);
      onFileLoaded?.(file.name, content);
    };
    reader.readAsText(file);
  };

  const lineCount = value ? value.split("\n").length : 0;
  const charCount = value.length;

  return (
    <div className="glass-card p-4 flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">Code Editor</span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            ({lineCount} {lineCount === 1 ? "line" : "lines"} · {charCount} chars)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="btn-secondary !px-2.5 !py-1 text-xs inline-flex items-center gap-1 text-guardian-accent">
              <Sparkles size={13} /> Load Sample
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#121729] border border-guardian-border rounded-xl shadow-2xl p-1.5 z-20 w-48">
              {SAMPLE_SNIPPETS.map((sample) => (
                <button
                  key={sample.name}
                  onClick={() => onChange(sample.code)}
                  className="text-left text-xs px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-guardian-panel hover:text-white transition-colors"
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary !px-2.5 !py-1 text-xs inline-flex items-center gap-1"
          >
            <UploadCloud size={13} /> Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.go,.rs,.json,.html,.css,.sql,.md"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {value && (
            <button
              onClick={() => onChange("")}
              className="btn-secondary !px-2 !py-1 text-xs text-red-400 hover:text-red-300 hover:border-red-500/40"
              title="Clear editor"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your source code here or choose a sample above..."
        spellCheck={false}
        className="flex-1 min-h-[360px] w-full resize-none rounded-xl bg-guardian-bg/80 border border-guardian-border
        p-4 font-mono text-sm leading-relaxed text-slate-100 placeholder:text-slate-600
        focus:outline-none focus:ring-2 focus:ring-guardian-blue/50"
      />
    </div>
  );
}
