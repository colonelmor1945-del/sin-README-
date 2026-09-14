# Working on GTA 6 Money Lab

Two people work on this repository. Read this before starting anything.

## Who is who

| Git identity | Person |
|---|---|
| `nlknlk` | Elliot |
| `Aurora <oficial@notaria.local>` | the repository owner |

Branches do not carry real names, so check the author before assuming a branch
is yours.

## Start every session by looking for the other person's work

Do this first, before reading code or planning anything:

```bash
git fetch --all && git branch -r && git log --oneline HEAD..origin/main
```

**If any of that returns something you have not seen, say so to the user before
you begin.** Two people on one repository is how work gets done twice, and the
cost of checking is four seconds.

Branches are often **stacked** — one built on another rather than on `main`.
Check what a branch is actually based on before merging it, and merge the base
first. `git log --oneline origin/main..origin/<branch>` shows the real contents.

Before opening a pull request, test the merge without touching the worktree:

```bash
git merge-tree --write-tree HEAD origin/<their-branch>
```

A clean result is not the whole answer. Two branches can touch entirely
different files and still disagree — one adding a concept the other should be
using. Look at what the change *means*, not only which lines it moves.

## Branches and commits

- Never commit to `main`. Branch, then open a pull request.
- Prefixes in use: `fix/`, `align/`, `chore/`. Feature work takes a plain
  descriptive name.
- Decisions shared with the engine repository are recorded as numbered ADRs
  (`ADR-027` and so on). If a change references one, the reasoning lives in
  that other repository, not here.

## Do not let the lockfile churn

`npm install` on a different npm version rewrites `package-lock.json` —
dropping or adding `libc` fields on optional platform packages — which then
conflicts on every branch and reverts every time the other person installs.

**If you did not add or change a dependency, `package-lock.json` must not
appear in your diff.** Check before committing:

```bash
git diff --name-only origin/main...HEAD
```

If it is there and no dependency changed: `git checkout origin/main -- package-lock.json`.

## Two traps that cost an afternoon each

Both are documented at length in `README.md`; they are repeated here because
they are the ones that waste a day.

- **Never run `npm run build` while `npm run dev` is running.** They share
  `.next`. Pages still compile and requests still return 200, but the
  stylesheet 404s and every page renders unstyled with no error anywhere. Use
  `npm run build:check`, which writes to `.next-check`.
- **Two of the auth lockout tests fail only under load.** `npm test` runs
  thirteen files in parallel and scrypt at N=2¹⁵ needs about 32 MB and real CPU
  per hash, so those tests exceed the 5 s default timeout. Run
  `npx vitest run src/lib/auth/actions.test.ts` on its own and all twelve pass.
  It is a timeout, not a regression — do not go hunting for a bug in the
  rate limiter.

## The rule that governs the codebase

Every game figure carries a provenance label, and that label travels with the
number wherever it goes. `src/lib/provenance.ts` is the only source of truth
and `<ProvenanceTag>` is the only component that renders it.

This is not decoration — it is the single thing separating this product from
every other GTA guide site. `docs/STATUS.md` explains the reasoning and the two
corollaries that have already caught people out.

Content taken from elsewhere — a Reddit thread, a video, anything a player
wrote — is subject to the same rule. It is not exempt for being someone else's
words; if anything it is the weakest tier there is.

## Where the rest is written down

- `README.md` — architecture and setup
- `docs/STATUS.md` — what is built, what is not, what was tried and failed
- `docs/platform-viability.md` — why the app stores are a bad deal here
- `docs/deploy.md`, `docs/cloudflare.md` — going live
