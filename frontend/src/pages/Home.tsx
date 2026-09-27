import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Bug, Lock, Wand2, TestTube2, FileText } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const features = [
  { icon: Bug, label: "Bug Detection" },
  { icon: Lock, label: "Security Scan" },
  { icon: Wand2, label: "Refactoring" },
  { icon: FileText, label: "Documentation" },
  { icon: TestTube2, label: "Test Generation" },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-6 py-24 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-sm text-slate-300 mb-8">
          <ShieldCheck size={16} className="text-guardian-accent" /> Powered by IBM watsonx.ai · Granite Model
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-guardian-blue via-guardian-purple to-guardian-accent bg-clip-text text-transparent">
          CodeGuardian AI
        </h1>
        <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
          Your intelligent AI partner for understanding, reviewing, and improving codebases.
        </p>

        <Link to={user ? "/analyzer" : "/login"} className="btn-primary text-base !px-8 !py-3 mb-14">
          Analyze Code →
        </Link>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="glass-card p-5 flex flex-col items-center gap-2">
              <Icon className="text-guardian-accent" size={22} />
              <span className="text-sm text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
