/**
 * AlgebraKiT
 */

class BlockSymbol extends MQSymbol {
  constructor(ctrlSeq: string, symbolText: string) {
    super(
      ctrlSeq,
      h('span', { class: 'mq-text-mode mq-text-icon' }, [h.text(symbolText)]),
      symbolText,
      symbolText
    );
  }
}

// Dutch notation for logarithm: notation like: {}^3 log{9}.
// we will use nonstandard latex-like notation: lognl[3]{9}
class LogNL extends MathCommand {
  ctrlSeq = '\\lognl';
  domView = new DOMView(2, (blocks) =>
    h('span', { class: 'mq-non-leaf' }, [
      h('span', { class: 'mq-supsub mq-non-leaf mq-sup-only' }, [
        h.block('span', { class: 'mq-sup' }, blocks[0]),
      ]),
      h('span', { class: 'mq-operator-name' }, [h.text('log')]),
      h('span', { class: 'mq-non-leaf' }, [
        h('span', { class: 'mq-scaled mq-paren' }, [h.text('(')]),
        h.block('span', { class: 'mq-non-leaf' }, blocks[1]),
        h('span', { class: 'mq-scaled mq-paren' }, [h.text(')')]),
      ]),
    ])
  );
  textTemplate = ['lognl[', '](', ')'];

  parser() {
    return latexMathParser.optBlock
      .then(function (optBlock) {
        return latexMathParser.block.map(function (block) {
          const lognl = new LogNL();
          lognl.blocks = [optBlock, block];
          optBlock.adopt(lognl, 0, 0);
          block.adopt(lognl, optBlock, 0);
          return lognl;
        });
      })
      .or(super.parser());
  }

  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    const childLatex = this.akitLatexChildren();

    if (MathQuill.latexSyntax === 'STANDARD') {
      ctx.latex += '\\ ^{';
      ctx.latex += childLatex[0];
      ctx.latex += '}\\!\\log\\left(';
      ctx.latex += childLatex[1];
      ctx.latex += '\\right)';
    } else {
      ctx.latex += '\\lognl[';
      ctx.latex += childLatex[0];
      ctx.latex += ']{';
      ctx.latex += childLatex[1];
      ctx.latex += '}';
    }

    this.checkCursorContextClose(ctx);
  }
}
LatexCmds.lognl = LogNL;

// TODO extend from Bracket implementation or migrate some functionality to here
// (either copy or inherit from DelimNode)
class IntervalCommand extends MathCommand {
  public intervalOpen: string;
  public intervalClose: string;
  public intervalDelim: string;

  constructor(ctrlSeq: string, open: string, close: string, delim: string) {
    super();

    this.intervalOpen = open;
    this.intervalClose = close;
    this.intervalDelim = delim;

    const htmlEntityRegex = /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/;
    const openH = open.match(htmlEntityRegex)
      ? h.entityText(open)
      : h.text(open);
    const closeH = close.match(htmlEntityRegex)
      ? h.entityText(close)
      : h.text(close);

    const domView = new DOMView(2, (blocks) =>
      h('span', { class: 'mq-non-leaf' }, [
        h('span', { class: 'mq-scaled mq-paren' }, [openH]),
        h.block('span', { class: 'mq-non-leaf' }, blocks[0]),
        h('span', { class: 'mq-delim' }, [h.text(delim)]),
        h.block('span', { class: 'mq-non-leaf' }, blocks[1]),
        h('span', { class: 'mq-scaled mq-paren' }, [closeH]),
      ])
    );

    MQSymbol.prototype.setCtrlSeqHtmlTextAndMathspeak.call(
      this,
      ctrlSeq,
      domView
    );
  }

  latexRecursive(ctx: LatexContext) {
    if (MathQuill.latexSyntax === 'STANDARD') {
      this.checkCursorContextOpen(ctx);

      let leftBracket = this.intervalOpen;
      let rightBracket = this.intervalClose;

      if (leftBracket === '&lang;') leftBracket = '\\langle';
      if (rightBracket === '&rang;') rightBracket = '\\rangle';

      ctx.latex += '\\left' + leftBracket + '{';

      const childLatexList: string[] = [];
      this.eachChild((child) => {
        let childCtx: LatexContext = {
          latex: '',
          startIndex: -1,
          endIndex: -1,
        };

        let beforeLength = childCtx.latex.length;
        child.latexRecursive(childCtx);
        let afterLength = childCtx.latex.length;
        if (beforeLength === afterLength) {
          // nothing was written so we write a space
          childCtx.latex += ' ';
        }

        childLatexList.push(childCtx.latex);
      });

      ctx.latex += childLatexList.join(',');
      ctx.latex += '}\\right' + rightBracket;

      this.checkCursorContextClose(ctx);
    } else {
      super.latexRecursive(ctx);
    }
  }
}

function bindIntervalCommand(
  ctrlSeq: string,
  open: string,
  close: string,
  delim: string
) {
  return () => new IntervalCommand(ctrlSeq, open, close, delim);
}

// Dutch notations for intervals
LatexCmds.IntervalNlExEx = bindIntervalCommand(
  '\\IntervalNlExEx',
  '\\left&lang;',
  '\\right&rang;',
  ';'
);
LatexCmds.IntervalNlExIn = bindIntervalCommand(
  '\\IntervalNlExIn',
  '\\left&lang;',
  '\\right]',
  ';'
);
LatexCmds.IntervalNlInEx = bindIntervalCommand(
  '\\IntervalNlInEx',
  '\\left[',
  '\\right&rang;',
  ';'
);
LatexCmds.IntervalNlInIn = bindIntervalCommand(
  '\\IntervalNlInIn',
  '\\left[',
  '\\right]',
  ';'
);

// Belgium notations for intervals
LatexCmds.IntervalBeExEx = bindIntervalCommand(
  '\\IntervalBeExEx',
  ']',
  '[',
  ';'
);
LatexCmds.IntervalBeExIn = bindIntervalCommand(
  '\\IntervalBeExIn',
  ']',
  ']',
  ';'
);
LatexCmds.IntervalBeInEx = bindIntervalCommand(
  '\\IntervalBeInEx',
  '[',
  '[',
  ';'
);
LatexCmds.IntervalBeInIn = bindIntervalCommand(
  '\\IntervalBeInIn',
  '[',
  ']',
  ';'
);
// English notations for intervals
LatexCmds.IntervalEnExEx = bindIntervalCommand(
  '\\IntervalEnExEx',
  '\\left(',
  '\\right)',
  ','
);
LatexCmds.IntervalEnExIn = bindIntervalCommand(
  '\\IntervalEnExIn',
  '\\left(',
  '\\right]',
  ','
);
LatexCmds.IntervalEnInEx = bindIntervalCommand(
  '\\IntervalEnInEx',
  '\\left[',
  '\\right)',
  ','
);
LatexCmds.IntervalEnInIn = bindIntervalCommand(
  '\\IntervalEnInIn',
  '\\left[',
  '\\right]',
  ','
);

LatexCmds.PolarVector = LatexCmds.PolarVectorEn = class extends (
  IntervalCommand
) {
  constructor() {
    super('\\PolarVectorEn', '(', ')', ',');
  }
  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    const latexChildren = this.akitLatexChildren();
    ctx.latex += '\\left(';
    ctx.latex += latexChildren[0];
    ctx.latex += ',';
    ctx.latex += latexChildren[1];
    ctx.latex += '\\right)';

    this.checkCursorContextClose(ctx);
  }
};

LatexCmds.PolarVectorNl = class extends IntervalCommand {
  constructor() {
    super('\\PolarVectorNl', '(', ')', ';');
  }
  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    const latexChildren = this.akitLatexChildren();
    ctx.latex +=
      '\\left(' + latexChildren[0] + ';' + latexChildren[1] + '\\right)';

    this.checkCursorContextClose(ctx);
  }
};

LatexCmds.diff = class extends VanillaSymbol {
  constructor() {
    super('\\diff ', h.text('d'));
  }

  latexRecursive(ctx: LatexContext) {
    if (MathQuill.latexSyntax === 'STANDARD') {
      this.checkCursorContextOpen(ctx);
      ctx.latex += '\\text{d}';
      this.checkCursorContextClose(ctx);
    } else {
      super.latexRecursive(ctx);
    }
  }
};

// Custom commands for language-specific solution tags
class AkitTextBlock extends BlockSymbol {
  constructor(ctrlSeq: string, symbolText: string) {
    super(ctrlSeq, symbolText);
  }
  latexRecursive(ctx: LatexContext) {
    if (MathQuill.latexSyntax === 'STANDARD') {
      this.checkCursorContextOpen(ctx);

      ctx.latex += '\\text{' + this.textTemplate[0] + '}';

      this.checkCursorContextClose(ctx);
    } else {
      super.latexRecursive(ctx);
    }
  }
}
function bindAkitTextBlock(ctrlSeq: string, symbolText: string) {
  return () => new AkitTextBlock(ctrlSeq, symbolText);
}

LatexCmds.NoSolutionNl = bindAkitTextBlock('\\NoSolutionNl', 'kan niet');
LatexCmds.NoSolutionEn = bindAkitTextBlock('\\NoSolutionEn', 'no solution');
LatexCmds.NoSolutionFr = bindAkitTextBlock('\\NoSolutionFr', 'aucun solution');
LatexCmds.NoSolutionDe = bindAkitTextBlock('\\NoSolutionDe', 'kann nicht');
LatexCmds.NoSolutionLt = bindAkitTextBlock('\\NoSolutionLt', 'sprendinių nėra');

LatexCmds.TrueSolutionNl = bindAkitTextBlock('\\TrueSolutionNl', 'waar');
LatexCmds.TrueSolutionEn = bindAkitTextBlock('\\TrueSolutionEn', 'true');
LatexCmds.TrueSolutionFr = bindAkitTextBlock('\\TrueSolutionFr', 'vrai');
LatexCmds.TrueSolutionDe = bindAkitTextBlock('\\TrueSolutionDe', 'wahr');
LatexCmds.TrueSolutionLt = bindAkitTextBlock('\\TrueSolutionLt', 'teisingai');

class Underset extends MathCommand {
  ctrlSeq = '\\underset';
  domView = new DOMView(2, (blocks) =>
    h('span', { class: 'mq-non-leaf' }, [
      h('span', { class: 'mq-array mq-non-leaf' }, [
        h.block('span', undefined, blocks[1]),
        h.block('span', undefined, blocks[0]),
      ]),
    ])
  );
  textTemplate = ['underset(', ',', ')'];

  finalizeTree() {
    this.upInto = this.getEnd(L).upOutOf = this.getEnd(R);
    this.downInto = this.getEnd(R).downOutOf = this.getEnd(L);
  }
}
LatexCmds.underset = Underset;

class Overset extends MathCommand {
  ctrlSeq = '\\overset';
  domView = new DOMView(2, (blocks) =>
    h('span', { class: 'mq-non-leaf' }, [
      h('span', { class: 'mq-array mq-non-leaf' }, [
        h.block('span', undefined, blocks[0]),
        h.block('span', undefined, blocks[1]),
      ]),
    ])
  );
  textTemplate = ['oversett(', ',', ')'];

  finalizeTree() {
    this.upInto = this.getEnd(R).upOutOf = this.getEnd(L);
    this.downInto = this.getEnd(L).downOutOf = this.getEnd(R);
  }
}
LatexCmds.overset = Overset;

LatexCmds.not = class extends VanillaSymbol {
  // If one of these appears immediately after not, the
  // parser returns a different symbol.
  suffixes: { [key: string]: string } = {
    '\\in': 'notin',
    '\\ni': 'notni',
    '\\subset': 'notsubset',
    '\\subseteq': 'notsubseteq',
    '\\supset': 'notsupset',
    '\\supseteq': 'notsupseteq',
    '\\perp': 'nperp',
    '\\Rightarrow': 'nrArr',
    '\\rightarrow': 'nrarr',
    '\\Leftarrow': 'nlArr',
    '\\leftarrow': 'nlarr',
  };

  constructor() {
    super('\\neg', h.entityText('&not;'));
  }

  parser() {
    const suffixes = Object.keys(this.suffixes).sort(function (a, b) {
      return b.length - a.length;
    });

    function anyOf(strings: string[]): Parser<string> {
      pray('at least one string in strings', strings.length > 0);
      const stringParser = Parser.string(strings.shift() as string);
      return strings.length > 0
        ? stringParser.or(anyOf(strings))
        : stringParser;
    }

    return anyOf(suffixes)
      .then((suffixKey) => {
        return Parser.optWhitespace.then(() => {
          const ctrlSeq = this.suffixes[suffixKey];
          var cmdKlass = (LatexCmds as LatexCmdsSingleChar)[ctrlSeq];

          if (cmdKlass) {
            if (cmdKlass.constructor) {
              var actualClass = cmdKlass as typeof TempSingleCharNode; // TODO - figure out how to know the difference
              return new actualClass(ctrlSeq).parser();
            } else {
              var builder = cmdKlass as (c: string) => TempSingleCharNode; // TODO - figure out how to know the difference
              return builder(ctrlSeq).parser();
            }
          } else {
            return Parser.fail('unknown command: \\' + ctrlSeq);
          }
        });
      })
      .or(Parser.optWhitespace.then(Parser.succeed(this)));
  }
};

LatexCmds.verb = class extends TextBlock {
  ctrlSeq = '\\verb';
  ariaLabel = 'Verbatim';

  mathspeakTemplate = ['StartVerbatim', 'EndVerbatim'];

  parser() {
    var textBlock = this;

    // TODO: correctly parse text mode
    var string = Parser.string;
    var regex = Parser.regex;
    var optWhitespace = Parser.optWhitespace;
    return optWhitespace
      .then(string('|'))
      .then(regex(/^[^\|]*/))
      .skip(string('|'))
      .map(function (text) {
        if (text.length === 0) return new Fragment(0, 0);

        new TextPiece(text).adopt(textBlock, 0, 0);
        return textBlock;
      });
  }

  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    var contents = this.textContents();
    if (contents.length > 0) {
      ctx.latex += this.ctrlSeq + '|';
      ctx.latex += contents;
      ctx.latex += '|';
    }

    this.checkCursorContextClose(ctx);
  }

  html() {
    const out = h('span', { class: 'mq-text-mode mq-akit-verb' }, [
      h.text(this.textContents()),
    ]);
    this.setDOM(out);
    NodeBase.linkElementByCmdNode(out, this);
    return out;
  }

  write(cursor: Cursor, ch: string) {
    if (!ch.match(/\w/)) return;

    cursor.show().deleteSelection();

    const cursorL = cursor[L];
    if (!cursorL) new TextPiece(ch).createLeftOf(cursor);
    else if (cursorL instanceof TextPiece) cursorL.appendText(ch);

    this.bubble(function (node) {
      node.reflow();
      return undefined;
    });
  }
};
