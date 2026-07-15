# Command Center

**Run a fleet of coding agents like a team.** One board where every agent —
across every project, repo and session — reports what it's doing, what's blocked,
and what needs *you*. You glance at it when you're back at your machine and see,
in one screen, the two things that actually matter: **what needs a decision**, and
**what's ready to review**.

![The overview: priorities, stats, and status by product](examples/overview.png)

If you drive more than one agent at a time, you know the failure mode: five
terminals, three repos, and no idea which one is stuck waiting on you. Command
Center fixes that. Agents write short status reports to a local store; the board
generates itself from that store and groups everything by product. No dashboards
to wire up, no service to run — it's a ~800-line Node CLI with **zero
dependencies**.

## Install

```bash
npx skills add chakkyy/agent-command-center
```

That drops the `command-center` skill into your agent.

**This is agent-first.** The `ccmd` CLI ships *inside* the skill — it's not on
your `PATH`, and you're not meant to type it into a shell yourself. Your agent
runs it for you. Inside Claude Code the skill is a slash command, so just:

```text
/command-center            → set it up, or open the board
/command-center serve      → run the live dashboard
```

…or ask in plain language ("set up the command-center skill", "open the board").
On first use the skill's `SKILL.md` walks the agent through interviewing you
(products, theme, features) and running `ccmd init` — so **`ccmd: command not
found` never happens**, because you never type `ccmd`. The agent does, by path.

**Want a real `/ccmd` command?** `ccmd init` offers it, or run it any time — it
writes a Claude Code slash command with the binary's path baked in:

```text
ccmd install          # → ~/.claude/commands/ccmd.md
/ccmd serve           # then, in Claude Code: run the board
/ccmd goal --status ready --title "…"
```

<details><summary>Prefer a plain shell <code>ccmd</code>? (optional)</summary>

Link the bundled binary onto your `PATH` once — the agent can do this for you:

```bash
# from wherever the skill was installed:
skills/command-center/bin/ccmd link      # symlinks ccmd → ~/.local/bin
ccmd init && ccmd serve                  # now plain `ccmd` works
```

`ccmd link` prints a PATH hint if `~/.local/bin` isn't on your `PATH` yet. The
[hooks](hooks/) call the binary by absolute path (`ACC_CCMD`), so they work with
or without the link.
</details>

<details><summary>Codex &amp; other agents</summary>

`ccmd` is a plain Node CLI — it works with any agent that can run a shell.

- **Codex:** `npx skills add chakkyy/agent-command-center --agent codex` (add
  `--global` for a global install). Codex invokes the skill as
  `$command-center` (or `$command-center:command-center` when installed as a
  plugin). It has `/goal` but no `/loop`.
- **The `/ccmd` slash command (`ccmd install`) is Claude-Code-specific** — it
  writes `~/.claude/commands/ccmd.md`. On other agents, run `ccmd` by path or
  `ccmd link` it onto your `PATH`.
- **Hooks are separate from the skill.** `npx skills add` installs the skill (the
  reporting protocol); the enforcement [hooks](hooks/) are opt-in and installed
  manually (they need `jq`, `git`, `bash`, and `/hooks` authorization in your
  agent). Requires **Node ≥ 18**. The hooks assume Bash + a POSIX `/tmp`; on
  Windows use the CLI without them.

</details>

## How it works

1. **Agents report themselves.** At the end of a turn, or the moment they're
   blocked, they run one command:

   ```bash
   ccmd report --status IN_PROGRESS --summary "Rebuilding checkout as a 3-step flow; running the Stripe suite now" --task "PROJ-412 / PR #88" --next "ship review step"
   ccmd signal --kind question --msg "Guest checkout, or force account creation? UI is built both ways behind a flag — I just need the call."
   ```

2. **The board generates itself** from the store (`$ACC_HOME`, default
   `~/.agents-command-center`). `project` and `branch` auto-derive from git.
   Nobody hand-edits HTML.

3. **You read it and clear items.** On `ccmd serve`, "Mark read" persists
   instantly. Anywhere else, "Copy what I read" hands you a line you paste back
   into any agent chat to drop those items.

The **Overview** is deliberately a triage screen: one line per pending item, each
jumping to the product tab that holds the full detail. Blockers and questions
stay pinned, highlighted, until an agent resolves them.

## Goals — work that runs while you sleep

Some work can run for *hours* without you toward a clear finish: a big migration,
a deep refactor, a backlog burn-down. Instead of losing it in a tracker, an agent
curates the full paste-ready prompt (with a completion condition) and shelves it
as a **goal**. You pick one any night and fire it with Claude Code's
[`/goal`](https://code.claude.com/docs/en/goal) — it runs until the goal is met.

![The Goals shelf in the soft theme](examples/goals.png)

```bash
ccmd goal --title "Migrate the test suite to Vitest" --hours 5 --status ready \
  --prompt-path goals/web/vitest-migration.md --project web
```

> Renamed from "loops" — the shelf is about *what done looks like*, so it pairs
> with `/goal` (completion) rather than `/loop` (recurrence). `ccmd loop` still
> works as a deprecated alias.

## Themes

Three built-in themes plus a custom accent, injected as CSS variables at render
time. `swiss` (Apple-ish, light/dark auto), `terminal` (dense mono, ops vibe),
and `soft` (Linear-like).

![The terminal theme](examples/terminal.png)

## Make it automatic (optional)

The [hooks](hooks/) wire reporting into Claude Code so agents can't forget: a
`Stop` hook blocks a turn that changed a repo without reporting (once, never
loops), and re-renders the board; a `UserPromptSubmit` hook archives what you've
read when you come back.

## Why local-first

This started life publishing an HTML mirror to a hosted page on every turn. That
was pure overhead — re-uploading the whole board on every report. The live
`ccmd serve` at `localhost` is the default now; the hosted mirror survives only
as an optional adapter (`features.mirror`) for teams that want a shared URL.

## Reference

- **[The agent protocol →](skills/command-center/SKILL.md)** — what agents should
  report, when, and how (this is the heart of it).
- **[Full CLI reference →](skills/command-center/reference.md)**
- **[Hooks →](hooks/)**

Works on mobile too:

![Mobile overview](examples/mobile.png)

MIT licensed.
