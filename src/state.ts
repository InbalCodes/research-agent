import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { messagesStateReducer } from "@langchain/langgraph";

export const ResearchState = Annotation.Root({
  // Full conversation history — appends automatically, never overwrites
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // The task the supervisor delegated (e.g. "research X", "write about Y")
  task: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Raw findings from the Research agent
  research: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Draft produced by the Writer agent
  draft: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

    // "pending" | "approved" | "rejected" | "rewritten"
    humanDecision: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "pending",
    }),

  // Which agent should act next (set by the Supervisor)
  next: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
});

// Handy type alias — use this everywhere instead of writing the full type
export type ResearchStateType = typeof ResearchState.State;