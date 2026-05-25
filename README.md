# 🔬 Research Agent

A multi-agent AI pipeline that researches any topic on the web, writes a polished draft, and waits for your approval before finishing — all orchestrated with LangGraph and streamed live to a React UI.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-0.2.x-412991?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite&logoColor=white)

---

## How it works

Three specialized agents collaborate inside a LangGraph state machine:

```
User prompt
    ↓
Supervisor  →  Researcher (web search + calculator)
    ↓
Supervisor  →  Writer (drafts from research)
    ↓
Supervisor  →  Human review  ──▶  approve → END
                              ──▶  reject  → Writer (loop until approved)
```

- **Supervisor** — routes tasks between agents using structured LLM output
- **Researcher** — a full ReAct agent with Tavily web search and a calculator tool
- **Writer** — grounds its draft in the research findings, no hallucination
- **Human review** — pauses the graph with `interrupt()`, waits for your decision, then resumes

Progress streams live to the UI via Server-Sent Events (SSE).

---

## Stack

| Layer | Tech |
|---|---|
| Agent orchestration | LangGraph (`@langchain/langgraph`) |
| LLM | OpenAI GPT-4o-mini (`@langchain/openai`) |
| Web search | Tavily (`@tavily/core`) |
| Backend | Express + SSE |
| Frontend | React 18 + Vite + TypeScript |

---

## Project structure

```
research-agent/
├── src/
│   ├── server.ts          # Express API + SSE streaming
│   ├── index.ts           # CLI runner
│   ├── state.ts           # Shared LangGraph state
│   ├── tools.ts           # Tavily search + calculator tools
│   └── agents/
│       ├── supervisor.ts  # Routing agent (structured output)
│       ├── researcher.ts  # ReAct agent with tools
│       └── writer.ts      # Draft generation agent
└── client/                # React + Vite frontend
    └── src/
        ├── App.tsx
        └── components/
            ├── TaskInput.tsx
            ├── Pipeline.tsx
            └── ReviewPanel.tsx
```

---

## Getting started

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com)
- A [Tavily API key](https://tavily.com) (free tier available)

### 1. Clone and install

```bash
git clone https://github.com/your-username/research-agent.git
cd research-agent
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
OPENAI_API_KEY=your-openai-key-here
TAVILY_API_KEY=your-tavily-key-here
```

### 3. Install frontend dependencies

```bash
cd client
npm install
cd ..
```

### 4. Run

Open two terminals:

```bash
# Terminal 1 — backend
npm run server

# Terminal 2 — frontend
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start researching.

---

## Usage

1. Type a research topic in the input box and click **Start Research**
2. Watch the pipeline run in real time — supervisor, researcher, writer
3. Review the generated draft
4. **Approve** to finish, or **Reject** with feedback to trigger a rewrite
5. The loop continues until you're happy with the result

---

## CLI mode

Prefer the terminal? Run the pipeline without the UI:

```bash
npm run dev
```

---

## Environment variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `TAVILY_API_KEY` | Tavily search API key |

---

## Key concepts

**LangGraph interrupt** — the graph pauses mid-execution at `interrupt()`, serializes its entire state to a `MemorySaver` checkpoint, and resumes exactly where it left off when you call `graph.invoke()` again with `Command({ resume: decision })`.

**Structured routing** — the Supervisor uses `.withStructuredOutput(zodSchema)` to return a validated routing decision (`researcher | writer | human_review | END`) instead of free text, making routing deterministic.

**SSE streaming** — the backend streams pipeline events (`status`, `review`, `done`, `error`) to the React frontend using Server-Sent Events, so the UI updates in real time without polling.

---

## License

MIT
