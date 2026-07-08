"""Support-agent memory — a bot that remembers every customer across sessions.

Ingests a few support interactions, then for a new ticket: recalls the
customer's history, surfaces *related* memories (spreading activation), and
lets belief revision keep facts current when they change.

Run:
    pip install thinkfleet-memmesh
    export MEMMESH_API_KEY=sk-...  MEMMESH_PROJECT_ID=proj_...
    python main.py
"""

import os

from memmesh import MemMesh


def main() -> None:
    mm = MemMesh(
        api_key=os.environ["MEMMESH_API_KEY"],
        project_id=os.environ["MEMMESH_PROJECT_ID"],
    )
    cust = {"kind": "contact", "externalId": "acme-jane"}

    # A few past interactions the bot should remember.
    mm.memory.observe("Jane at Acme is on the Enterprise plan.", subject=cust)
    mm.memory.observe("Jane reported the CSV export is slow on big accounts.", subject=cust)
    mm.memory.observe("Jane prefers Slack over email for updates.", subject=cust)
    # A fact that changes — belief revision supersedes the old one server-side.
    mm.memory.observe("Acme downgraded to the Pro plan this month.", subject=cust)

    # New ticket comes in — recall what we know, semantically.
    print("== recall ==")
    for hit in mm.memory.search("what plan is Jane on", limit=5):
        print(" -", hit.get("content"))

    # Insight synthesis over what we've learned.
    print("== insights ==")
    res = mm.memory.reflect(max_insights=2, dry_run=True)
    for ins in res.get("insights", []):
        print(f" - {ins['content']}  ({ins['confidence']:.0%})")


if __name__ == "__main__":
    main()
