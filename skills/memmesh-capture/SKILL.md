---
name: memmesh-capture
description: >-
  Persist the durable signal from this conversation into the user's MemMesh
  memory as you work. Use throughout and at the end of any working session —
  especially when the user states a lasting fact, makes a decision, reveals a
  preference, or walks through a repeatable procedure or how-to. Requires the
  MemMesh MCP connector (memory_observe). Opt-in; this is the user's own memory.
---

# MemMesh capture

You have access to the user's **MemMesh** memory through the MCP connector. Your
job with this skill is simple: as the conversation produces knowledge worth
keeping, hand it to MemMesh via `memory_observe`. MemMesh does the rest — it
extracts, deduplicates, revises stale beliefs, and consolidates what you send
into specialized brains the user (and their agents) can recall later.

You are **curating**, not transcribing. A connector cannot see the raw
transcript, and you should not try to reconstruct it. Send the *signal* — the
handful of things that will still matter next week — and drop the noise.

## When to call `memory_observe`

Call it as soon as one of these appears, and again in a short pass at the **end**
of the session. Don't wait for the user to ask.

Save:

- **Durable facts** about the user, their projects, systems, or domain.
  "The prod cluster is `growth-os-prod` on EKS us-east-1." "Their billing entity
  is `memmesh`, separate from EngageIt."
- **Decisions made**, with the *why* when it's stated. "We decided to defer real
  CRDT sync and use provenance-precedence merge instead, because LWW loses
  SoR edits."
- **Preferences and standing rules.** "Always use pnpm, never npm." "Prefer
  Vitest over Jest for new packages."
- **Repeatable procedures / how-tos** — this is the highest-value capture.
  When the user works through a multi-step process (a deploy runbook, a debug
  sequence, a release checklist, a data-migration recipe), write it back as an
  ordered procedure. MemMesh induces reusable *procedure memories* from these,
  so next time the steps can be recalled instead of rediscovered.
- **Corrections.** If the user contradicts something, observe the corrected
  version plainly; MemMesh's belief revision supersedes the old one server-side.
  Don't silently drop the old fact on your own.

Skip:

- Verbatim chat, pleasantries, and your own reasoning narration.
- Code, file paths, and architecture that already live in the repo — those are
  authoritative in the code, not in memory.
- Transient task state ("now I'm editing line 40") — that belongs in a todo
  list, not long-term memory.
- Secrets, tokens, credentials, and anything the user marked private.
- Anything already obvious from a project's own docs/config.

If nothing durable came up, save nothing. An empty capture is correct far more
often than a noisy one.

## How to write a good observation

- **One idea per observation.** Don't batch five unrelated facts into one blob;
  send them as separate `memory_observe` calls so each can be recalled on its
  own.
- **Write the fact, not the conversation.** "User asked whether…" is noise.
  "The staging DB resets nightly at 03:00 UTC" is signal.
- **Be self-contained.** It should still make sense with zero surrounding
  context in six months. Resolve pronouns; name the subject.
- **Preserve the *why*** for decisions and preferences — the reasoning is what
  makes a memory reusable.
- **For procedures, keep the step order and any preconditions/gotchas.**

You don't need to classify the memory type or pick a scope — MemMesh's engine
decides fact vs. preference vs. decision vs. procedure from the text. Just send
clean, self-contained prose.

## Tool reference (MemMesh MCP)

- `memory_observe` — the workhorse. Send raw, self-contained text; the engine
  extracts and files it. Use this for everything above.
- `memory_search` / `memory_recall` — pull relevant prior memory *before* you
  plan, so you build on what's already known. Search early when context would
  help; it's cheap and it prevents re-litigating settled decisions.
- `memory_build_context` — assemble a focused context pack for a topic when you
  need more than a flat list of hits.
- `memory_create_brain` — create a named brain to group a domain's memories,
  when the user explicitly wants a dedicated brain for a project or topic.

Capture (write) endpoint — where `memory_observe` lives — is the project-scoped
MCP server over Streamable HTTP:
`https://app.memmesh.ai/api/v1/projects/<PROJECT_ID>/mcp-server/http`. Auth is
the project's MCP token as a Bearer header, configured once when the connector is
added — you don't handle auth in the skill.

## Etiquette

This is the user's personal memory and capture is **opt-in**. You don't need to
narrate every save, but if you're persisting something the user might consider
sensitive, or something they said only in passing, briefly note that you saved
it so they can correct or delete it. When in doubt about whether something is
private, don't save it.
