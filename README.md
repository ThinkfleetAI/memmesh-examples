# MemMesh examples

Runnable example apps for **[MemMesh](https://memmesh.ai)** — memory + prediction
for AI agents. Every example is real code against a real SDK; set your keys and
run it.

```bash
export MEMMESH_API_KEY=sk-...       # Platform Admin → API Keys
export MEMMESH_PROJECT_ID=proj_...
```

## TypeScript

| Example | What it shows |
| --- | --- |
| [`typescript/predict-anything`](typescript/predict-anything) | Declare *any* target — churn, next order total, next visit, anomaly — and get a calibrated prediction that **abstains** when the signal is thin. |
| [`typescript/next-best-offer`](typescript/next-best-offer) | The full closed loop: observe → mine → predict → **Claude picks the offer + send-time** → record the outcome → patterns re-calibrate. |
| [`typescript/financial-copilot`](typescript/financial-copilot) | Ingest real price history + headlines, build a portfolio-risk profile, get calibrated buy/sell/hold calls with a self-improving reconcile loop. |

```bash
cd typescript/predict-anything && npm install && npm start
```

## Python

| Example | What it shows |
| --- | --- |
| [`python/support-agent`](python/support-agent) | A support bot that remembers every customer across sessions, recalls history on each ticket, surfaces related memories, and self-corrects when facts change. |

```bash
cd python/support-agent && pip install -r requirements.txt && python main.py
```

## Go · Rust · .NET

Minimal observe → search → reflect quickstarts:
[`go/quickstart`](go/quickstart) · [`rust/quickstart`](rust/quickstart) · [`dotnet/quickstart`](dotnet/quickstart)

## Skills

Packaged Agent Skills that pair with the MemMesh MCP connector — no SDK, just
prompt + connector.

| Skill | What it does |
| --- | --- |
| [`skills/memmesh-capture`](skills/memmesh-capture) | Persist the durable signal from your LLM conversations into MemMesh as you work — facts, decisions, preferences, and repeatable procedures — via `memory_observe`. Curated by design (not a transcript). Install docs for Claude Code, Codex, Claude web, and ChatGPT. |

## SDKs

- TypeScript — [`@thinkfleet/memory-sdk`](https://github.com/ThinkfleetAI/thinkfleet-memory-sdk) (`npm i @thinkfleet/memory-sdk`)
- Python — [`thinkfleet-memmesh`](https://github.com/ThinkfleetAI/memmesh-python) (`pip install thinkfleet-memmesh`)
- Go — [`memmesh-go`](https://github.com/ThinkfleetAI/memmesh-go) (`go get github.com/ThinkfleetAI/memmesh-go`)
- .NET — [`memmesh-dotnet`](https://github.com/ThinkfleetAI/memmesh-dotnet) (`dotnet add package MemMesh`)
- Rust — [`memmesh-rust`](https://github.com/ThinkfleetAI/memmesh-rust) (`cargo add memmesh`)

Apache-2.0 · [memmesh.ai](https://memmesh.ai) · [docs](https://docs.memmesh.ai)
