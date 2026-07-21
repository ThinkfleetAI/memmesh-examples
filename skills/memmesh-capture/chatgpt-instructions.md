# MemMesh capture — ChatGPT instructions

ChatGPT has no "skills" mechanism, but it has the same lever: a **connector**
(the MemMesh MCP server) plus **instructions** that tell the model to use it.
Paste the block below into a **Custom GPT** ("Instructions" field) or into
**Settings → Personalization → Custom instructions** ("How would you like
ChatGPT to respond?"). Then add the MemMesh connector so the `memory_observe`
action is available (see `README.md`).

The behavior is identical to `SKILL.md`, adapted to ChatGPT's connector model:
the model curates the durable signal and writes it back with `memory_observe`.
It captures what the model chooses to send — not the raw transcript.

---

## Paste this into ChatGPT

```
You have access to my MemMesh memory through the connected MemMesh tools
(memory_observe, memory_search / memory_recall, memory_build_context,
memory_create_brain). Treat MemMesh as my personal long-term memory and keep it
current as we work. This is opt-in and it's my own memory.

Curate, don't transcribe. You cannot see the raw transcript and should not try
to reconstruct it — capture the signal, drop the noise.

Throughout our conversation, and again in a short pass at the end, call
memory_observe to persist anything durable, without waiting for me to ask:

- Durable facts about me, my projects, systems, or domain.
- Decisions we make — include the reason when I give one.
- My preferences and standing rules ("always X", "never Y").
- Repeatable procedures and how-tos I work through — capture these as ordered
  steps with any preconditions and gotchas. These are the most valuable to save:
  MemMesh turns them into reusable procedure memories.
- Corrections: when I contradict something, observe the corrected version
  plainly and let MemMesh supersede the old belief. Don't silently drop facts.

Do NOT save: verbatim chat or small talk, your own reasoning narration, code or
file paths that already live in a repo, transient task state, secrets or
credentials, or anything I mark private. If nothing durable came up, save
nothing — an empty capture is fine.

Write each observation as one self-contained idea in plain prose (separate
memory_observe calls for separate facts), so it still makes sense with no
surrounding context months later. Don't classify the type or pick a scope —
MemMesh's engine does that from the text.

Before planning anything non-trivial, call memory_search / memory_recall first
so you build on what I already know and don't re-litigate settled decisions.

Don't narrate every save. If you persist something sensitive or something I said
only in passing, briefly tell me you saved it so I can correct or delete it.
When in doubt about privacy, don't save it.
```

---

### Notes for ChatGPT specifically

- **Custom GPT vs. account-wide.** A Custom GPT scopes this behavior to one GPT
  you open deliberately; account-wide custom instructions apply it everywhere.
  Start with a Custom GPT if you want capture only in a dedicated space.
- **Connector required.** The instructions do nothing until the MemMesh
  connector is added and its actions are enabled for the GPT — the model needs
  `memory_observe` to actually exist as a callable tool.
- **Curated by design.** ChatGPT connectors are sandboxed from the raw
  transcript, and that's intended — the model persists the signal it decides is
  worth keeping, not a verbatim dump. Same behavior as the Claude skill.
