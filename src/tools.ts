import { tool } from "@langchain/core/tools";
import { tavily } from "@tavily/core";
import { z } from "zod";

// ── Web Search ────────────────────────────────────────────────────
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export const searchTool = tool(
  async ({ query }: { query: string }) => {
    const response = await tavilyClient.search(query, { maxResults: 3 });
    return response.results
      .map((r) => `**${r.title}**\n${r.content}\nSource: ${r.url}`)
      .join("\n\n");
  },
  {
    name: "search_web",
    description: "Search the web for current information on a topic.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

// ── Calculator ────────────────────────────────────────────────────
export const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/(). ]/g, "");
      const result = Function(`"use strict"; return (${sanitized})`)();
      return `${expression} = ${result}`;
    } catch {
      return `Could not evaluate expression: ${expression}`;
    }
  },
  {
    name: "calculator",
    description: "Evaluate a basic math expression like '42 * 7'.",
    schema: z.object({
      expression: z.string().describe("The math expression to evaluate"),
    }),
  }
);

export const researcherTools = [searchTool, calculatorTool];