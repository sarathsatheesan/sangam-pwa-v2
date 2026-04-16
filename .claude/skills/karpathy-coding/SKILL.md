---
name: karpathy-coding
description: >
  Coding discipline skill combining Andrej Karpathy's engineering principles with ethniCity/Sangam PWA patterns.
  Use this skill on EVERY coding task in this project — feature work, bug fixes, refactors, reviews, or when
  the user asks to write, edit, or debug code. Also triggers when the user mentions "Karpathy", "coding principles",
  "keep it simple", "minimal diff", or "surgical change". Think of this as the project's coding constitution.
---

# Karpathy Coding Principles + ethniCity Project Patterns

These guidelines exist because LLMs tend toward three failure modes: overbuilding (adding unrequested features), overcoupling (changing things adjacent to the task), and overconfidence (assuming instead of asking). The principles below counter all three. They also encode hard-won patterns from the ethniCity/Sangam PWA codebase so you don't repeat past mistakes.

---

## Part 1: Universal Karpathy Principles

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before writing any code:

- **State assumptions explicitly.** If you're unsure whether the user wants a Firestore rule change or a client-side guard, say so. Don't pick silently.
- **Present multiple interpretations** when ambiguity exists. A one-line "did you mean X or Y?" saves a 200-line rewrite.
- **Push back when warranted.** If a simpler approach exists, say so — even if the user asked for something more complex.
- **Stop when confused.** Name what's confusing and ask. A clarifying question now is cheaper than a wrong implementation later.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code — a helper function used once is just indirection.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

The gut check: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These principles are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Part 2: ethniCity / Sangam PWA Project Patterns

These patterns come from real bugs and architectural decisions made during development. They exist because ignoring them has caused white pages, crashed components, or broken builds in the past.

### Tech Stack (don't deviate without discussion)

- **React 19** + **TypeScript** + **Vite 7.3** (PWA mode via vite-plugin-pwa)
- **Firebase**: Auth, Firestore, Storage, Hosting
- **Styling**: Aurora design system via CSS custom properties (`var(--aurora-*)`)
- **State**: React Context (AuthContext, ThemeContext) — no Redux, no Zustand
- **Routing**: React Router v7 with `React.lazy()` code splitting

### Firestore Null Guards (Critical)

Firestore documents frequently have missing or undefined fields. Every field access from a Firestore document needs defensive coding:

```typescript
// String fields — guard before .substring(), .toLowerCase(), etc.
(post.content || '').substring(0, 120)

// Array fields — guard before .map(), .filter(), .some(), etc.
(fav.items || []).map(item => item.name)

// Timestamp fields — double optional chain
fav.lastOrderedAt?.toDate?.()

// Auth context objects — always optional chain
userProfile?.name || ''
userProfile?.email || user.email || ''
```

The reason this matters: Firestore returns `undefined` for missing fields (not null, not empty string). Calling `.substring()` on `undefined` throws, and without an ErrorBoundary that crash produces a white page with no error message.

### ErrorBoundary + Chunk Retry

App.tsx wraps all Routes in `<AppErrorBoundary>` — a class component (React 19 still requires class components for error boundaries). This catches render-time crashes and shows a recovery UI instead of a white page.

Lazy imports use `lazyRetry()` which retries once on `ChunkLoadError`. This handles stale Service Worker caches serving old chunk hashes after a deploy.

```typescript
// Always use lazyRetry, never bare lazy()
const ProfilePage = lazyRetry(() => import('./pages/profile'));
```

If you add a new page or lazy-loaded component, use `lazyRetry()`.

### Firestore Subscriptions

Wrap `onSnapshot` subscriptions in try-catch. Firestore can throw synchronously (e.g., permission denied, offline with no cache). Without a catch, the component crashes on mount.

```typescript
useEffect(() => {
  if (!user) { setLoading(false); return; }
  let unsub: (() => void) | undefined;
  try {
    unsub = subscribeToSomething(user.uid, (data) => {
      setData(data);
      setLoading(false);
    });
  } catch (err) {
    console.error('[ComponentName] Firestore subscription failed:', err);
    setLoading(false);
  }
  return () => unsub?.();
}, [user]);
```

### Aurora Design System

All colors use CSS custom properties — never hardcode hex values:

```typescript
// Correct
style={{ color: 'var(--aurora-accent)' }}

// Wrong — breaks theme switching
style={{ color: '#6C63FF' }}
```

Key variables: `--aurora-bg`, `--aurora-surface`, `--aurora-accent`, `--aurora-text`, `--aurora-text-secondary`, `--aurora-border`.

### File Sync Pattern

Some pages are kept in sync as copies (e.g., `messages.tsx`, `business.tsx` share a base). When editing one, check if a counterpart exists and needs the same change. Use `cp` to sync after deliberate edits — but mention it to the user first (Surgical Changes principle).

### Build Verification

After any code change, verify with:

```bash
npx tsc -b --noEmit          # Type check
npx vite build                # Full production build
```

Both must pass clean. The Vite build also generates the SW precache manifest — if it fails, the PWA won't update.

### React Rules (enforced by the compiler)

- No conditional hooks — every `useEffect`, `useState`, `useMemo` must run on every render
- No object/array literals as hook dependencies — memoize with `useMemo` first
- Cleanup functions in `useEffect` must handle the case where the subscription never started (`unsub?.()`)

---

## Quick Reference

| Situation | Do | Don't |
|---|---|---|
| Firestore field access | `(field \|\| '').method()` | `field.method()` |
| New lazy page | `lazyRetry(() => import(...))` | `lazy(() => import(...))` |
| Color value | `var(--aurora-*)` | Hardcoded hex |
| Adjacent code looks messy | Mention it, leave it | "Improve" it in the same PR |
| Unclear requirement | Ask before coding | Guess and build both options |
| 200 lines, could be 50 | Rewrite shorter | Ship it with a "TODO: simplify" |
