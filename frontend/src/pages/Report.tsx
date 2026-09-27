import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";
import Loader from "../components/Loader";
import ReportCard from "../components/ReportCard";
import ScoreChart from "../components/ScoreChart";
import { AnalysisRecord } from "../types";
import { ArrowLeft } from "lucide-react";

export default function Report() {
  const { id } = useParams();
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/report/${id}`).then(({ data }) => setRecord(data.analysis)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loader label="Loading report..." />;
  if (!record) return <p className="text-center text-slate-400 py-16">Report not found.</p>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link to="/history" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 mb-6">
        <ArrowLeft size={16} /> Back to history
      </Link>
      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {record.result.quality_score && (
          <div className="glass-card p-5 h-fit text-center">
            <p className="text-sm text-slate-400 mb-2">Code Quality Score</p>
            <ScoreChart score={record.result.quality_score.score} />
          </div>
        )}
        <ReportCard result={record.result} />
      </div>
    </div>
  );
}
