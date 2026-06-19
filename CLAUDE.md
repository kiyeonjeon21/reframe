@AGENTS.md

# Claude Code specifics

`AGENTS.md` (imported above) is the shared source of truth for both Claude Code
and Codex — keep durable project instructions there, not here, so Codex sees
them too.

Claude-only config:

- Project permissions live in `.claude/settings.json` (committed). Personal,
  machine-specific overrides go in `.claude/settings.local.json` (gitignored).
- There is no built-in publish/release hook; releases are a GitHub Actions
  concern (`.github/workflows/publish.yml`). See "Release" in `AGENTS.md`.
- The reframe Claude Code plugin/skill: `skills/reframe/SKILL.md` +
  `.claude-plugin/` (install: `/plugin marketplace add kiyeonjeon21/reframe`
  then `/plugin install reframe@kiyeonjeon21`). Versioning + the
  "bump `plugin.json` when the skill changes" rule live in AGENTS.md "Release".
