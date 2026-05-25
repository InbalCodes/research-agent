import type { PipelineStep, Stage } from "../App";

const STEP_ICONS: Record<string, string> = {
  supervisor:   "🧠",
  researcher:   "🔍",
  writer:       "✍️",
  human_review: "👀",
};

export default function Pipeline({ steps, stage }: { steps: PipelineStep[]; stage: Stage }) {
  return (
    <div className="pipeline">
      <div className="pipeline-steps">
        {steps.map((s, i) => (
          <div key={i} className={`step step-${s.step}`}>
            <span className="step-icon">{STEP_ICONS[s.step] ?? "•"}</span>
            <span className="step-message">{s.message}</span>
          </div>
        ))}
        {(stage === "running" || stage === "resuming") && (
          <div className="step step-loading">
            <span className="spinner" />
            <span className="step-message">Working...</span>
          </div>
        )}
      </div>
    </div>
  );
}