# ccmd — command reference

The full CLI surface. `ccmd help` prints a condensed version. Every command
exits 0 (it never blocks a hook). `project`/`branch` auto-derive from git.

**Store:** `$ACC_HOME` (default `~/.agents-command-center`) — your data and
`config.json`. Set `ACC_HOME` to run against a throwaway store (tests, demos)
without touching your real one.

## Running ccmd

`ccmd` ships inside the skill at `bin/ccmd` and is **not on your PATH**. Either
run it by absolute path, or link it once:

```
ccmd link [--dir <bin>]              # symlink the binary into a PATH dir (default ~/.local/bin)
ccmd install [--name ccmd] [--dir d] # write a Claude Code slash command (default ~/.claude/commands/ccmd.md)
ccmd where                           # print the binary's absolute path
```

`ccmd install` writes a `/ccmd` slash command whose body has this binary's
absolute path baked in — so inside Claude Code you can `/ccmd serve`, `/ccmd goal
…`, `/ccmd report …` with no PATH setup and no "command not found". `--name`
renames the command; `--dir` targets a project's `.claude/commands/` instead of
the personal one. `ccmd where` is handy for hooks (`ACC_CCMD="$(…/bin/ccmd where)"`).

## Setup

```
ccmd init [flags]        # first-run setup (writes config.json)
ccmd demo                # seed a realistic example store (for preview/screenshots)
```

`ccmd init` with **no flags and a TTY** runs an interactive wizard. With any flag
(or no TTY) it's non-interactive:

| Flag | Meaning |
|------|---------|
| `--theme swiss\|terminal\|soft` | Board theme (default `swiss`). |
| `--accent "#0a84ff"` | Accent color (hex). |
| `--features goals,seen,mirror` | Enable these; others off. `stats` and core are always on. The old `loops` token is accepted as an alias for `goals`. |
| `--product "id:Label:repo1,repo2"` | A product = a tab grouping repos. Repeatable. |
| `--product "id:Label:icon:repo1,repo2"` | Optional icon (compass, globe, terminal, page, box, cube, cloud, spark, layers, database, bot). |
| `--force` | Overwrite an existing config instead of merging. |

## Reporting

```
ccmd report --status IN_PROGRESS|BLOCKED|DONE --summary "…" \
  [--task "PROJ-1 / PR #2"] [--progress "3/5 · CI green"] \
  [--done "a;b"] [--in-flight "…"] [--next "…"] [--blocked "…"] \
  [--note "…"] [--agent name] [--tier max] [--project p] [--branch b]
```

Overwrites your `project/branch` row (last one wins). `--summary` is the
headline. List flags (`--done/--in-flight/--next/--blocked`) split on `;`.
On the board: `--blocked` → "Your move", `--next` → "Next", URLs in `--note`
become links. `ACC_AGENT` / `ACC_TIER` env vars supply defaults for
`--agent`/`--tier`.

## Signals (blockers & questions)

```
ccmd signal --kind blocker|question --msg "…" [--project p]   # prints an <id>
ccmd resolve <id>                                             # clear it
```

Signals persist, highlighted, until resolved. One self-contained signal per
pending decision. Put it on the tab of the product it's about (`--project`).

## Goals (async-work shelf)

```
ccmd goal --title "…" --summary "…" [--prompt-path f.md] [--links "u;u"] \
  [--prereqs "…"] [--hours N] [--status ready|waiting|draft] [--project p] [--id slug]
ccmd goal --done <id>
```

`draft` = still curating · `waiting` = curated but a prereq is unmet · `ready` =
fire-and-go. Grouped by product on the Goals tab. (Requires `features.goals`.) A
shelved goal pairs with Claude Code's `/goal` — you fire it and it runs until the
completion condition is met.

> **Renamed from "loops".** `ccmd loop …` still works (prints a deprecation
> notice), a `features.loops` key in `config.json` is honored as `goals`, and an
> existing `loops/` store dir is migrated to `goals/` on first run.

## Journal & catchup (history)

```
ccmd catchup [project] [--n 15]   # cold-start context in one command
```

Board rows are overwritten by every report (the board shows the *now*); the
**journal** keeps every report as an append-only event in monthly-rotated
`journal/YYYY-MM.jsonl` files — nothing to configure, it just accumulates.
`catchup` reads it back: the product's recent events (a report made from a git
worktree is attributed to its repo via the origin URL stored on the event),
plus the live board rows and open signals. An agent starting cold should run it
before re-deriving context by hand or repeating finished work.

## Read tracking

```
ccmd read                # stdin: a "ccmd-read: k1, k2" line → marks read (keys validated, no shell)
ccmd seen <key>          # key: entry:<project>/<branch>  |  signal:<id>
ccmd unseen <key>
ccmd prune [--presence]  # archive DONE/read rows now (--presence stamps last-seen)
```

**Read ≠ resolved.** Marking a *report* read drops it off the board. Marking a
*signal* read only dims it ("Acknowledged") and drops it from the Overview — it
stays in its product tab until you `ccmd resolve <id>`. With the `seen` feature
off, none of this runs (no filtering/prune-by-read; `ccmd seen`/`read` refuse;
the server read endpoint 404s).

## Rendering & serving

```
ccmd serve [--port 7777]     # live local dashboard; marking read persists here (POST /seen · /unseen)
ccmd render                  # regenerate $ACC_HOME/dashboard.html
ccmd data                    # JSON of the board model (debug / other consumers)
```

## Optional hosted mirror

Off by default (`features.mirror`). The board is local-first; the mirror exists
for teams that want a shared URL.

```
ccmd mirror [--fragment] [--out file.html]   # HTML export for a hosted page
ccmd set-url <url> | ccmd get-url            # remember the mirror URL
```

`--fragment` omits the `<html>/<head>/<body>` wrapper (for embedding in a host
that supplies its own).

## Config file

`$ACC_HOME/config.json`:

```jsonc
{
  "products": [
    { "id": "web", "label": "Web", "icon": "globe", "repos": ["app", "marketing"] }
  ],
  "theme": "swiss",              // swiss | terminal | soft
  "accent": "#0a84ff",           // any hex
  "features": { "goals": true, "seen": true, "mirror": false },
  "mirrorUrl": null,
  "staleMs": 21600000            // rows with no update past this go grey (6h default)
}
```

Feature toggles turn off the matching tab, commands, and board sections. `stats`
and the core report/signal loop are always on.

## Environment variables

| Var | Effect |
|-----|--------|
| `ACC_HOME` | Store location (default `~/.agents-command-center`). |
| `ACC_PORT` | Default port for `ccmd serve`. |
| `ACC_AGENT` / `ACC_TIER` | Defaults for `report --agent` / `--tier`. |

## Gotcha

`ccmd report --help` is **not** help — the unknown flag is swallowed and it
overwrites your row with an empty report. The only help is `ccmd help`.
