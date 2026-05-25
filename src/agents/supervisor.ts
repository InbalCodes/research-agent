import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ResearchStateType } from "../state.js";
import { z } from "zod";

// ── Routing schema — forces the LLM to output a structured decision ─
const routingSchema = z.object({
  next: z
    .enum(["researcher", "writer", "human_review", "END"])
    .describe("The next agent to call"),
  task: z.string().describe("The specific task to hand off to the next agent"),
  reasoning: z.string().describe("Why you made this routing decision"),
});

const supervisorLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
}).withStructuredOutput(routingSchema);

const SUPERVISOR_PROMPT = new SystemMessage(`
  You are a supervisor managing a research and writing pipeline.
  You have these agents available:
  - researcher:    searches the web and gathers information on a topic
  - writer:        takes research findings and writes a polished draft
  - human_review:  sends the draft to a human for approval before publishing
  - END:           the task is fully complete (after human approved the draft)

  Routing rules:
  1. If there is no research yet → route to "researcher"
  2. If research exists but no draft → route to "writer"
  3. If a draft exists and humanDecision is "pending" → route to "human_review"
  4. If humanDecision is "approved" → route to "END"
  5. If humanDecision is "rejected" → route to "writer"
  6. If humanDecision is "rewritten" → route to "human_review"
`);

// ── Node function ─────────────────────────────────────────────────
export async function supervisorNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  console.log("Supervisor deciding next step...");

  const result = await supervisorLLM.invoke([
    SUPERVISOR_PROMPT,
    new HumanMessage(`
      Current state:
      - Task: ${state.task || "none"}
      - Research: ${state.research ? "✅ complete" : "❌ missing"}
      - Draft: ${state.draft ? "✅ complete" : "❌ missing"}
      - Human decision: ${state.humanDecision}
      
      ${state.humanDecision === "rejected" ? `Rejection feedback: ${state.task}` : ""}
      
      What should happen next?
    `),
  ]);

  console.log(`→ Routing to: ${result.next} (${result.reasoning})`);

  return {
    next: result.next,
    task: result.task,
  };
}