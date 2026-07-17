---
name: command-center
description: Report your status to the shared agent Command Center board. Use at the end of every turn/session (heartbeat), IMMEDIATELY when you hit a blocker or need the user's input, when you spot async-able work to shelve as a goal (autonomous run), and when the user pastes a "ccmd-read:" line. Works in any folder/project.
---

# Command Center

A single board where every agent — across every project and session — reports
what it's doing, what's blocked, and what needs the user. The user reads it at a
glance when they're back at their machine, via `ccmd serve` →
**http://localhost:7777**. The board regenerates from the store; you only write
to the store.

**Source of truth = local files** under `$ACC_HOME` (default
`~/.agents-command-center`). `project` and `branch` auto-derive from git — you
rarely pass them.

## Running `ccmd` (read this first)

`ccmd` is **not an installed CLI** — it's a Node script bundled with THIS skill at
`bin/ccmd` (no deps). Running bare `ccmd` will fail with "command not found".
Before your first call, resolve its absolute path **once** and reuse it:

```bash
# This skill's directory is known to you (it's where this SKILL.md was loaded from).
CCMD="<this-skill-dir>/bin/ccmd"     # e.g. ~/.claude/skills/command-center/bin/ccmd
# Or discover it: the binary sits next to this file, under bin/. If unsure, find it:
#   find ~ -path '*/command-center/bin/ccmd' -type f 2>/dev/null | head -1
```

Then call it by that path from **inside the user's repo** (so git context is
right): `"$CCMD" report …`. In every example below, `ccmd` is shorthand for that
absolute path. Two things that make later calls plain `ccmd`:

- **`"$CCMD" install`** — writes a Claude Code `/ccmd` slash command with this
  path baked in, so the user can run `/ccmd serve`, `/ccmd goal …` themselves.
  Offer this on first setup.
- **`"$CCMD" link`** — symlinks it onto PATH (`~/.local/bin`); after that, and for
  the hooks, plain `ccmd` works.
- If the user already ran `link`/`install` (or aliased it), just use `ccmd`.

**The board is 100% generated.** The UI lives in `template/` and `ccmd` renders
it identically for `dashboard.html`, `ccmd serve` and the optional hosted
mirror. NEVER hand-edit board HTML, and never re-embed a UI in `bin/ccmd`.

> First run: if `$ACC_HOME/config.json` doesn't exist yet, set it up before your
> first report — see **First-run setup** at the bottom. A good first-run sequence
> is: resolve `$CCMD` → `"$CCMD" link` → interview the user → `ccmd init …`.

## When to report (proactively, in ANY repo)

### 1. Blocker / need user input → signal it IMMEDIATELY (don't wait for turn end)

```
ccmd signal --kind blocker  --msg "…"
ccmd signal --kind question --msg "…"
```

It prints an `id`. When the blocker clears, run `ccmd resolve <id>`.

**Every pending user decision = ONE self-contained `question` signal.** Don't
pile "approve X · decide Y · generate Z" into a report's `--next` — that's
unreadable. Each signal carries: what to decide/do, the minimum context to
decide *without going to look it up*, where the detail lives (a concrete doc/PR,
with a URL — URLs are auto-linkified), and what it unblocks. **And it goes on the
tab of the product it's ABOUT:** pass `--project <repo>` explicitly when that
differs from your cwd (a signal about a PR in `repo-a` doesn't belong on
`repo-b`'s tab).

- Good: *"Guest checkout for the review step: allow it, or force account
  creation? (PR #412) The UI is built both ways behind a flag — I just need the
  call. Blocks shipping checkout-v2."*
- Bad: *"decide guest checkout"*

The report's `--next` is for YOUR next step as an agent, not the user's pending
decisions.

### 2. End of every turn with changes / before a long wait → heartbeat

```
ccmd report \
  --status IN_PROGRESS|BLOCKED|DONE \
  --summary "ONE sentence with context: what you're doing NOW and where you stand" \
  --task "PROJ-412 / PR #88" \
  --progress "3/5 sections · CI green" \
  --in-flight "what's running now" \
  --next "the concrete next thing" \
  --blocked "what it depends on (if any)" \
  --done "recent milestone" \
  --agent "your-model" --tier max
```

**`--summary` is the key field** — the headline the user reads at a glance. Write
one concrete, contextual sentence, not loose fragments. `--task` and `--progress`
are short optional chips. Lists (`--in-flight/--next/--blocked/--done`) are `;`
separated (commas stay inside an item). `report` **overwrites** your
`project/branch` row (last one wins — it never piles up). On the board `--blocked`
shows as "Your move", `--next` as "Next", and URLs in `--note` render as links.

If a Stop hook is installed (see `hooks/`), this is enforced: a turn that changed
the repo without a fresh `report` is blocked once with instructions. Report and
move on — it's one-shot, it won't loop.

## Goals: curate async-able work (own tab)

When you spot work that could run for **hours** without the user toward a
verifiable finish (a big integration, deep research, a massive refactor, burning
down a backlog), don't leave it buried in a tracker — shelve it as a **goal** so
the user can fire it off any time:

```
ccmd goal --title "…" --summary "what it achieves, in one sellable sentence" \
  --prompt-path <a .md file with the FULL paste-ready prompt> \
  --links "issue-url;doc-url" --prereqs "what must merge first" \
  --hours 6 --status ready --project <repo>
ccmd goal --done <id>   # when it's completed
```

**The pairing:** a shelved goal is a prompt with a completion condition — the
user fires it with **Claude Code's `/goal`** (which runs until the goal is met),
or `/loop` for the recurring-maintenance kind. That's why it's "goals", not
"loops": the shelf is about *what done looks like*, not recurrence.

Curation quality = referenced specs/docs, explicit budgets (API calls, tokens),
the repo's branch rules, an explicit completion condition, and end-to-end
verification baked into the prompt. The tab groups goals by product: always pass
`--project <repo>`. Use `--status draft` while curating, `waiting` if it's
curated but a prereq is unmet (say which in `--prereqs`), and `ready` only when
it can be fired as-is.

**If the user is present in the session: ASK before shelving.** When you spot
async-able work, tell them ("this can run for ~N hours on its own") and offer both
exits: run it now, or shelve it as a goal. Only shelve without asking when you're
running unattended (an overnight run) or when they already asked.

## Processing a pasted `ccmd-read:` line (read relay)

The board's "Copy what I read" button builds a line with the real store keys.
When the user pastes something matching `^ccmd-read:\s*(.+)$` (possibly with text
around it):

1. For each comma-separated key: `ccmd seen "<key>"` (keys are
   `entry:<project>/<branch>` or `signal:<id>`; idempotent).
2. Confirm in one line ("dropped N items from the board"). No `ccmd prune`
   needed — the presence hook archives read rows. (If they use `ccmd serve`,
   clicks persist on their own and this relay is rarely needed.)

## What you do NOT need to do

- **Rendering** (`ccmd render`) and **pruning** (`ccmd prune --presence`) run
  from hooks if installed — don't call them manually unless asked.
- Don't invent `--project`/`--branch` unless you're outside a git repo or the
  auto-derived values are wrong.
- Don't touch `template/` unless the user asks for a design change.

## Cleanup model (what survives)

- Your `report` row is overwritten each time — always current, never piles up.
- `DONE` rows and user-read rows are archived on the user's next presence.
- **Blockers and questions persist, highlighted, until you `ccmd resolve <id>`**
  them (or the user clears them). Resolve yours when they clear.

## Gotchas

- `ccmd report --help` is NOT help — the flag is swallowed and it overwrites your
  row with an empty report. The only help is `ccmd help` (no subcommand).
- If a Stop hook blocks with "Command Center: you made changes…", that's the
  enforcement: report and continue. It's one-shot, it won't loop.

## Processing a pasted read line, safely

When the user pastes a `ccmd-read: …` line, **pipe it to `ccmd read`** instead of
shelling out per key — it validates every key internally, so untrusted clipboard
text never reaches a shell:

```
printf '%s' "<the pasted line>" | ccmd read
```

(`ccmd seen <key>` still exists for a single explicit key.)

## Serving the board (don't background silently)

`ccmd serve` is a long-running process. **Don't silently background it.** Give the
user the command to run in their own terminal, or ask first — they should own the
process:

```
ccmd serve      # → http://localhost:7777  (Ctrl-C to stop)
```

## First-run setup

If `$ACC_HOME/config.json` is missing, set it up before the first report:

- **With the user present (e.g. in Claude Code):** interview them and run the
  non-interactive form:
  ```
  ccmd init --theme swiss|terminal|soft --accent "#0a84ff" \
    --features goals,seen --product "web:Web:globe:app,marketing" --product "api:API:terminal:api"
  ```
  Ask: which products group which repos; theme; accent; and which features to
  enable —
  - `goals` — a shelf of async work fired with `/goal`,
  - `seen` — the read-relay (mark read / copy),
  - `mirror` — **off by default**; only if they want a shareable *hosted* board URL
    on top of the always-on local server. Most users want just the local board.

  `--product` is `id:Label[:icon]:repo1,repo2` and repeatable. Offer `ccmd install`
  (the `/ccmd` slash command) too.
- **Solo/unattended:** run `ccmd init` with sensible defaults, or `ccmd demo` to
  preview against an example store.
- **Nice-to-have:** long agent sessions drift on the current time. Suggest the
  time-awareness util (separate plugin): `claude plugin marketplace add
  chakkyy/agent-utils` → `/plugin install time-awareness@agent-utils`.

**Starting cold in a repo (no context on what happened)?** Run
`ccmd catchup [project]` first: it prints the product's recent journal events
(worktree reports included), the live board rows and the open signals — read it
before re-deriving context by hand or repeating work that's already done.

Full command surface: [reference.md](reference.md).
