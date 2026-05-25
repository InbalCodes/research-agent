import { useState } from "react";

export default function TaskInput({ onStart }: { onStart: (task: string) => void }) {
  const [task, setTask] = useState("");

  return (
    <div className="task-input">
      <textarea
        placeholder="What would you like me to research and write about?"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={4}
      />
      <button
        className="btn-primary"
        disabled={!task.trim()}
        onClick={() => onStart(task.trim())}
      >
        Start Research →
      </button>
    </div>
  );
}