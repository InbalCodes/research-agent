import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ResearchStateType } from "../state.js";

// ── LLM — no tools needed, pure generation ───────────────────────
const writerLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7, // a bit of creativity for better writing
  apiKey: process.env.OPENAI_API_KEY,
});

const WRITER_SYSTEM_PROMPT = new SystemMessage(`
  You are an expert content writer. Given a task and research findings:
  1. Write a clear, engaging, well-structured response
  2. Use the research findings as your source of truth — don't invent facts
  3. Organize with headers and sections where appropriate
  4. Keep a professional but approachable tone
  5. End with a brief summary of key takeaways
  
  Do not mention that you are an AI or that this is AI-generated content.
`);

// ── Node function ─────────────────────────────────────────────────
export async function writerNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  console.log("Writer agent starting...");

  const result = await writerLLM.invoke([
    WRITER_SYSTEM_PROMPT,
    new HumanMessage(`
      Task: ${state.task}
      
      Research findings:
      ${state.research}
      
      Please write a comprehensive response based on these findings.
    `),
  ]);

  const draft = result.content as string;

  console.log("✅ Draft complete");
  console.log("\n--- DRAFT PREVIEW ---");
  console.log(draft.slice(0, 200) + "...");
  console.log("---------------------\n");

  return {
    draft,
    humanDecision: "rewritten", // ← tells Supervisor to send back for review
  };
}