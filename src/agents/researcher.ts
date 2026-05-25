import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { researcherTools } from "../tools.js";
import { ResearchStateType } from "../state.js";

// ── LLM with tools bound ──────────────────────────────────────────
const researcherLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

// ── The researcher is itself a mini ReAct agent ───────────────────
// createReactAgent builds the think → act → observe loop for us
const researcherAgent = createReactAgent({
  llm: researcherLLM,
  tools: researcherTools,
  messageModifier: new SystemMessage(`
    You are a thorough research specialist. Given a task:
    1. Search for relevant, up-to-date information using the search tool
    2. Use the calculator tool for any numerical reasoning
    3. Gather enough information to give a comprehensive answer
    4. Return a well-structured summary of your findings
    
    Be thorough but concise. Cite sources where possible.
  `),
});

// ── Node function: plugs into the parent graph ────────────────────
export async function researcherNode(
  state: ResearchStateType
): Promise<Partial<ResearchStateType>> {
  console.log("Researcher agent starting...");

  const result = await researcherAgent.invoke({
    messages: [{ role: "user", content: state.task }],
  });

  // Extract the final text response from the agent's message history
  const lastMessage = result.messages[result.messages.length - 1];
  const research = lastMessage.content as string;

  console.log("✅ Research complete");

  return {
    research,
    messages: result.messages,
  };
}