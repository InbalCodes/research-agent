import { useState } from "react";
import TaskInput from "./components/TaskInput";
import Pipeline from "./components/Pipeline";
import ReviewPanel from "./components/ReviewPanel";
import "./App.css";

export type Stage =
  | "idle"
  | "running"
  | "review"
  | "resuming"
  | "done"
  | "error";

export interface PipelineStep {
  step: string;
  message: string;
  ts: number;
}

export default function App() {
  const [stage,    setStage]    = useState<Stage>("idle");
  const [steps,    setSteps]    = useState<PipelineStep[]>([]);
  const [draft,    setDraft]    = useState("");
  const [threadId, setThreadId] = useState("");
  const [error,    setError]    = useState("");

  function addStep(step: string, message: string) {
    setSteps((prev) => [...prev, { step, message, ts: Date.now() }]);
  }

  async function handleStart(task: string) {
    const tid = `thread-${Date.now()}`;
    setThreadId(tid);
    setStage("running");
    setSteps([]);
    setDraft("");
    setError("");

    const url = `http://localhost:3001/api/run/${tid}?task=${encodeURIComponent(task)}`;
    const es  = new EventSource(url);

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      addStep(data.step, data.message);
    });

    es.addEventListener("review", (e) => {
      const data = JSON.parse(e.data);
      setDraft(data.draft);
      setStage("review");
      es.close();
    });

    es.addEventListener("error", (e) => {
      setError((e as MessageEvent).data ?? "Unknown error");
      setStage("error");
      es.close();
    });
  }

    async function handleDecision(decision: string) {
    setStage("resuming");
    addStep(
        "human_review",
        decision.startsWith("approve")
        ? "✅ You approved the draft"
        : "❌ You requested a rewrite"
    );

    const res = await fetch("http://localhost:3001/api/decision", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ threadId, decision }),
    });

    const reader  = res.body!.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n"); // SSE messages are separated by double newline
        buffer = parts.pop() ?? "";        // keep any incomplete message in the buffer

        for (const part of parts) {
        // Extract event name and data from the SSE block
        const eventMatch = part.match(/^event: (\w+)/m);
        const dataMatch  = part.match(/^data: (.+)/m);
        if (!dataMatch) continue;

        const eventName = eventMatch?.[1] ?? "message";
        const data      = JSON.parse(dataMatch[1]);

        if (eventName === "status") {
            addStep(data.step, data.message);
        }

        if (eventName === "review") {
            // New draft ready — show review panel again
            setDraft(data.draft);
            setStage("review");
        }

        if (eventName === "done") {
            // Approved — show final draft
            setDraft(data.draft);
            setStage("done");
        }

        if (eventName === "error") {
            setError(data.message);
            setStage("error");
        }
        }
    }
    }

  return (
    <div className="app">
      <header>
        <div className="logo">⬡</div>
        <h1>Research Agent</h1>
        <p className="subtitle">Multi-agent research &amp; writing pipeline</p>
      </header>

      {stage === "idle" && (
        <TaskInput onStart={handleStart} />
      )}

      {stage !== "idle" && (
        <Pipeline steps={steps} stage={stage} />
      )}

      {(stage === "review" || stage === "done") && (
        <ReviewPanel
          draft={draft}
          approved={stage === "done"}
          onDecision={handleDecision}
        />
      )}

      {stage === "error" && (
        <div className="error-box">⚠️ {error}</div>
      )}
    </div>
  );
}