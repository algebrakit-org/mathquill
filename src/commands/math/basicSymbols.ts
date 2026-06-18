/*********************************
 * Symbols for Basic Mathematics
 ********************************/
class DigitGroupingChar extends MQSymbol {
  finalizeTree(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }
  siblingDeleted(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }
  siblingCreated(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }

  sharedSiblingMethod(opts: CursorOptions, dir: Direction) {
    // don't try to fix digit grouping if the sibling to my right changed (dir === R or
    // undefined) and it's now a DigitGroupingChar, it will try to fix grouping
    if (dir !== L && this[R] instanceof DigitGroupingChar) return;
    this.fixDigitGrouping(opts);
  }

  fixDigitGrouping(opts: CursorOptions) {
    if (!opts.enableDigitGrouping) return;

    var left: NodeRef = this;
    var right: NodeRef = this;

    var spacesFound = 0;
    var dots = [];

    var SPACE = '\\ ';
    var DOT = '.';

    // traverse left as far as possible (starting at this char)
    var node: NodeRef = left;
    do {
      if (/^[0-9]$/.test(node.ctrlSeq!)) {
        left = node;
      } else if (node.ctrlSeq === SPACE) {
        left = node;
        spacesFound += 1;
      } else if (node.ctrlSeq === DOT) {
        left = node;
        dots.push(node);
      } else {
        break;
      }
    } while ((node = left[L]));

    // traverse right as far as possible (starting to right of this char)
    while ((node = right[R])) {
      if (/^[0-9]$/.test(node.ctrlSeq!)) {
        right = node;
      } else if (node.ctrlSeq === SPACE) {
        right = node;
        spacesFound += 1;
      } else if (node.ctrlSeq === DOT) {
        right = node;
        dots.push(node);
      } else {
        break;
      }
    }

    // trim the leading spaces
    while (right !== left && left && left.ctrlSeq === SPACE) {
      left = left[R];
      spacesFound -= 1;
    }

    // trim the trailing spaces
    while (right !== left && right && right.ctrlSeq === SPACE) {
      right = right[L];
      spacesFound -= 1;
    }

    // happens when you only have a space
    if (left === right && left && left.ctrlSeq === SPACE) return;

    var disableFormatting = spacesFound > 0 || dots.length > 1;
    if (disableFormatting) {
      this.removeGroupingBetween(left, right);
    } else if (dots[0]) {
      if (dots[0] !== left) {
        this.addGroupingBetween(dots[0][L], left);
      }
      if (dots[0] !== right) {
        // we do not show grouping to the right of a decimal place #yet
        this.removeGroupingBetween(dots[0][R], right);
      }
    } else {
      this.addGroupingBetween(right, left);
    }
  }

  removeGroupingBetween(left: NodeRef, right: NodeRef) {
    var node = left;
    do {
      if (node instanceof DigitGroupingChar) {
        node.setGroupingClass(undefined);
      }
      if (!node || node === right) break;
    } while ((node = node[R]));
  }

  addGroupingBetween(start: NodeRef, end: NodeRef) {
    var node = start;
    var count = 0;

    var totalDigits = 0;
    var node = start;
    while (node) {
      totalDigits += 1;

      if (node === end) break;
      node = node[L];
    }

    var numDigitsInFirstGroup = totalDigits % 3;
    if (numDigitsInFirstGroup === 0) numDigitsInFirstGroup = 3;

    var node = start;
    while (node) {
      count += 1;

      var cls = undefined;

      // only do grouping if we have at least 4 numbers
      if (totalDigits >= 4) {
        if (count === totalDigits) {
          cls = 'mq-group-leading-' + numDigitsInFirstGroup;
        } else if (count % 3 === 0) {
          if (count !== totalDigits) {
            cls = 'mq-group-start';
          }
        }

        if (!cls) {
          cls = 'mq-group-other';
        }
      }

      if (node instanceof DigitGroupingChar) {
        node.setGroupingClass(cls);
      }

      if (node === end) break;
      node = node[L] as DigitGroupingChar;
    }
  }

  _groupingClass?: string;
  setGroupingClass(cls: string | undefined) {
    // nothing changed (either class is the same or it's still undefined)
    if (this._groupingClass === cls) return;

    // remove existing class
    if (this._groupingClass) this.domFrag().removeClass(this._groupingClass);

    // add new class
    if (cls) this.domFrag().addClass(cls);

    // cache the groupingClass
    this._groupingClass = cls;
  }
}

class Digit extends DigitGroupingChar {
  constructor(ch: string, mathspeak?: string) {
    super(
      ch,
      h('span', { class: 'mq-digit' }, [h.text(ch)]),
      undefined,
      mathspeak
    );
  }

  createLeftOf(cursor: Cursor) {
    const cursorL = cursor[L];
    const cursorLL = cursorL && cursorL[L];
    const cursorParentParentSub =
      cursor.parent.parent instanceof SupSub
        ? cursor.parent.parent.sub
        : undefined;

    if (
      cursor.options.autoSubscriptNumerals &&
      cursor.parent !== cursorParentParentSub &&
      ((cursorL instanceof Variable && cursorL.isItalic !== false) ||
        (cursorL instanceof SupSub &&
          cursorLL instanceof Variable &&
          cursorLL.isItalic !== false))
    ) {
      new SubscriptCommand().createLeftOf(cursor);
      super.createLeftOf(cursor);
      cursor.insRightOf(cursor.parent.parent);
    } else super.createLeftOf(cursor);
  }
  mathspeak(opts: MathspeakOptions) {
    if (opts && opts.createdLeftOf) {
      var cursor = opts.createdLeftOf;
      var cursorL = cursor[L];
      var cursorLL = cursorL && cursorL[L];
      const cursorParentParentSub =
        cursor.parent.parent instanceof SupSub
          ? cursor.parent.parent.sub
          : undefined;

      if (
        cursor.options.autoSubscriptNumerals &&
        cursor.parent !== cursorParentParentSub &&
        ((cursorL instanceof Variable && cursorL.isItalic !== false) ||
          (cursor[L] instanceof SupSub &&
            cursorLL instanceof Variable &&
            cursorLL.isItalic !== false))
      ) {
        return 'Subscript ' + super.mathspeak() + ' Baseline';
      }
    }
    return super.mathspeak();
  }
}

class Variable extends MQSymbol {
  isItalic?: boolean;

  constructor(chOrCtrlSeq: string, html?: ChildNode) {
    super(chOrCtrlSeq, h('var', {}, [html || h.text(chOrCtrlSeq)]));
  }
  text() {
    var text = this.ctrlSeq || '';
    if (this.isPartOfOperator) {
      if (text[0] == '\\') {
        text = text.slice(1, text.length);
      } else if (text[text.length - 1] == ' ') {
        text = text.slice(0, -1);
      }
    } else {
      if (
        this[L] &&
        !(this[L] instanceof Variable) &&
        !(this[L] instanceof BinaryOperator) &&
        (this[L] as MQNode).ctrlSeq !== '\\ '
      )
        text = '*' + text;
      if (
        this[R] &&
        !(this[R] instanceof BinaryOperator) &&
        !(this[R] instanceof SupSub)
      )
        text += '*';
    }
    return text;
  }
  mathspeak() {
    var text = this.ctrlSeq || '';
    if (
      this.isPartOfOperator ||
      text.length > 1 ||
      (this.parent && this.parent.parent && this.parent.parent.isTextBlock())
    ) {
      return super.mathspeak();
    } else {
      // Apple voices in VoiceOver (such as Alex, Bruce, and Victoria) do
      // some strange pronunciation given certain expressions,
      // e.g. "y-2" is spoken as "ee minus 2" (as if the y is short).
      // Not an ideal solution, but surrounding non-numeric text blocks with quotation marks works.
      // This bug has been acknowledged by Apple.
      return '"' + text + '"';
    }
  }
}
function bindVariable(
  ch: string,
  htmlEntity: string,
  _unusedMathspeak?: string
) {
  return () => new Variable(ch, h.entityText(htmlEntity));
}

Options.prototype.autoCommands = {
  _maxLength: 0,
};
baseOptionProcessors.autoCommands = function (
  cmds: string | { [key: string]: string | 1 } | undefined
) {
  var _cmds: { [key: string]: string | 1 };

  if (cmds === undefined) _cmds = {};
  //mslob: this can be removed when old autocommands are removed from akit's code
  else if (typeof cmds === 'string') {
    if (!/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
      throw '"' + cmds + '" not a space-delimited list of only letters';
    }

    _cmds = {};
    cmds.split(' ').forEach((_cmd) => {
      _cmds[_cmd] = 1;
    });
  } else {
    _cmds = cmds;
  }

  // Build autodict
  var list = Object.keys(_cmds);
  var dict: AutoDict = {};
  var maxLength = 0;

  for (var i = 0; i < list.length; i += 1) {
    var cmd = list[i];
    if (cmd.length < 2) {
      throw 'autocommand "' + cmd + '" not minimum length of 2';
    }

    dict[cmd] = _cmds[cmd];
    maxLength = Math.max(maxLength, cmd.length);
  }
  dict._maxLength = maxLength;
  return dict;
};

Options.prototype.quietEmptyDelimiters = {};
baseOptionProcessors.quietEmptyDelimiters = function (dlms: string = '') {
  var list = dlms.split(' ');
  var dict: { [id: string]: any } = {};
  for (var i = 0; i < list.length; i += 1) {
    var dlm = list[i];
    dict[dlm] = 1;
  }
  return dict;
};

Options.prototype.autoParenthesizedFunctions = { _maxLength: 0 };
baseOptionProcessors.autoParenthesizedFunctions = function (cmds) {
  if (typeof cmds !== 'string' || !/^[a-z]+(?: [a-z]+)*$/i.test(cmds)) {
    throw '"' + cmds + '" not a space-delimited list of only letters';
  }
  var list = cmds.split(' ');
  var dict: AutoDict = {};
  var maxLength = 0;
  for (var i = 0; i < list.length; i += 1) {
    var cmd = list[i];
    if (cmd.length < 2) {
      throw 'autocommand "' + cmd + '" not minimum length of 2';
    }
    dict[cmd] = 1;
    maxLength = Math.max(maxLength, cmd.length);
  }
  dict._maxLength = maxLength;
  return dict;
};

class Letter extends Variable {
  letter: string;

  constructor(ch: string) {
    super(ch);
    this.letter = ch;
  }
  autoParenthesize(cursor: Cursor) {
    //exit early if already parenthesized
    var right = cursor.parent.getEnd(R);
    if (right && right instanceof Bracket && right.ctrlSeq === '\\left(') {
      return;
    }

    //exit early if in simple subscript and disableAutoSubstitutionInSubscripts is set.
    if (this.shouldIgnoreSubstitutionInSimpleSubscript(cursor.options)) {
      return;
    }

    //handle autoParenthesized functions
    var str = '';
    var l: NodeRef = this;
    var i = 0;

    var autoParenthesizedFunctions = cursor.options.autoParenthesizedFunctions;
    var maxLength = autoParenthesizedFunctions._maxLength || 0;
    var autoOperatorNames = cursor.options.autoOperatorNames;
    while (l instanceof Letter && i < maxLength) {
      (str = l.letter + str), (l = l[L]), (i += 1);
    }
    // check for an autoParenthesized functions, going thru substrings longest to shortest
    // only allow autoParenthesized functions that are also autoOperatorNames
    while (str.length) {
      if (
        autoParenthesizedFunctions.hasOwnProperty(str) &&
        autoOperatorNames.hasOwnProperty(str)
      ) {
        return cursor.parent.write(cursor, '(');
      }
      str = str.slice(1);
    }
  }

  createLeftOf(cursor: Cursor) {
    super.createLeftOf(cursor);

    // AL-1304: don't greedily convert auto commands / operator names while
    // typing letters; conversion happens on the next non-letter keystroke (see
    // MathBlock.handleAutoCommands). We still auto-parenthesize here, which can
    // itself emit the '(' that triggers conversion.
    this.autoParenthesize(cursor);
  }
  italicize(bool: boolean) {
    this.isItalic = bool;
    this.isPartOfOperator = !bool;
    this.domFrag().toggleClass('mq-operator-name', !bool);
    return this;
  }
}
// The default operator names, written out explicitly so that every macro that
// MathQuill recognizes is visible in source and registered as a `\name` command
// (see the LatexCmds registration below) rather than being inferred from a
// generative loop.
//
// BUILT_IN_OP_NAMES are real LaTeX operators (Section 3.17 of the Short Math
// Guide: http://tinyurl.com/jm9okjc); they serialize as `\sin` etc.
//
// NONSTANDARD_OP_NAMES are not real LaTeX commands; they are auto-unitalicized
// and serialize as `\operatorname{hcf}`, `\operatorname{arsinh}`, etc. Most of
// the trig entries are the systematic arc-/-h/ar--h/arc--h variants of
// 'sin cos tan sec cosec csc cotan cot ctg'; 'gcf hcf lcm proj span' are kept
// for compat with nonstandard LaTeX exported by MathQuill before #247. Note:
// over/under line/arrow \lim variants like \varlimsup are not supported.
//
// prettier-ignore
const BUILT_IN_OP_NAMES = [
  'Pr', 'arccos', 'arcsin', 'arctan', 'arg', 'cos', 'cosh', 'cot', 'coth',
  'csc', 'deg', 'det', 'dim', 'exp', 'gcd', 'hom', 'inf', 'injlim', 'ker',
  'lg', 'lim', 'liminf', 'limsup', 'ln', 'log', 'max', 'min', 'projlim',
  'sec', 'sin', 'sinh', 'sup', 'tan', 'tanh',
];
// prettier-ignore
const NONSTANDARD_OP_NAMES = [
  'arccosec', 'arccosech', 'arccosh', 'arccot', 'arccotan', 'arccotanh',
  'arccoth', 'arccsc', 'arccsch', 'arcctg', 'arcctgh', 'arcosech', 'arcosh',
  'arcotanh', 'arcoth', 'arcsch', 'arcsec', 'arcsech', 'arcsinh', 'arctanh',
  'arctgh', 'arsech', 'arsinh', 'artanh', 'cosec', 'cosech', 'cotan', 'cotanh',
  'csch', 'ctg', 'ctgh', 'gcf', 'hcf', 'lcm', 'proj', 'sech', 'span',
];
// The full set of operator names (built-in + nonstandard), the source of truth
// for both autoOperatorNames and the LatexCmds command registration.
const DEFAULT_OP_NAMES = BUILT_IN_OP_NAMES.concat(NONSTANDARD_OP_NAMES);

var BuiltInOpNames: AutoDict = {}; // the set of operator names like \sin, \cos
// that are built into LaTeX; used to decide `\sin` vs `\operatorname{...}` on
// serialization.
for (var i = 0; i < BUILT_IN_OP_NAMES.length; i += 1) {
  BuiltInOpNames[BUILT_IN_OP_NAMES[i]] = 1;
}

// the set of operator names that MathQuill auto-unitalicizes by default; overridable
var DefaultOperatorNames = defaultAutoOpNames();
Options.prototype.autoOperatorNames = DefaultOperatorNames;

function defaultAutoOpNames() {
  const AutoOpNames: AutoDict = { _maxLength: 0 };
  var maxLength = 0;
  for (var i = 0; i < DEFAULT_OP_NAMES.length; i += 1) {
    var name = DEFAULT_OP_NAMES[i];
    AutoOpNames[name] = 1;
    maxLength = Math.max(maxLength, name.length);
  }
  AutoOpNames._maxLength = maxLength;
  return AutoOpNames;
}

baseOptionProcessors.autoOperatorNames = function (cmds) {
  if (typeof cmds !== 'string') {
    throw '"' + cmds + '" not a space-delimited list';
  }
  if (!/^[a-z\|\-]+(?: [a-z\|\-]+)*$/i.test(cmds)) {
    throw '"' + cmds + '" not a space-delimited list of letters or "|"';
  }
  var list = cmds.split(' ');
  var dict: AutoDict = {};
  var maxLength = 0;
  for (var i = 0; i < list.length; i += 1) {
    var cmd = list[i];
    if (cmd.length < 2) {
      throw '"' + cmd + '" not minimum length of 2';
    }
    if (cmd.indexOf('|') < 0) {
      // normal auto operator
      dict[cmd] = cmd;
      maxLength = Math.max(maxLength, cmd.length);
    } else {
      // this item has a speech-friendly alternative
      var cmdArray = cmd.split('|');
      if (cmdArray.length > 2) {
        throw '"' + cmd + '" has more than 1 mathspeak delimiter';
      }
      if (cmdArray[0].length < 2) {
        throw '"' + cmd[0] + '" not minimum length of 2';
      }
      dict[cmdArray[0]] = cmdArray[1].replace(/-/g, ' '); // convert dashes to spaces for the sake of speech
      maxLength = Math.max(maxLength, cmdArray[0].length);
    }
  }
  dict._maxLength = maxLength;
  return dict;
};
// A monolithic, atomic operator name (\sin, \cos, \operatorname{gcf}, ...).
// Unlike the historical implementation, this is a single non-decomposable
// symbol (like \pi): it renders as one element, deletes in a single backspace,
// and is never broken back into individual editable letters. Built-in LaTeX
// operators serialize as `\sin`; nonstandard ones as `\operatorname{name}`.
class OperatorName extends MQSymbol {
  // The bare operator word (e.g. 'sin'), used for text/mathspeak and to let
  // MathBlock.mathspeak() apply the autoOperatorNames speech-friendly alias.
  operatorName: string;

  constructor(fn?: string) {
    const word = fn || '';
    const isBuiltIn = BuiltInOpNames.hasOwnProperty(word);
    // LaTeX control sequence: real ops round-trip as `\sin `, nonstandard ones
    // as `\operatorname{gcf}`.
    const ctrlSeq = isBuiltIn
      ? '\\' + word + ' '
      : '\\operatorname{' + word + '}';
    super(
      ctrlSeq,
      h('span', { class: 'mq-operator-name' }, [h.text(word)]),
      word,
      word
    );
    this.operatorName = word;
  }

  // Reproduce the operator-name spacing the old per-letter renderer achieved
  // with mq-first/mq-last: a 0.2em gap from adjacent content, but not from
  // punctuation, binary operators, summation notation, or brackets.
  private updatePadding() {
    const left = this[L];
    const right = this[R];
    this.domFrag().toggleClass('mq-first', !this.shouldOmitPadding(left));

    // A trailing sup/subscript visually attaches to the operator, so (matching
    // the old renderer) carry the right-hand gap on the supsub itself unless a
    // bracket follows it; otherwise the operator carries its own right gap.
    if (right instanceof SupSub) {
      this.domFrag().removeClass('mq-last');
      right
        .domFrag()
        .toggleClass('mq-after-operator-name', !(right[R] instanceof Bracket));
    } else {
      const omitRight =
        this.shouldOmitPadding(right) || right instanceof Bracket;
      this.domFrag().toggleClass('mq-last', !omitRight);
    }
  }
  private shouldOmitPadding(node: NodeRef) {
    if (!node) return true;
    if (node.ctrlSeq === '.') return true;
    if (node instanceof BinaryOperator) return true;
    if (node instanceof SummationNotation) return true;
    return false;
  }
  finalizeTree(_opts: CursorOptions, _dir?: Direction) {
    this.updatePadding();
  }
  siblingCreated(_opts: CursorOptions, _dir: Direction) {
    this.updatePadding();
  }
  siblingDeleted(_opts: CursorOptions, _dir: Direction) {
    this.updatePadding();
  }
}

// Explicitly register every default operator name (built-in LaTeX ops like
// \sin as well as nonstandard ones like \gcf) as a `\name` command in
// LatexCmds, iterating the explicit DEFAULT_OP_NAMES list. Each operator that
// round-trips as \operatorname{name} therefore also has a \name alias.
// Registering explicitly (rather than inferring from the user-overridable
// autoOperatorNames option) keeps the command table independent of that option
// and lets these names also be used as autoCommands.
for (var i = 0; i < DEFAULT_OP_NAMES.length; i += 1) {
  (LatexCmds as LatexCmdsAny)[DEFAULT_OP_NAMES[i]] = OperatorName;
}

// `ans` is not an autoOperatorName, but \operatorname{ans} / the \ans macro are
// supported as a plain atomic operator symbol (it used to have a bespoke
// AnsBuilder; OperatorName now covers it).
(LatexCmds as LatexCmdsAny).ans = OperatorName;

LatexCmds.operatorname = class extends MathCommand {
  createLeftOf() {}
  numBlocks() {
    return 1 as const;
  }
  parser() {
    return latexMathParser.block.map(function (b) {
      var isAllLetters = true;
      var str = '';
      var children = b.children();
      children.each(function (child) {
        if (child instanceof Letter) {
          str += child.letter;
        } else {
          isAllLetters = false;
        }
        return undefined;
      });
      // A \operatorname{...} of plain letters becomes a single atomic operator
      // symbol, identical to typing the letters or using the \name macro. This
      // also covers \operatorname{ans}.
      if (isAllLetters && str.length > 0) {
        return new OperatorName(str);
      }
      // Anything else (non-letter content) falls back to the parsed children.
      return children;
    });
  }
};

LatexCmds.f = class extends Letter {
  letter: string;
  constructor() {
    var letter = 'f';
    super(letter);

    this.letter = letter;
    this.domView = new DOMView(0, () =>
      h('var', { class: 'mq-f' }, [h.text('f')])
    );
  }
  italicize(bool: boolean) {
    // Why is this necesssary? Does someone replace the `f` at some
    // point?
    this.domFrag().eachElement((el) => (el.textContent = 'f'));
    this.domFrag().toggleClass('mq-f', bool);
    return super.italicize(bool);
  }
};

// VanillaSymbol's
LatexCmds[' '] = LatexCmds.space = class extends VanillaSymbol {
  constructor() {
    super('\\ ', h('span', {}, [h.text(U_NO_BREAK_SPACE)]), ' ');
  }

  siblingDeleted() {
    // Remove self if there's a neighboring whitespace detected to avoid double spacing.
    if (
      this[L] instanceof LatexCmds.space ||
      this[R] instanceof LatexCmds.space
    )
      this.remove();
  }

  parser() {
    var optWhitespace = Parser.optWhitespace;
    var string = Parser.string;
    var self = this;

    return optWhitespace.then(string('\\ ')).many().then(Parser.succeed(self));
  }

  createLeftOf(cursor: Cursor) {
    if (
      cursor[L] instanceof LatexCmds.space ||
      cursor[R] instanceof LatexCmds.space
    )
      return;
    super.createLeftOf(cursor);
  }
};

// () =>
// new DigitGroupingChar('\\ ', h('span', {}, [h.text(U_NO_BREAK_SPACE)]), ' ');

LatexCmds['.'] = () =>
  new DigitGroupingChar(
    '.',
    h('span', { class: 'mq-digit' }, [h.text('.')]),
    '.'
  );

LatexCmds["'"] =
  LatexCmds['′'] =
  LatexCmds.prime =
    bindVanillaSymbol("'", '&prime;', 'prime');
LatexCmds['″'] = LatexCmds.dprime = bindVanillaSymbol(
  '″',
  '&Prime;',
  'double prime'
);

LatexCmds.backslash = bindVanillaSymbol('\\backslash ', '\\', 'backslash');
if (!CharCmds['\\']) CharCmds['\\'] = LatexCmds.backslash;

LatexCmds.$ = bindVanillaSymbol('\\$', '$', 'dollar');

LatexCmds.square = bindVanillaSymbol('\\square ', '\u25A1', 'square');
LatexCmds.mid = bindVanillaSymbol('\\mid ', '\u2223', 'mid');

// does not use Symbola font
class NonSymbolaSymbol extends MQSymbol {
  constructor(ch: string, html?: ChildNode, _unusedMathspeak?: string) {
    super(ch, h('span', { class: 'mq-nonSymbola' }, [html || h.text(ch)]));
  }
}

LatexCmds['@'] = () => new NonSymbolaSymbol('@');
LatexCmds['&'] = () =>
  new NonSymbolaSymbol('\\&', h.entityText('&amp;'), 'and');
LatexCmds['%'] = class extends NonSymbolaSymbol {
  constructor() {
    super('\\%', h.text('%'), 'percent');
  }
  parser() {
    var optWhitespace = Parser.optWhitespace;
    var string = Parser.string;

    // Parse `\%\operatorname{of}` as special `percentof` node so that
    // it will be serialized properly and deleted as a unit.
    return optWhitespace
      .then(
        string('\\operatorname{of}').map(function () {
          return PercentOfBuilder();
        })
      )
      .or(super.parser());
  }
};
LatexCmds['permil'] =
  LatexCmds['permille'] =
  LatexCmds['‰'] =
    () => new NonSymbolaSymbol('‰', h.entityText('&#8240;'), 'permille');
LatexCmds['#'] = bindVanillaSymbol('\\#', '#', 'hash');

LatexCmds['€'] = () =>
  new NonSymbolaSymbol('€', h.entityText('&#8364;'), 'euro');
LatexCmds['¢'] = () =>
  new NonSymbolaSymbol('¢', h.entityText('&#162;'), 'cent');

LatexCmds['∥'] = LatexCmds.parallel = bindVanillaSymbol(
  '\\parallel ',
  '&#x2225;',
  'parallel'
);

LatexCmds['∦'] = LatexCmds.nparallel = bindVanillaSymbol(
  '\\nparallel ',
  '&#x2226;',
  'not parallel'
);

LatexCmds['⟂'] = LatexCmds.perp = bindVanillaSymbol(
  '\\perp ',
  '&#x27C2;',
  'perpendicular'
);

//the following are all Greek to me, but this helped a lot: http://www.ams.org/STIX/ion/stixsig03.html

//lowercase Greek letter variables
LatexCmds.alpha = bindVanillaSymbol('\\alpha ', '&alpha;', 'alpha');
LatexCmds.beta = bindVanillaSymbol('\\beta ', '&beta;', 'beta');
LatexCmds.gamma = bindVanillaSymbol('\\gamma ', '&gamma;', 'gamma');
LatexCmds.delta = bindVanillaSymbol('\\delta ', '&delta;', 'delta');
LatexCmds.zeta = bindVanillaSymbol('\\zeta ', '&zeta;', 'zeta');
LatexCmds.eta = bindVanillaSymbol('\\eta ', '&eta;', 'eta');
LatexCmds.theta = bindVanillaSymbol('\\theta ', '&theta;', 'theta');
LatexCmds.iota = bindVanillaSymbol('\\iota ', '&iota;', 'iota');
LatexCmds.kappa = bindVanillaSymbol('\\kappa ', '&kappa;', 'kappa');
LatexCmds.mu = bindVanillaSymbol('\\mu ', '&mu;', 'mu');
LatexCmds.nu = bindVanillaSymbol('\\nu ', '&nu;', 'nu');
LatexCmds.xi = bindVanillaSymbol('\\xi ', '&xi;', 'xi');
LatexCmds.rho = bindVanillaSymbol('\\rho ', '&rho;', 'rho');
LatexCmds.sigma = bindVanillaSymbol('\\sigma ', '&sigma;', 'sigma');
LatexCmds.tau = bindVanillaSymbol('\\tau ', '&tau;', 'tau');
LatexCmds.chi = bindVanillaSymbol('\\chi ', '&chi;', 'chi');
LatexCmds.psi = bindVanillaSymbol('\\psi ', '&psi;', 'psi');
LatexCmds.omega = bindVanillaSymbol('\\omega ', '&omega;', 'omega');

//why can't anybody FUCKING agree on these
LatexCmds.phi = bindVariable('\\phi ', '&#981;', 'phi'); //W3C or Unicode?

LatexCmds.phiv = LatexCmds.varphi = bindVariable('\\varphi ', '&phi;', 'phi'); //Elsevier and 9573-13 //AMS and LaTeX

LatexCmds.epsilon = bindVariable('\\epsilon ', '&#1013;', 'epsilon'); //W3C or Unicode?

LatexCmds.epsiv = LatexCmds.varepsilon = bindVariable(
  //Elsevier and 9573-13 //AMS and LaTeX
  '\\varepsilon ',
  '&epsilon;',
  'epsilon'
);

LatexCmds.pi = LatexCmds['π'] = () =>
  new VanillaSymbol('\\pi ', h.entityText('&pi;'), 'pi');

LatexCmds.piv = LatexCmds.varpi = bindVariable('\\varpi ', '&piv;', 'piv'); //W3C/Unicode and Elsevier and 9573-13 //AMS and LaTeX

LatexCmds.sigmaf = //W3C/Unicode
  LatexCmds.sigmav = //Elsevier
  LatexCmds.varsigma = //LaTeX
    bindVariable('\\varsigma ', '&sigmaf;', 'sigma');

LatexCmds.thetav = //Elsevier and 9573-13
  LatexCmds.vartheta = //AMS and LaTeX
  LatexCmds.thetasym = //W3C/Unicode
    bindVariable('\\vartheta ', '&thetasym;', 'theta');

LatexCmds.upsilon = LatexCmds.upsi = bindVariable(
  //AMS and LaTeX and W3C/Unicode //Elsevier and 9573-13
  '\\upsilon ',
  '&upsilon;',
  'upsilon'
);

//these aren't even mentioned in the HTML character entity references
LatexCmds.gammad = //Elsevier
  LatexCmds.Gammad = //9573-13 -- WTF, right? I dunno if this was a typo in the reference (see above)
  LatexCmds.digamma = //LaTeX
    bindVariable('\\digamma ', '&#989;', 'gamma');

LatexCmds.kappav = LatexCmds.varkappa = bindVariable(
  //Elsevier //AMS and LaTeX
  '\\varkappa ',
  '&#1008;',
  'kappa'
);

LatexCmds.rhov = LatexCmds.varrho = bindVariable('\\varrho ', '&#1009;', 'rho'); //Elsevier and 9573-13 //AMS and LaTeX

//Greek constants, look best in non-italicized Times New Roman
LatexCmds.lambda = () =>
  new NonSymbolaSymbol('\\lambda ', h.entityText('&lambda;'), 'lambda');

//uppercase greek letters

LatexCmds.Upsilon = //LaTeX
  LatexCmds.Upsi = //Elsevier and 9573-13
  LatexCmds.upsih = //W3C/Unicode "upsilon with hook"
  LatexCmds.Upsih = //'cos it makes sense to me
    () =>
      new MQSymbol(
        '\\Upsilon ',
        h('var', { style: 'font-family: serif' }, [h.entityText('&upsih;')]),
        'capital upsilon'
      ); //Symbola's 'upsilon with a hook' is a capital Y without hooks :(

//other symbols with the same LaTeX command and HTML character entity reference
LatexCmds.Gamma = bindVanillaSymbol('\\Gamma ', '&Gamma;', 'Gamma');
LatexCmds.Delta = bindVanillaSymbol('\\Delta ', '&Delta;', 'Delta');
LatexCmds.Theta = bindVanillaSymbol('\\Theta ', '&Theta;', 'Theta');
LatexCmds.Lambda = bindVanillaSymbol('\\Lambda ', '&Lambda;', 'Lambda');
LatexCmds.Xi = bindVanillaSymbol('\\Xi ', '&Xi;', 'Xi');
LatexCmds.Pi = bindVanillaSymbol('\\Pi ', '&Pi;', 'Pi');
LatexCmds.Sigma = bindVanillaSymbol('\\Sigma ', '&Sigma;', 'Sigma');
LatexCmds.Phi = bindVanillaSymbol('\\Phi ', '&Phi;', 'Phi');
LatexCmds.Psi = bindVanillaSymbol('\\Psi ', '&Psi;', 'Psi');
LatexCmds.Omega = bindVanillaSymbol('\\Omega ', '&Omega;', 'Omega');
LatexCmds.forall = bindVanillaSymbol('\\forall ', '&forall;', 'forall');

// symbols that aren't a single MathCommand, but are instead a whole
// Fragment. Creates the Fragment from a LaTeX string
class LatexFragment extends MathCommand {
  latexStr: string;

  constructor(latex: string) {
    super();
    this.latexStr = latex;
  }

  createLeftOf(cursor: Cursor) {
    var block = latexMathParser.parse(this.latexStr);
    block
      .children()
      .adopt(cursor.parent, cursor[L] as MQNode, cursor[R] as MQNode);
    cursor[L] = block.getEnd(R);
    domFrag(block.html()).insertBefore(cursor.domFrag());
    block.finalizeInsert(cursor.options, cursor);
    var blockEndsR = block.getEnd(R);
    var blockEndsRR = blockEndsR && blockEndsR[R];
    if (blockEndsRR) blockEndsRR.siblingCreated(cursor.options, L);
    var blockEndsL = block.getEnd(L);
    var blockEndsLL = blockEndsL && blockEndsL[L];
    if (blockEndsLL) blockEndsLL.siblingCreated(cursor.options, R);
    cursor.parent.bubble(function (node) {
      node.reflow();
      return undefined;
    });
  }
  mathspeak() {
    return latexMathParser.parse(this.latexStr).mathspeak();
  }
  parser() {
    var frag = latexMathParser.parse(this.latexStr).children();
    return Parser.succeed(frag);
  }
}

// for what seems to me like [stupid reasons][1], Unicode provides
// subscripted and superscripted versions of all ten Arabic numerals,
// as well as [so-called "vulgar fractions"][2].
// Nobody really cares about most of them, but some of them actually
// predate Unicode, dating back to [ISO-8859-1][3], apparently also
// known as "Latin-1", which among other things [Windows-1252][4]
// largely coincides with, so Microsoft Word sometimes inserts them
// and they get copy-pasted into MathQuill.
//
// (Irrelevant but funny story: though not a superset of Latin-1 aka
// ISO-8859-1, Windows-1252 **is** a strict superset of the "closely
// related but distinct"[3] "ISO 8859-1" -- see the lack of a dash
// after "ISO"? Completely different character set, like elephants vs
// elephant seals, or "Zombies" vs "Zombie Redneck Torture Family".
// What kind of idiot would get them confused.
// People in fact got them confused so much, it was so common to
// mislabel Windows-1252 text as ISO-8859-1, that most modern web
// browsers and email clients treat the MIME charset of ISO-8859-1
// as actually Windows-1252, behavior now standard in the HTML5 spec.)
//
// [1]: http://en.wikipedia.org/wiki/Unicode_subscripts_andsuper_scripts
// [2]: http://en.wikipedia.org/wiki/Number_Forms
// [3]: http://en.wikipedia.org/wiki/ISO/IEC_8859-1
// [4]: http://en.wikipedia.org/wiki/Windows-1252
LatexCmds['⁰'] = () => new LatexFragment('^0');
LatexCmds['¹'] = () => new LatexFragment('^1');
LatexCmds['²'] = () => new LatexFragment('^2');
LatexCmds['³'] = () => new LatexFragment('^3');
LatexCmds['⁴'] = () => new LatexFragment('^4');
LatexCmds['⁵'] = () => new LatexFragment('^5');
LatexCmds['⁶'] = () => new LatexFragment('^6');
LatexCmds['⁷'] = () => new LatexFragment('^7');
LatexCmds['⁸'] = () => new LatexFragment('^8');
LatexCmds['⁹'] = () => new LatexFragment('^9');

LatexCmds['¼'] = () => new LatexFragment('\\frac14');
LatexCmds['½'] = () => new LatexFragment('\\frac12');
LatexCmds['¾'] = () => new LatexFragment('\\frac34');

// this is a hack to make pasting the √ symbol
// actually insert a sqrt command. This isn't ideal,
// but it's way better than what we have now. I think
// before we invest any more time into this single character
// we should consider how to make the pipe (|) automatically
// insert absolute value. We also will want the percent (%)
// to expand to '% of'. I've always just thought mathquill's
// ability to handle pasted latex magical until I started actually
// testing it. It's a lot more buggy that I previously thought.
//
// KNOWN ISSUES:
// 1) pasting √ does not put focus in side the sqrt symbol
// 2) pasting √2 puts the 2 outside of the sqrt symbol.
//
// The first issue seems like we could invest more time into this to
// fix it, but doesn't feel worth special casing. I think we'd want
// to address it by addressing ALL pasting issues.
//
// The second issue seems like it might go away too if you fix paste to
// act more like simply typing the characters out. I'd be scared to try
// to make that change because I'm fairly confident I'd break something
// around handling valid latex as latex rather than treating it as keystrokes.
LatexCmds['√'] = () => new LatexFragment('\\sqrt{}');

// Binary operator determination is used in several contexts for PlusMinus nodes and their descendants.
// For instance, we set the item's class name based on this factor, and also assign different mathspeak values (plus vs positive, negative vs minus).
function isBinaryOperator(node: NodeRef): boolean {
  if (!node) return false;

  const nodeL = node[L];

  if (nodeL) {
    // If the left sibling is a binary operator or a separator (comma, semicolon, colon, space)
    // or an open bracket (open parenthesis, open square bracket)
    // consider the operator to be unary
    if (
      nodeL instanceof BinaryOperator ||
      /^(\\ )|[,;:\(\[]$/.test(nodeL.ctrlSeq!)
    ) {
      return false;
    }
  } else if (
    node.parent &&
    node.parent.parent &&
    node.parent.parent.isStyleBlock()
  ) {
    //if we are in a style block at the leftmost edge, determine unary/binary based on
    //the style block
    //this allows style blocks to be transparent for unary/binary purposes
    return isBinaryOperator(node.parent.parent);
  } else {
    return false;
  }

  return true;
}

var PlusMinus = class extends BinaryOperator {
  constructor(ch?: string, html?: ChildNode, mathspeak?: string) {
    super(ch, html, undefined, mathspeak, true);
  }

  contactWeld(cursor: Cursor, dir?: Direction) {
    this.sharedSiblingMethod(cursor.options, dir);
  }
  siblingCreated(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }
  siblingDeleted(opts: CursorOptions, dir: Direction) {
    this.sharedSiblingMethod(opts, dir);
  }

  sharedSiblingMethod(_opts?: CursorOptions, dir?: Direction) {
    if (dir === R) return; // ignore if sibling only changed on the right
    this.domFrag().oneElement().className = isBinaryOperator(this)
      ? 'mq-binary-operator'
      : '';

    return this;
  }
};

LatexCmds['+'] = class extends PlusMinus {
  constructor() {
    super('+', h.text('+'));
  }
  mathspeak(): string {
    return isBinaryOperator(this) ? 'plus' : 'positive';
  }
};

//yes, these are different dashes, en-dash, em-dash, unicode minus, actual dash
class MinusNode extends PlusMinus {
  constructor() {
    super('-', h.entityText('&minus;'));
  }
  mathspeak(): string {
    return isBinaryOperator(this) ? 'minus' : 'negative';
  }
}
LatexCmds['−'] = LatexCmds['—'] = LatexCmds['–'] = LatexCmds['-'] = MinusNode;

LatexCmds['±'] =
  LatexCmds.pm =
  LatexCmds.plusmn =
  LatexCmds.plusminus =
    () => new PlusMinus('\\pm ', h.entityText('&plusmn;'), 'plus-or-minus');
LatexCmds.mp =
  LatexCmds.mnplus =
  LatexCmds.minusplus =
    () => new PlusMinus('\\mp ', h.entityText('&#8723;'), 'minus-or-plus');

CharCmds['*'] =
  CharCmds['⋅'] =
  LatexCmds.sdot =
  LatexCmds.cdot =
    bindBinaryOperator('\\cdot ', '&middot;', '*', 'times'); //semantically should be &sdot;, but &middot; looks better

class To extends BinaryOperator {
  constructor() {
    super('\\to ', h.entityText('&rarr;'), 'to');
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    if (dir === L) {
      var l = cursor[L] as MQNode;
      new Fragment(l, this).remove();
      cursor[L] = l[L];
      new MinusNode().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.deleteTowards(dir, cursor);
  }
}

LatexCmds['→'] = LatexCmds.to = To;

class Inequality extends BinaryOperator {
  strict: boolean;
  data: InequalityData;

  constructor(data: InequalityData, strict: boolean) {
    var strictness: '' | 'Strict' = strict ? 'Strict' : '';
    super(
      data[`ctrlSeq${strictness}`],
      h.entityText(data[`htmlEntity${strictness}`]),
      data[`text${strictness}`],
      data[`mathspeak${strictness}`]
    );

    this.data = data;
    this.strict = strict;
  }

  swap(strict: boolean) {
    this.strict = strict;
    var strictness: '' | 'Strict' = strict ? 'Strict' : '';
    this.ctrlSeq = this.data[`ctrlSeq${strictness}`];
    this.domFrag()
      .children()
      .replaceWith(domFrag(h.entityText(this.data[`htmlEntity${strictness}`])));
    this.textTemplate = [this.data[`text${strictness}`]];
    this.mathspeakName = this.data[`mathspeak${strictness}`];
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    if (dir === L && !this.strict) {
      this.swap(true);
      this.bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.deleteTowards(dir, cursor);
  }
}

var less: InequalityData = {
  ctrlSeq: '\\le ',
  htmlEntity: '&le;',
  text: '≤',
  mathspeak: 'less than or equal to',
  ctrlSeqStrict: '<',
  htmlEntityStrict: '&lt;',
  textStrict: '<',
  mathspeakStrict: 'less than',
};
var greater: InequalityData = {
  ctrlSeq: '\\ge ',
  htmlEntity: '&ge;',
  text: '≥',
  mathspeak: 'greater than or equal to',
  ctrlSeqStrict: '>',
  htmlEntityStrict: '&gt;',
  textStrict: '>',
  mathspeakStrict: 'greater than',
};

class Greater extends Inequality {
  constructor() {
    super(greater, true);
  }
  createLeftOf(cursor: Cursor) {
    const cursorL = cursor[L];
    if (cursorL instanceof BinaryOperator && cursorL.ctrlSeq === '-') {
      var l = cursorL;
      cursor[L] = l[L];
      l.remove();
      new To().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.createLeftOf(cursor);
  }
}

LatexCmds['<'] = LatexCmds.lt = () => new Inequality(less, true);
LatexCmds['>'] = LatexCmds.gt = Greater;
LatexCmds['≤'] =
  LatexCmds.le =
  LatexCmds.leq =
    () => new Inequality(less, false);
LatexCmds['≥'] =
  LatexCmds.ge =
  LatexCmds.geq =
    () => new Inequality(greater, false);
LatexCmds.infty =
  LatexCmds.infin =
  LatexCmds.infinity =
    bindVanillaSymbol('\\infty ', '&infin;', 'infinity');
LatexCmds['≠'] =
  LatexCmds.ne =
  LatexCmds.neq =
    bindBinaryOperator('\\ne ', '&ne;', 'not equal');

class Equality extends BinaryOperator {
  constructor() {
    super('=', h.text('='), '=', 'equals');
  }
  createLeftOf(cursor: Cursor) {
    var cursorL = cursor[L];
    if (cursorL instanceof Inequality && cursorL.strict) {
      cursorL.swap(false);
      cursorL.bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.createLeftOf(cursor);
  }
}
LatexCmds['='] = Equality;

LatexCmds['×'] =
  LatexCmds.times =
  LatexCmds.cross =
    bindBinaryOperator('\\times ', '&times;', '[x]', 'times');

LatexCmds['÷'] =
  LatexCmds.div =
  LatexCmds.divide =
  LatexCmds.divides =
    bindBinaryOperator('\\div ', '&divide;', '[/]', 'over');

class Sim extends BinaryOperator {
  constructor() {
    super('\\sim ', h.text('~'), '~', 'tilde');
  }
  createLeftOf(cursor: Cursor) {
    if (cursor[L] instanceof Sim) {
      var l = cursor[L] as MQNode;
      cursor[L] = l[L];
      l.remove();
      new Approx().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.createLeftOf(cursor);
  }
}

class Approx extends BinaryOperator {
  constructor() {
    super('\\approx ', h.entityText('&approx;'), '≈', 'approximately equal');
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    if (dir === L) {
      var l = cursor[L] as MQNode;
      new Fragment(l, this).remove();
      cursor[L] = l[L];
      new Sim().createLeftOf(cursor);
      (cursor[L] as MQNode).bubble(function (node) {
        node.reflow();
        return undefined;
      });
      return;
    }
    super.deleteTowards(dir, cursor);
  }
}

LatexCmds.tildeNbsp = bindVanillaSymbol('~', U_NO_BREAK_SPACE, ' ');
LatexCmds.sim = Sim;
LatexCmds['≈'] = LatexCmds.approx = Approx;

// When interpreting raw LaTeX, we can either evaluate the tilde as its standard nonbreaking space
// or transform it to the \sim operator depending on whether the "interpretTildeAsSim" configuration option is set.
// Tilde symbols input from a keyboard will always be transformed to \sim.
CharCmds['~'] = LatexCmds.sim;
LatexCmds['~'] = LatexCmds.tildeNbsp;
baseOptionProcessors.interpretTildeAsSim = function (val: boolean | undefined) {
  const interpretAsSim = !!val;
  if (interpretAsSim) {
    LatexCmds['~'] = LatexCmds.sim;
  } else {
    LatexCmds['~'] = LatexCmds.tildeNbsp;
  }
  return interpretAsSim;
};

// #6401 make ':' a BinaryOperator to correctly render spacing. Note that this
// way of rendering should get overruled by the 'typingColonWritesDivisionSymbol'
// option, applied in MathBlock _chToCmd function.
LatexCmds[':'] = bindBinaryOperator(':', ':', ':');
