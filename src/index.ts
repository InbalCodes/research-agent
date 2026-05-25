import "dotenv/config";
import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver, interrupt, Command } from "@langchain/langgraph";
import { ResearchState, ResearchStateType } from "./state.js";
import { supervisorNode } from "./agents/supervisor.js";
import { researcherNode } from "./agents/researcher.js";
import { writerNode } from "./agents/writer.js";
import * as readline from "readline";

// ── Human review node ─────────────────────────────────────────────
// This is where the graph PAUSES and waits for real human input
async function humanReviewNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  console.log("\n📋 DRAFT FOR REVIEW:");
  console.log("─".repeat(50));
  console.log(state.draft);
  console.log("─".repeat(50));

  // interrupt() pauses the graph here and saves state to the checkpointer
  // The graph won't continue until you call graph.invoke() again with a decision
  const decision = interrupt({
    draft: state.draft,
    message: "Please review the draft above. Type 'approve' or 'reject: <feedback>'",
  });

  const approved = (decision as string).toLowerCase().startsWith("approve");
  const humanDecision = approved ? "approved" : "rejected";

  // Only add to messages if approved — rejected drafts don't belong in history
  const newMessages = approved
    ? [new AIMessage(state.draft)]
    : [];

  console.log(`\n${approved ? "✅ Draft approved!" : "❌ Draft rejected, routing back to writer..."}`);

  return {
    humanDecision,
    messages: newMessages,
    // Pass rejection feedback back as the task for the writer to fix
    task: approved
      ? state.task
      : `Rewrite the draft based on this feedback: ${decision}. Original task: ${state.task}`,
  };
}

// ── Conditional router ────────────────────────────────────────────
// Reads the `next` field the Supervisor wrote and returns the node name
function routeNext(state: ResearchStateType): string {
  if (state.next === "END") return END;
  return state.next; // "researcher" | "writer" | "human_review"
}

// ── Build the graph ───────────────────────────────────────────────
const builder = new StateGraph(ResearchState)
  .addNode("supervisor",    supervisorNode)
  .addNode("researcher",    researcherNode)
  .addNode("writer",        writerNode)
  .addNode("human_review",  humanReviewNode)

  // Every flow starts at the supervisor
  .addEdge(START, "supervisor")

  // Supervisor's decision drives all routing
  .addConditionalEdges("supervisor", routeNext, {
    researcher:   "researcher",
    writer:       "writer",
    human_review: "human_review",
    [END]:        END,
  })

  // After each worker finishes, always return to supervisor
  .addEdge("researcher",   "supervisor")
  .addEdge("writer",       "supervisor")
  .addEdge("human_review", "supervisor");

// ── Compile with memory ───────────────────────────────────────────
// MemorySaver checkpoints state so interrupt() can pause and resume
const memory = new MemorySaver();
export const graph = builder.compile({ checkpointer: memory });

// ── Runner ────────────────────────────────────────────────────────
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

  const threadId = `thread-${Date.now()}`;
  const config = { configurable: { thread_id: threadId } };

  const userTask = await ask("📝 What would you like me to research and write about?\n> ");

  console.log("\n🚀 Starting research pipeline...\n");

  // ── First run: flows until it hits interrupt() in human_review ──
  await graph.invoke(
    {
      messages: [new HumanMessage(userTask)],
      task: userTask,
    },
    config
  );

  // ── Loop until the human approves ────────────────────────────────
  while (true) {
    const decision = await ask("\n✏️  Your decision (approve / reject: <feedback>)\n> ");

    console.log("\n▶️  Resuming graph with your decision...\n");

    // Resume the graph — pass ONLY the interrupt response, not a new task
    const result = await graph.invoke(
      new Command({ resume: decision }),
      config
    );

    if (result.humanDecision === "approved") {
      console.log("\n✅ FINAL APPROVED DRAFT:");
      console.log("─".repeat(50));
      console.log(result.draft);
      console.log("─".repeat(50));
      break;
    }

    // If rejected the graph will run writer → supervisor → human_review
    // and pause again at interrupt() — loop continues
  }

  rl.close();
}

main().catch(console.error);