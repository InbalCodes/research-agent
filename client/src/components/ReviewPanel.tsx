import { useState } from "react";

interface Props {
  draft:      string;
  approved:   boolean;
  onDecision: (decision: string) => void;
}

export default function ReviewPanel({ draft, approved, onDecision }: Props) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="review-panel">
      <div className="review-header">
        <h2>{approved ? "✅ Final Draft" : "👀 Review Draft"}</h2>
        {!approved && <p>Approve to publish or reject with feedback.</p>}
      </div>

      <div className="draft-content">
        {draft.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {!approved && (
        <div className="review-actions">
          <button
            className="btn-approve"
            onClick={() => onDecision("approve")}
          >
            ✅ Approve
          </button>

          <div className="reject-row">
            <input
              type="text"
              placeholder="Feedback for rewrite..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <button
              className="btn-reject"
              disabled={!feedback.trim()}
              onClick={() => {
                onDecision(`reject: ${feedback.trim()}`);
                setFeedback("");
              }}
            >
              ❌ Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}