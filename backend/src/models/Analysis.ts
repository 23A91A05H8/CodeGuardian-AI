import { Schema, model, Document, Types } from "mongoose";

export type AnalysisType = "explain" | "bugs" | "security" | "refactor" | "tests" | "docs";

export interface IAnalysis extends Document {
  user: Types.ObjectId;
  filename?: string;
  language: string;
  analysisType: AnalysisType;
  code: string;
  result: Record<string, unknown>;
  qualityScore?: number;
  createdAt: Date;
}

const analysisSchema = new Schema<IAnalysis>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String },
    language: { type: String, default: "unknown" },
    analysisType: {
      type: String,
      enum: ["explain", "bugs", "security", "refactor", "tests", "docs"],
      required: true,
    },
    code: { type: String, required: true },
    result: { type: Schema.Types.Mixed, required: true },
    qualityScore: { type: Number },
  },
  { timestamps: true }
);

export const Analysis = model<IAnalysis>("Analysis", analysisSchema);
