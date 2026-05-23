# Welcome to GemX

## How We Use Claude

Based on polynn's usage over the last 30 days:

Work Type Breakdown:
  Build Feature   ████████████░░░░░░░░  44%
  Debug Fix       ██████████░░░░░░░░░░  33%
  Plan Design     ███░░░░░░░░░░░░░░░░░  15%
  Write Docs      █░░░░░░░░░░░░░░░░░░░   4%
  Improve Quality █░░░░░░░░░░░░░░░░░░░   4%

Top Skills & Commands:
  /exit                           ██████████████░░░░░░  14x/month
  /plugin                         ██████░░░░░░░░░░░░░░   6x/month
  /context                        ████░░░░░░░░░░░░░░░░   4x/month
  /compact                        ███░░░░░░░░░░░░░░░░░   3x/month
  /usage                          ███░░░░░░░░░░░░░░░░░   3x/month
  /frontend-design:frontend-design ██░░░░░░░░░░░░░░░░░░   2x/month
  /reload-plugins                 ██░░░░░░░░░░░░░░░░░░   2x/month
  /claude-mem:learn-codebase      █░░░░░░░░░░░░░░░░░░░   1x/month
  /debug                          █░░░░░░░░░░░░░░░░░░░   1x/month

Top MCP Servers:
  None configured yet

## Your Setup Checklist

### Codebases
- [ ] infinity-gemx (frontend/admin) — github.com/po-lynn/gemx-backend

### MCP Servers to Activate
  None currently in use — this is a good area to explore.

### Skills to Know About
- `/frontend-design:frontend-design` — Generates distinctive, production-grade admin UI. Used heavily for redesigning list views, dashboards, and drawers. Run it before implementing any significant UI component.
- `/claude-mem:learn-codebase` — Indexes the repo into Claude's memory so future sessions have full context without re-reading files. Run once after a fresh clone.
- `/debug` — Structured debugging workflow. Use for tricky runtime errors (like the Promise.all hang on Vercel, ref-during-render errors).
- `/compact` — Compresses conversation history when context gets long. Run it mid-session on large feature builds to stay under limits.
- `/context` — Shows what Claude currently has in context. Useful for verifying the right files are loaded before a big change.
- `/plugin` and `/reload-plugins` — Manage installed skill plugins. Run `/reload-plugins` after installing or updating a plugin.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
