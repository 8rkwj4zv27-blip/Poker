# Build and review workflow

How a scoped stage of work is built and checked (owner, 12 Oct 2026).
`CLAUDE.md` still holds the house rules; this is the order of work inside
one stage.

1. **Define acceptance checks** before writing code, in the stage's plan
   doc: what must be true, each one checkable.
2. **Implement the scoped stage**, and nothing beyond it.
3. **Independent review:** a separate review agent reads the diff against
   the acceptance checks, if one is available in the session. If none is,
   say so in the report.
4. **Run the relevant tests and exercise the actual flow:** `npm test`,
   plus the real game in an emulated iPhone (`validation/tools/`) for
   anything a player sees. If a browser isn't available, say so.
5. **Fix findings** and repeat the checks they affect.
6. **Stop** when the checks pass and no blocking finding remains.

## Reporting

- Report only checks that were actually run. A check that wasn't run is
  listed as not run, never as passed.
- If repeated attempts at a fix fail, stop and report the blocker (what
  fails, what was tried) rather than looping.
- The report ends with how the owner opens the result to review it.
