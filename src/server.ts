import "dotenv/config";
import express from "express";
import cors from "cors";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver, interrupt, Command } from "@langchain/langgraph";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ResearchState, ResearchStateType } from "./state.js";
import { supervisorNode } from "./agents/supervisor.js";
import { researcherNode } from "./agents/researcher.js";
import { writerNode } from "./agents/writer.js";
import { AIMessage } from "@langchain/core/messages";

const app = express();
app.use(cors());
app.use(express.json());

// ── Rebuild graph (same as index.ts) ─────────────────────────────
async function humanReviewNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  const decision = interrupt({ draft: state.draft }) as string;

  const approved = decision.toLowerCase().startsWith("approve");
  const humanDecision = approved ? "approved" : "rejected";

  return {
    humanDecision,
    task: approved
      ? state.task
      : `Rewrite the draft based on this feedback: ${decision}. Original task: ${state.task}`,
    messages: approved ? [new AIMessage(state.draft)] : [],
  };
}

function routeNext(state: ResearchStateType): string {
  if (state.next === "END") return END;
  return state.next;
}

const memory = new MemorySaver();
const graph = new StateGraph(ResearchState)
  .addNode("supervisor",   supervisorNode)
  .addNode("researcher",   researcherNode)
  .addNode("writer",       writerNode)
  .addNode("human_review", humanReviewNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeNext, {
    researcher:   "researcher",
    writer:       "writer",
    human_review: "human_review",
    [END]:        END,
  })
  .addEdge("researcher",   "supervisor")
  .addEdge("writer",       "supervisor")
  .addEdge("human_review", "supervisor")
  .compile({ checkpointer: memory });

// ── SSE helper ────────────────────────────────────────────────────
// Streams pipeline status events to the frontend in real time
function createSSEStream(res: express.Response) {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  return (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

// ── POST /api/start ───────────────────────────────────────────────
// Kicks off the pipeline and streams progress back via SSE
app.get("/api/run/:threadId", async (req, res) => {
  const { threadId } = req.params;
  const { task } = req.query as { task: string };
  const send = createSSEStream(res);
  const config = { configurable: { thread_id: threadId } };

  try {
    send("status", { step: "supervisor",  message: "Supervisor is planning..." });

    // Stream each node's updates as they happen
    for await (const event of graph.streamEvents(
      { messages: [new HumanMessage(task)], task },
      { ...config, version: "v2" }
    )) {
      if (event.event === "on_chain_start" && event.name !== "LangGraph") {
        const stepMap: Record<string, string> = {
          supervisor:   "Supervisor deciding...",
          researcher:   "Researching the web...",
          writer:       "Writing draft...",
          human_review: "Ready for your review",
        };
        if (stepMap[event.name]) {
          send("status", { step: event.name, message: stepMap[event.name] });
        }
      }

      // Graph paused at interrupt — send the draft to the frontend
      if (event.event === "on_chain_stream") {
        const chunk = event.data?.chunk;
        if (chunk?.__interrupt__) {
          const draft = chunk.__interrupt__[0]?.value?.draft;
          if (draft) send("review", { draft });
        }
      }
    }
  } catch (err) {
    send("error", { message: String(err) });
  }

  res.end();
});

// ── POST /api/decision ────────────────────────────────────────────
// Resumes the graph with the human's approve/reject decision
app.post("/api/decision", async (req, res) => {
  const { threadId, decision } = req.body;
  const send = createSSEStream(res);
  const config = { configurable: { thread_id: threadId } };

  try {
    for await (const event of graph.streamEvents(
      new Command({ resume: decision }),
      { ...config, version: "v2" }
    )) {
      if (event.event === "on_chain_start") {
        const stepMap: Record<string, string> = {
          supervisor:   "Supervisor deciding...",
          writer:       "Rewriting draft...",
          human_review: "Ready for your review",
        };
        if (stepMap[event.name]) {
          send("status", { step: event.name, message: stepMap[event.name] });
        }
      }

      if (event.event === "on_chain_stream") {
        const chunk = event.data?.chunk;
        if (chunk?.__interrupt__) {
          const draft = chunk.__interrupt__[0]?.value?.draft;
          if (draft) send("review", { draft });
        }
      }

      // ← Listen for the graph's final output event instead of chunk data
      if (event.event === "on_chain_end" && event.name === "LangGraph") {
        const output = event.data?.output;
        if (output?.humanDecision === "approved" && output?.draft) {
          send("done", { draft: output.draft });
        }
      }
    }
  } catch (err) {
    send("error", { message: String(err) });
  }

  res.end();
});

app.listen(3001, () => console.log("🚀 Server running on http://localhost:3001"));