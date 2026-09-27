import { useState, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";

interface LoaderProps {
  label?: string;
  isStepLoader?: boolean;
}

const STEPS = [
  "Analyzing code structure & dependencies...",
  "Running IBM watsonx.ai Granite inference...",
  "Scanning for security vulnerabilities & bugs...",
  "Generating quality scores & actionable insights...",
];

export default function Loader({ label, isStepLoader = false }: LoaderProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isStepLoader) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isStepLoader]);

  const displayMessage = label || (isStepLoader ? STEPS[currentStep] : "Analyzing your code...");

  return (
    <div className="glass-card p-10 flex flex-col items-center justify-center gap-4 text-center my-6">
      <div className="relative">
        <Loader2 className="animate-spin text-guardian-accent" size={40} />
        <Sparkles className="absolute -top-1 -right-1 text-guardian-purple animate-pulse" size={16} />
      </div>
      <div>
        <p className="text-base font-medium text-slate-200">{displayMessage}</p>
        {isStepLoader && (
          <p className="text-xs text-slate-400 mt-1">Please wait while the AI model processes your request...</p>
        )}
      </div>
    </div>
  );
}
