# Plan: Atomic, backspace-revertible operator names

## Goal

Replace MathQuill's current "auto-un-italicize" handling of operator names
(`sin`, `cos`, `hcf`, …) with an **atomic node** model:

- An operator name is **always one atomic node**, regardless of how it entered
  the field (typed or parsed from LaTeX). There is no longer any concept of an
  un-italicized *run of letters*.
- Pressing **backspace** on the atomic node **re-expands it into its
  constituent editable letters** — like undoing an autocorrect.
- The legacy auto-un-italicize behavior is **removed entirely**.

## Decisions (confirmed)

| Question | Decision |
| --- | --- |
| Cursor/selection treatment | **Fully atomic** — caret cannot enter it; arrow keys step over the whole word; only backspace reverts it. |
| LaTeX serialization | **Keep the `\sin` vs `\operatorname{}` split** — built-in names emit `\sin `, nonstandard names emit `\operatorname{hcf}`. Preserves round-trip compatibility with stored exercise LaTeX. |
| Which names become atomic + revertible | **Only names configured via `MQOptions.autoOperatorNames`.** Atomicity and backspace-revertibility are scoped to that option set, not to every operator-name macro. |
| Auto-parenthesizing | **Stays coupled to `autoOperatorNames`** — auto-`(` fires for names in that set, at `OperatorSymbol` recognition. This matches today's behavior (auto-paren already requires the name to be in `autoOperatorNames`) and collapses recognition + auto-paren into one trigger point. The `autoParenthesizedFunctions` cross-check can be simplified or retired. |

## Current behavior (what we're replacing)

Operator names are recognized as a *run of `Letter` nodes* that get
un-italicized in place — the letters are **not** consumed into a single node.

Key locations in `src/commands/math/basicSymbols.ts`:

- `autoUnItalicize` (≈ L471–558) — walks a contiguous letter run, calls
  `letter.italicize(false)` on each, and decorates the first/last letter's
  `ctrlSeq` with `\sin ` or `\operatorname{…}`. Also handles `TwoWordOpNames`
  spacing and `SupSub`/`mq-first`/`mq-last` padding classes.
- `sharedSiblingMethod` (≈ L464–469) — invokes `autoUnItalicize` on sibling
  create/delete/finalize. **This is the trigger that fires on every edit.**
- `Letter.italicize(bool)` (≈ L448) — toggles `isItalic` / `isPartOfOperator`
  and the `mq-operator-name` class.
- `OperatorName` class (≈ L670–689) — its `createLeftOf` **explodes** into
  individual `Letter` nodes; its `parser` emits letters into a `MathBlock`.
  Registered for every `DEFAULT_OP_NAMES` entry (≈ L698–700).
- `autoParenthesize` (≈ L412–433) — produces auto `(` after e.g. `sin`. Reads
  two option sets: `autoParenthesizedFunctions` (L422) gated by also being in
  `autoOperatorNames` (L424, L429–433). This logic lives in `Letter`, **not** in
  `autoUnItalicize`. Because the auto-`(` already requires membership in
  `autoOperatorNames`, it moves cleanly onto the recognition path (see below) —
  fired when the `OperatorSymbol` is created. `autoParenthesizedFunctions`
  defaults to empty (`{ _maxLength: 0 }`, L333), so coupling to
  `autoOperatorNames` changes no existing behavior.
- Option fields (in `src/publicapi.ts` / `src/mathquill.d.ts`):
  `autoOperatorNames` (L619 default `DefaultOperatorNames`),
  `autoParenthesizedFunctions` (L333), `autoCommands` — all user-configurable
  via `MQ.config`. **Note:** the public option is `autoOperatorNames`; there is
  no `autoOperators` field.
- `checkAutoCmds` (≈ L367–409) — the **autocommand** path: removes the letter
  run and replaces it with a single node built from `LatexCmds[str]`. Currently
  commented out of `Letter.createLeftOf` (AL-1304) so recognition waits for a
  non-letter keypress rather than firing greedily.

Precedent for the revert behavior we want:

- `To.deleteTowards` (≈ L1172–1184) — backspacing the atomic `→` node removes
  itself and re-creates a `MinusNode` in its place. Our `deleteTowards` follows
  the same shape, but re-creates the constituent letters.

## Target design

### New node: `OperatorSymbol`

A single atomic `MQSymbol` that renders the un-italicized word and serializes
via the existing built-in/nonstandard split.

```ts
// Atomic, backspace-revertible operator name (sin, cos, hcf, ...).
class OperatorSymbol extends MQSymbol {
  name: string; // the bare word, e.g. "sin"

  constructor(name: string) {
    const isBuiltIn = BuiltInOpNames.hasOwnProperty(name);
    const latex = isBuiltIn ? '\\' + name + ' ' : '\\operatorname{' + name + '}';
    super(latex, h('span', { class: 'mq-operator-name' }, [h.text(name)]));
    this.name = name;
  }

  // backspace -> re-explode into editable italic letters ("undo autocorrect").
  // NOTE: must fix cursor[L] BEFORE inserting, like To.deleteTowards — otherwise
  // cursor[L] still points at the just-removed node and adjacency is corrupted.
  deleteTowards(dir: Direction, cursor: Cursor) {
    const leftOfMe = this[L];
    this.remove();
    cursor[L] = leftOfMe;            // detach from the removed node first
    for (var i = 0; i < this.name.length; i += 1) {
      new Letter(this.name.charAt(i)).createLeftOf(cursor);
    }
    (cursor[L] as MQNode)?.bubble((node) => (node.reflow(), undefined));
  }

  // mathspeak() and text() must be implemented too — see "Output methods" below.
}
```

- **Fully atomic** for free: as an `MQSymbol` with no blocks, the cursor steps
  over it and selects it whole.
- **Serialization** comes from the `ctrlSeq` set in the constructor, keyed off
  the existing `BuiltInOpNames` set — round-trips identically to today.
- **Revert** mirrors `To.deleteTowards` (`src/commands/math/basicSymbols.ts`
  ≈ L1172–1185), which sets `cursor[L] = l[L]` *before* creating the replacement
  node. The sketch above does the same; doing `this.remove()` then
  `createLeftOf` without resetting the cursor corrupts the sibling pointers.

### Output methods (required, not optional)

The old letter-run set `isPartOfOperator` on each letter, which several
consumers rely on. An atomic node loses that signal, so it must reproduce the
output itself:

- **`mathspeak()`** — operator speech is assembled today in
  `MathBlock.mathspeak` (`src/commands/math.ts` ≈ L543–559) by concatenating
  `isPartOfOperator` letters and looking up the speech alias from
  `autoOperatorNames` (the `name|spoken` form, e.g. `csc|cosecant`). The atomic
  node must implement `mathspeak()` that performs the same alias lookup, or
  screen readers regress (e.g. `csc` spoken as "c-s-c" instead of "cosecant").
- **`text()`** — `Variable.text` (≈ L230–254) strips the leading `\` / trailing
  space and suppresses implicit-`*` insertion when `isPartOfOperator`
  (test: `\sin\left(xy\right)` → `sin(x*y)`). Verify the node's `text()` emits
  the bare word and that neighbors don't inject `*` around it.

### Wiring changes (`src/commands/math/basicSymbols.ts`)

1. **Recognition on type (scoped to `autoOperatorNames`).**
   **Important:** `Letter.checkAutoCmds` (≈ L360–403) is **dead code** — its only
   reference is the commented-out AL-1304 line; nothing calls it. The live
   non-letter-keypress recognition gate is `MathBlock.handleAutoCommands`
   (`src/commands/math.ts` ≈ L746), which today keys off `autoCommands`. And
   note operator-name recognition currently has **no keypress gating at all** —
   it fires via `autoUnItalicize` on every sibling change. So this step is a
   genuine new mechanism: add an `autoOperatorNames`-scoped consume-and-replace
   pass (modeled on `handleAutoCommands`) that, on a delimiter keypress, removes
   the matching letter run and inserts `new OperatorSymbol(name)`. Names not in
   the option set stay plain letters.

2. **Parser — both entry points.**
   a. Point the `LatexCmds[name]` aliases (the `\sin` form) for option-set names
      at a parser yielding `new OperatorSymbol(name)`, replacing
      `OperatorName.parser`'s explode-into-letters.
   b. **Also update `LatexCmds.operatorname`** (≈ L702–729) — the `\operatorname{…}`
      form is parsed by this *separate* class, which currently returns raw
      `Letter` children and special-cases `\operatorname{ans}`. It must build an
      `OperatorSymbol` for option-set names while preserving the `ans` special
      case. Without this, `\operatorname{hcf}` would still load as letters,
      contradicting the test plan.

3. **Remove legacy behavior** — delete `autoUnItalicize` and
   `sharedSiblingMethod`, plus the now-dead `Letter` operator-decoration in
   `italicize`. This eliminates the un-italicized letter-run concept.

4. **Move auto-parenthesizing onto the recognition path, KEEPING the dual
   gate.** Fire the auto-`(` **when the `OperatorSymbol` is created**, but only
   if the name is in **both** `autoParenthesizedFunctions` **and**
   `autoOperatorNames` — exactly the condition the letter-based
   `autoParenthesize` checks today (≈ L430–433). **Do NOT retire the
   `autoParenthesizedFunctions` check:** that set defaults to empty
   (`{ _maxLength: 0 }`, L333), so nothing auto-parenthesizes by default today.
   Firing on `autoOperatorNames` membership alone would make every operator name
   (`sin`, `cos`, …) auto-paren by default — a behavior change, not a no-op.
   Keeping the dual gate is what makes this a true relocation rather than a
   policy change.

5. **Keep the op-name lists** (`BuiltInOpNames` / `BUILT_IN_OP_NAMES` /
   `NONSTANDARD_OP_NAMES`) — now consumed only by the `OperatorSymbol`
   constructor to choose `\sin ` vs `\operatorname{}`.

## Open items / risks

- **Two-word / `SupSub` spacing** logic currently lives inside the
  auto-un-italicize path; removing it drops that styling unless re-homed onto the
  new node's DOM construction.
- **Recognition timing / re-collapse after revert** — once the new recognition
  pass runs on a delimiter keypress (step 1), a backspace-revert must not be
  instantly undone. Whether this is safe depends entirely on *when* the new pass
  fires (we control that — it's new code, not the dead `checkAutoCmds`). Design
  the pass to fire only on the delimiter that triggered it, not on the backspace
  that reverts; verify with a test. (Earlier assumption that AL-1304 gating made
  this "naturally safe" was wrong — that gating applied to dead code.)
- **Subscript suppression** — `shouldIgnoreSubstitutionInSimpleSubscript`
  (`src/tree.ts` ≈ L294) currently guards `autoUnItalicize`; the same guard must
  apply on the new recognition path, called on the subscript Letter.
- **CSS / padding classes** — beyond two-word/`SupSub` spacing, the letter-run
  path applies `mq-first` / `mq-last` / `mq-followed-by-supsub` /
  `mq-after-operator-name` (≈ L496, L534–554). Re-home what's still needed onto
  the new node's DOM, or drop intentionally. `test/unit/css.test.js` references
  operator-name CSS.
- **Existing test-suite migration** — `test/unit/autoOperatorNames.test.js`
  (and `latex.test.js`, `typing.test.js`, `ans.test.js`, `autosubscript.test.js`,
  `css.test.js`) encode the letter-run model: per-letter cursor stepping, italic
  toggling, and one test that monkey-patches `Letter.prototype.autoUnItalicize`
  to count calls. These need substantial rewrites for the atomic model — budget
  for it; it is not optional.
- **Substring policy (make explicit)** — the AKIT build already matches only the
  whole contiguous letter run, not substrings (≈ L503–511, "Do not search
  commands in substrings"). The atomic model is inherently whole-run (a single
  node can't consume a substring), so it is *consistent* with this rule — but
  state it explicitly, and note some upstream tests still assert substring
  matching (e.g. `arcsintrololol` → `arc\sin tro\operatorname{lol}ol`) and will
  need updating/removal.
- **Selection / cut-copy-paste** of the atomic node — verify LaTeX, `text()`,
  and `mathspeak()` output for a selected `OperatorSymbol`.

## Proof-of-concept scope

Wire **`sin`** end-to-end first:
1. type-recognition → atomic node,
2. parse `\sin` → atomic node,
3. backspace → re-expands to `s` `i` `n` letters.

Leave the remaining names on the old path until the behavior is validated, then
convert the full `DEFAULT_OP_NAMES` list and remove the legacy code.

## Test plan

- Type `sin` + delimiter → atomic `sin` node. With `sin` configured in
  `autoParenthesizedFunctions`, typing `sin` also yields auto `(`; with the
  default (empty `autoParenthesizedFunctions`), it does not.
- Mathspeak of the atomic node uses the `autoOperatorNames` alias
  (e.g. `csc` → "cosecant"), not letter-by-letter.
- Backspace on atomic `sin` → three editable italic letters `s` `i` `n`;
  further typing does not immediately re-collapse them.
- Load `\sin x` → atomic `sin` node; serialize back → `\sin x` unchanged.
- Load `\operatorname{hcf}` → atomic `hcf` node; serialize → `\operatorname{hcf}`.
- Arrow keys step over the whole word; selection selects it whole.
- Subscript context with `disableAutoSubstitutionInSubscripts` → no recognition.
