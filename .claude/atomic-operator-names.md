# Atomic operator names (as-built)

> Status: **implemented** (AL-4154). This document describes the design as
> shipped. Backspace-to-revert (re-expanding an operator into editable letters)
> was considered but **not** implemented — see [Future work](#future-work).

## Goal

Replace MathQuill's old "auto-un-italicize" handling of operator names (`sin`,
`cos`, `hcf`, …) with an **atomic node** model:

- An operator name is **always one atomic node** (`OperatorName`), regardless of
  how it entered the field — typed, parsed from `\sin`, or parsed from
  `\operatorname{…}`. There is no longer any concept of an un-italicized *run of
  letters*.
- The node is **fully atomic**: the caret cannot enter it, arrow keys step over
  the whole word, and a single backspace deletes it whole.
- The legacy auto-un-italicize machinery is **removed entirely**.

## Decisions (as shipped)

| Question | Decision |
| --- | --- |
| Cursor/selection treatment | **Fully atomic** — caret cannot enter it; arrow keys step over the whole word; backspace deletes it whole (no revert). |
| LaTeX serialization | **Keep the `\sin` vs `\operatorname{}` split** — built-in names emit `\sin `, nonstandard names emit `\operatorname{hcf}`. Preserves round-trip compatibility with stored exercise LaTeX. |
| Which names are operators | All `DEFAULT_OP_NAMES` are registered as `\name` macros in `LatexCmds`; **typed recognition** is scoped to the names in `MQOptions.autoOperatorNames`. |
| Recognition trigger | On the **first non-letter keystroke** (e.g. space), via `MathBlock.handleAutoCommands`. Typing letters alone never converts; conversion waits for the trigger. |
| Matching | **Whole contiguous run only**, never a substring/suffix. |
| Auto-parenthesizing | Fires **on the recognition path**, gated by membership in **both** `autoParenthesizedFunctions` **and** `autoOperatorNames` (the historical dual gate). `autoParenthesizedFunctions` defaults to empty, so nothing auto-parenthesizes unless configured. |

## The node: `OperatorName`

`src/commands/math/basicSymbols.ts` — `class OperatorName extends MQSymbol`
(≈ L464).

```ts
class OperatorName extends MQSymbol {
  operatorName: string; // the bare word, e.g. "sin"

  constructor(fn?: string) {
    const word = fn || '';
    const isBuiltIn = BuiltInOpNames.hasOwnProperty(word);
    const ctrlSeq = isBuiltIn ? '\\' + word + ' ' : '\\operatorname{' + word + '}';
    super(ctrlSeq, h('span', { class: 'mq-operator-name' }, [h.text(word)]), word, word);
    this.operatorName = word;
  }
}
```

- **Fully atomic for free**: an `MQSymbol` with no blocks — the cursor steps over
  it and selects it whole. There is no `deleteTowards` override, so the inherited
  whole-node delete applies.
- **Serialization** comes from `ctrlSeq` set in the constructor, keyed off
  `BuiltInOpNames`: built-ins round-trip as `\sin `, nonstandard names as
  `\operatorname{gcf}`. The trailing space in `\sin ` is stripped by the
  controller's `cleanLatex` on export.
- **`text()` / `mathspeak()`**: the constructor passes the bare `word` as both
  the text template and the mathspeak name, so `MQSymbol.text()` →`"sin"` and the
  base `mathspeak()` → `"sin"`. The `autoOperatorNames` speech-friendly alias
  (the `name|spoken` form, e.g. `csc|cosecant`) is applied by
  `MathBlock.mathspeak` (see below).

### Rendering / spacing

The node renders as a single `<span class="mq-operator-name">word</span>` (note:
a `<span>`, not the old per-letter `<var>`). Operator spacing is reproduced on
that one element by `updatePadding()` (≈ L489), called from `finalizeTree`,
`siblingCreated`, and `siblingDeleted`:

- `mq-first` (left gap) unless the left neighbor is absent / `.` / a
  `BinaryOperator` / a `SummationNotation` (see `shouldOmitPadding`, ≈ L508).
- `mq-last` (right gap) under the same rule, *and* not when followed by a
  `Bracket`.
- A trailing `SupSub` instead carries `mq-after-operator-name` (unless a bracket
  follows it), matching the old renderer.

CSS: `src/css/math.less` — the `.mq-operator-name`, `.mq-operator-name.mq-first`,
`.mq-operator-name.mq-last`, `.mq-supsub.mq-after-operator-name` rules. (The
selectors were de-`var`-qualified so they match the `<span>`.)

## Entry paths (all yield one `OperatorName`)

1. **Typed + trigger** — `MathBlock.handleAutoCommands` (`src/commands/math.ts`
   ≈ L758). On a non-letter keystroke it builds the contiguous letter run left of
   the cursor and, if the whole run is in `autoOperatorNames`, replaces it with
   `new OperatorName(name)`. See [Recognition details](#recognition-details).
2. **`\name` macro / `.cmd('\\sin')`** — every `DEFAULT_OP_NAMES` entry is
   registered `LatexCmds[name] = OperatorName` (≈ L533). The latex parser /
   `.cmd` instantiate `new OperatorName(name)`.
3. **`\operatorname{…}`** — `LatexCmds.operatorname` (≈ L542) parses the brace
   group; an all-letters body becomes `new OperatorName(body)`. This also covers
   `\operatorname{ans}` (see below). Non-letter bodies fall back to the parsed
   children.
4. **`ans`** — `LatexCmds.ans = OperatorName` (≈ L540). The old bespoke
   `AnsBuilder` is removed; `ans` is now a plain atomic operator and renders with
   `mq-operator-name` (the old `mq-ans` class had no stylesheet rule).

## Recognition details (`MathBlock.handleAutoCommands`)

`src/commands/math.ts` ≈ L758. One method handles both `autoCommands` (e.g.
`pi` → `\pi`) and `autoOperatorNames` (e.g. `sin` → `\sin`):

- **Trigger**: returns immediately unless `ch` is a non-letter.
- **Subscript guard**: respects `disableAutoSubstitutionInSubscripts` via
  `shouldIgnoreSubstitutionInSimpleSubscript` on the left node.
- **Whole-run matching**: scans the contiguous plain-letter run *one past*
  `maxLength`; if the run is longer than any dict entry it bails (so it can never
  match a suffix). This is what stops `afstand` → `tan`, `arcsin` → `arc\sin`
  (with a short custom dict), and `api` → `a\pi`.
- **Precedence**: `autoCommands` first (may map to arbitrary `LatexCmds`), then
  `autoOperatorNames` → `new OperatorName(str)`.
- **Auto-parenthesize**: after creating the operator, `autoParenthesizeOperator`
  (≈ L841) writes `(` iff the name is in **both** `autoParenthesizedFunctions`
  **and** `autoOperatorNames`, and the argument isn't already parenthesized
  (`cursor.parent.getEnd(R)` is a `\left(`). Because this runs on the same
  keystroke as recognition, the trigger space is consumed by `write`'s existing
  space-suppression rather than landing inside the new parentheses.

## Removed legacy behavior

- `Letter.autoUnItalicize` and its `sharedSiblingMethod` / `finalizeTree` /
  `siblingCreated` / `siblingDeleted` wiring — the per-letter un-italicize model.
- `Letter.checkAutoCmds` — was dead code (its only caller was the commented-out
  AL-1304 line).
- `Letter.autoParenthesize` and the `Letter.createLeftOf` override — auto-paren
  moved onto the recognition path; `Letter` now inherits `createLeftOf`.
- `TwoWordOpNames` — its only consumer was `autoUnItalicize`.
- `AnsBuilder` (`src/commands/math/commands.ts`) — subsumed by `OperatorName`.
- The old explode-into-letters `OperatorName.parser` / `createLeftOf`.

## Output methods — why they were required

The old letter-run set `isPartOfOperator` on each letter; several consumers
relied on it. The atomic node loses that signal, so it reproduces the output
itself:

- **`mathspeak()`** — `MathBlock.mathspeak` (`src/commands/math.ts` ≈ L543) has a
  branch for `OperatorName` children: it reads `node.operatorName`, applies the
  `autoOperatorNames` speech alias if present, and pushes `" word "`. Without
  this, `csc` would be spelled out instead of spoken "cosecant".
- **`text()`** — emits the bare word; because the node is not a `Variable`, the
  digit-autosubscript and implicit-`*` logic in `Variable`/`Digit` naturally
  skips it (e.g. a digit after `\sin` does **not** autosubscript, because the
  left node isn't a `Variable`).

## Op-name lists (source of truth)

`src/commands/math/basicSymbols.ts` ≈ L383:

- `BUILT_IN_OP_NAMES` — real LaTeX operators (serialize as `\sin`).
- `NONSTANDARD_OP_NAMES` — auto-only names (serialize as `\operatorname{…}`).
- `DEFAULT_OP_NAMES = BUILT_IN_OP_NAMES.concat(NONSTANDARD_OP_NAMES)` — the full
  set, used to seed `BuiltInOpNames`, the default `autoOperatorNames`, and the
  `LatexCmds` registration.

These explicit literal arrays replaced the old generative loops. `BuiltInOpNames`
is consumed only by the `OperatorName` constructor to choose `\sin ` vs
`\operatorname{}`.

## Behavior changes vs. the old model

- **Trigger required**: typing `sin` alone no longer converts; a non-letter
  trigger (space, operator, `(` via auto-paren) is needed. (`pi`-style
  autoCommands already worked this way since AL-1304.)
- **Whole-run only**: a longer word containing an operator name does not convert
  its tail.
- **Paste / parse of bare letters**: `\operatorname{sin}` and `\sin` parse to the
  operator, but bare letters in pasted/parsed latex (e.g. `x_{sin}`) stay
  letters — there is no post-parse auto-conversion.

## Tests

Migrated to the atomic, trigger-based model:

- `test/unit/autoOperatorNames.test.js` — rewritten around `typedText('sin ')`,
  whole-run matching, atomic delete, paste-stays-letters.
- `test/unit/typing.test.js` — autoParenthesizedFunctions suite uses the trigger
  space; "parenthesizes exactly once" / "does not double parenthesize" exercise
  the `autoParenthesizeOperator` already-parenthesized guard.
- `test/unit/latex.test.js` — cursor-stepping cases reduced to whole-operator
  steps (no intra-operator positions). *Selection-bracket placement in the
  shift cases was re-derived by reasoning; confirm in browser.*
- `test/unit/css.test.js` — operator spacing asserted on the single
  `.mq-operator-name` span.
- `test/unit/autosubscript.test.js` — uses `\sin` (operator) input.
- `test/unit/ans.test.js` — `ans` via the trigger; renders as `.mq-operator-name`.
- `test/support/assert.ts` — added `assert.doesNotThrow`.

> The Mocha suite runs in the browser only (`test/unit.html`); it is not run in
> CI here. A couple of rewritten cases are flagged in-comment for in-browser
> confirmation.

## Future work

- **Backspace-to-revert** — re-expand an atomic operator into its constituent
  editable letters on backspace ("undo autocorrect"), instead of deleting it
  whole. Precedent: `To.deleteTowards` (`src/commands/math/basicSymbols.ts`
  ≈ L1013) removes the atomic `→` node and re-creates a `MinusNode`. An operator
  `deleteTowards` would do the same with `Letter`s — fixing `cursor[L]` to the
  left sibling *before* inserting (otherwise sibling pointers corrupt), and
  taking care that the recognition pass does not instantly re-collapse the
  letters (it fires only on a non-letter trigger, so a backspace should be safe,
  but verify with a test).
- **Default mathspeak aliases** — the `name|spoken` alias mechanism works for
  user config and is consumed in `MathBlock.mathspeak`, but the default op set
  carries no aliases. The op-name lists could be enriched to associate a default
  spoken form per name (e.g. `arcsin` → "arc sine").
- **Edge case**: a `SupSub`'s `mq-after-operator-name` is only re-evaluated when
  the *operator's* siblings change, not when a bracket is later inserted after
  the supsub. Minor; the old code monkey-patched the supsub to handle it.
