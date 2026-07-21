# memmesh-capture

A published **Agent Skill** (+ a ChatGPT instruction variant) that pairs with
the **MemMesh MCP connector** so your everyday LLM conversations feed your
MemMesh memory — which then auto-builds and maintains specialized brains you can
recall later.

The skill doesn't call any API itself. It instructs the model to call the
`memory_observe` MCP tool as it works, persisting the durable signal from a
conversation: facts, decisions, preferences, and especially the **repeatable
procedures** you work through. MemMesh extracts, deduplicates, revises stale
beliefs, and consolidates that stream into brains.

Files:

- [`SKILL.md`](SKILL.md) — the Anthropic Agent Skill (Claude, Claude Code, Codex,
  any Skills/MCP-aware host).
- [`chatgpt-instructions.md`](chatgpt-instructions.md) — the same behavior as
  ChatGPT Custom-GPT / custom instructions.

## Curated by design, not verbatim

This skill captures **the signal the model decides is worth keeping — not your
raw transcript.** That's the intended design, not a shortcoming:

- The model extracts durable facts, decisions, preferences, and procedures and
  writes them back with `memory_observe`. Clean, self-contained, low-noise.
- MemMesh's engine then dedupes, revises stale beliefs, and consolidates that
  stream into brains. Curated signal is exactly what makes later recall sharp;
  a verbatim dump would bury it.
- It works entirely through officially supported extension points — MCP
  connectors and the Skills / instruction mechanisms each client already
  provides. Nothing fights the platform sandbox.

So: this is a memory *curator*, not a transcript recorder, and every client
below gets the same behavior through its own supported MCP + skill/instruction
path.

## The loop this closes

```
   your conversation
          │
          ▼   memory_observe  (model curates the durable signal)
   MemMesh memory engine  ──►  extract · dedupe · revise · consolidate
          │
          ▼
   auto-learned specialized brains        (memory-thinkfleet #181)
          │
          ▼
   federation / mesh router               (memory-thinkfleet #178)
          │
          ▼   memory_search / memory_recall / memory_build_context
   consumed back inside your next LLM session
```

Capture feeds memory, memory grows brains, the router picks the right brain, and
the model reads it back on your next question. The skill is the first hop; the
connector is the pipe in both directions.

## Install

Every client uses the same two pieces: **(1)** add the MemMesh MCP server so
`memory_observe` (and its recall siblings) exist as callable tools, and **(2)**
give the agent the capture instruction — the Skill itself where supported, or the
pasted instruction block where not.

The capture (write) server — where `memory_observe` lives — is **project-scoped**
and speaks **Streamable HTTP**:

```
https://app.memmesh.ai/api/v1/projects/<PROJECT_ID>/mcp-server/http
```

Authorize with that **project's MCP token** as a `Bearer` header. Get the token
from the MemMesh console, or `GET /api/v1/projects/<PROJECT_ID>/mcp-server` and
read `.token`. The server exposes `memory_observe`, `memory_search` /
`memory_recall`, `memory_build_context`, and `memory_create_brain`.

> Consuming brains back (recall side) is a different endpoint, authorized with a
> **MeshKey** (or Cognito OAuth once it ships): a single brain is
> `…/api/v1/brains/<BRAIN_ID>/mcp-server/http`, and the federation router — every
> brain you're entitled to behind one endpoint — is
> `…/api/v1/brains/mcp-server/http`. This skill only needs the write endpoint
> above.

### Claude Code — flagship

MemMesh already runs as an MCP server in Claude Code today.

1. **Add the MCP server.** Either register it globally:

   ```bash
   claude mcp add --transport http memmesh \
     "https://app.memmesh.ai/api/v1/projects/$MEMMESH_PROJECT_ID/mcp-server/http" \
     --header "Authorization: Bearer $MEMMESH_PROJECT_MCP_TOKEN"
   ```

   or commit a project-scoped `.mcp.json` so your team shares it:

   ```json
   {
     "mcpServers": {
       "memmesh": {
         "type": "http",
         "url": "https://app.memmesh.ai/api/v1/projects/${MEMMESH_PROJECT_ID}/mcp-server/http",
         "headers": { "Authorization": "Bearer ${MEMMESH_PROJECT_MCP_TOKEN}" }
       }
     }
   }
   ```

2. **Load the capture instruction.** Drop [`SKILL.md`](SKILL.md) at
   `~/.claude/skills/memmesh-capture/SKILL.md` (or a project
   `.claude/skills/memmesh-capture/SKILL.md`). Claude Code discovers it and loads
   it when a session looks like work worth remembering. Prefer it always-on for a
   repo? Add a one-line pointer in that repo's `CLAUDE.md`: *"Persist durable
   facts, decisions, and procedures to MemMesh via `memory_observe` as you
   work — see the memmesh-capture skill."*
3. **Work normally.** The agent persists the durable signal as it goes, does a
   short capture pass at the end, and reads it back with `memory_search`.

### Codex — CLI / agentic coding

Codex supports MCP servers and auto-loads an `AGENTS.md` from the repo root.

1. **Add the MCP server** to your Codex MCP config (`~/.codex/config.toml`):

   ```toml
   [mcp_servers.memmesh]
   command = "npx"
   args = [
     "-y", "mcp-remote",
     "https://app.memmesh.ai/api/v1/projects/PROJECT_ID/mcp-server/http",
     "--transport", "http-only",
     "--header", "Authorization: Bearer PROJECT_MCP_TOKEN",
   ]
   ```

   (Use whichever Streamable-HTTP / remote-MCP bridge your Codex build ships; the
   point is a `memmesh` server pointing at
   `https://app.memmesh.ai/api/v1/projects/<PROJECT_ID>/mcp-server/http` with the
   project MCP token as the Bearer.)
2. **Load the capture instruction.** Add an `AGENTS.md` snippet at the repo root
   (or fold it into an existing one):

   ```markdown
   ## Memory
   Persist durable signal to MemMesh as you work: call `memory_observe` for
   lasting facts, decisions (with the why), preferences, and especially
   repeatable procedures/how-tos. Curate the signal, skip verbatim chat, code
   already in the repo, transient state, and secrets. Call `memory_search`
   before planning non-trivial work. Full behavior: skills/memmesh-capture.
   ```
3. **Work normally.** Same loop as Claude Code.

Any other MCP-aware CLI/agentic tool follows this shape: register the MemMesh
server, then point the tool's auto-loaded instructions (`AGENTS.md`, a system
prompt, or the Skill) at the capture behavior.

### Claude — web / desktop

1. **Add the MemMesh connector.** Settings → Connectors → add the MemMesh MCP
   server at
   `https://app.memmesh.ai/api/v1/projects/<PROJECT_ID>/mcp-server/http`,
   authorized with the project's MCP token.
2. **Enable the skill.** Add [`SKILL.md`](SKILL.md) as a skill so Claude loads it
   in your working conversations.
3. **Work normally.** Curated signal in, brains out.

### ChatGPT — web

1. **Add the MemMesh connector** so the `memory_observe` action exists for your
   GPT — server
   `https://app.memmesh.ai/api/v1/projects/<PROJECT_ID>/mcp-server/http`,
   authorized with the project's MCP token.
2. **Paste the instructions.** Copy the block from
   [`chatgpt-instructions.md`](chatgpt-instructions.md) into a **Custom GPT**
   ("Instructions") or your **account-wide custom instructions** — ChatGPT has no
   Skills mechanism, so instructions carry the same behavior.
3. **Work normally.** Same behavior, adapted to ChatGPT's connector model.

## Connector setup

Full connector + MeshKey / OAuth setup: **[docs.memmesh.ai](https://docs.memmesh.ai)**.
Pairs with MemMesh MCP connector work (`memory-thinkfleet` #180) and auto-brains
(#181).

---

Apache-2.0 · [memmesh.ai](https://memmesh.ai) · [docs](https://docs.memmesh.ai)
