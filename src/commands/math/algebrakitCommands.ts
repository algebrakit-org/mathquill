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

abstract class DelimsPair extends DelimsNode {
  constructor(
    ctrlSeq: string,
    public leftSymbol: keyof typeof SVG_SYMBOLS,
    public rightSymbol: keyof typeof SVG_SYMBOLS,
    public separator: string
  ) {
    super();

    this.ctrlSeq = ctrlSeq;

    this.domView = new DOMView(2, (blocks) => {
      const leftSymbol = this.getSymbol(this.leftSymbol);
      const rightSymbol = this.getSymbol(this.rightSymbol);
      return h('span', { class: 'mq-non-leaf mq-bracket-container' }, [
        h(
          'span',
          {
            style: 'width:' + leftSymbol.width,
            class: 'mq-scaled mq-bracket-l mq-paren',
          },
          [leftSymbol.html()]
        ),
        h.block(
          'span',
          { style: 'margin-left:' + leftSymbol.width, class: 'mq-non-leaf' },
          blocks[0]
        ),
        h('span', { class: 'mq-delim' }, [h.text(separator)]),
        h.block(
          'span',
          { style: 'margin-right:' + rightSymbol.width, class: 'mq-non-leaf' },
          blocks[1]
        ),
        h(
          'span',
          {
            style: 'width:' + rightSymbol.width,
            class: 'mq-scaled mq-bracket-r mq-paren',
          },
          [rightSymbol.html()]
        ),
      ]);
    });

    this.textTemplate = [leftSymbol, separator, rightSymbol];
    this.mathspeakTemplate = [
      'left ' +
        BRACKET_NAMES[this.leftSymbol as keyof typeof BRACKET_NAMES] +
        ',',
      this.separator,
      ', right ' +
        BRACKET_NAMES[this.rightSymbol as keyof typeof BRACKET_NAMES],
    ];
  }

  getSymbol(ch: keyof typeof SVG_SYMBOLS) {
    return SVG_SYMBOLS[ch] || { width: '0', html: '' };
  }

  latexRecursive(ctx: LatexContext) {
    // Destructs the custom Interval command to bracket pair in its latex output
    if (MathQuill.latexSyntax === 'STANDARD') {
      this.checkCursorContextOpen(ctx);

      let leftBracket: string = this.leftSymbol;
      let rightBracket: string = this.rightSymbol;

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

class IntervalCommand extends DelimsPair {
  constructor(
    ctrlSeq: string,
    left: keyof typeof SVG_SYMBOLS,
    right: keyof typeof SVG_SYMBOLS,
    separator: string
  ) {
    super(ctrlSeq, left, right, separator);
  }
}

function bindIntervalCommand(
  ctrlSeq: string,
  open: keyof typeof SVG_SYMBOLS,
  close: keyof typeof SVG_SYMBOLS,
  delim: string
) {
  return () => new IntervalCommand(ctrlSeq, open, close, delim);
}

// Dutch notations for intervals
LatexCmds.IntervalNlExEx = bindIntervalCommand(
  '\\IntervalNlExEx',
  '&lang;',
  '&rang;',
  ';'
);
LatexCmds.IntervalNlExIn = bindIntervalCommand(
  '\\IntervalNlExIn',
  '&lang;',
  ']',
  ';'
);
LatexCmds.IntervalNlInEx = bindIntervalCommand(
  '\\IntervalNlInEx',
  '[',
  '&rang;',
  ';'
);
LatexCmds.IntervalNlInIn = bindIntervalCommand(
  '\\IntervalNlInIn',
  '[',
  ']',
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
  '(',
  ')',
  ','
);
LatexCmds.IntervalEnExIn = bindIntervalCommand(
  '\\IntervalEnExIn',
  '(',
  ']',
  ','
);
LatexCmds.IntervalEnInEx = bindIntervalCommand(
  '\\IntervalEnInEx',
  '[',
  ')',
  ','
);
LatexCmds.IntervalEnInIn = bindIntervalCommand(
  '\\IntervalEnInIn',
  '[',
  ']',
  ','
);

LatexCmds.PolarVector = LatexCmds.PolarVectorEn = class extends DelimsPair {
  constructor() {
    super('\\PolarVectorEn', '(', ')', ',');
  }
};

LatexCmds.PolarVectorNl = class extends DelimsPair {
  constructor() {
    super('\\PolarVectorNl', '(', ')', ';');
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
LatexCmds.TrueSolutionLt = bindAkitTextBlock(
  '\\TrueSolutionLt',
  'sprendiniai visi skaičiai'
);

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

//AL-1830: added additional keys for copy-pasting unicode characters
LatexCmds['◻'] = LatexCmds['square'];
LatexCmds['∣'] = LatexCmds['mid'];
LatexCmds['ω'] = LatexCmds['omega'];
LatexCmds['ψ'] = LatexCmds['psi'];
LatexCmds['χ'] = LatexCmds['chi'];
LatexCmds['τ'] = LatexCmds['tau'];
LatexCmds['σ'] = LatexCmds['sigma'];
LatexCmds['ρ'] = LatexCmds['rho'];
LatexCmds['ξ'] = LatexCmds['xi'];
LatexCmds['ν'] = LatexCmds['nu'];
LatexCmds['μ'] = LatexCmds['mu'];
LatexCmds['κ'] = LatexCmds['kappa'];
LatexCmds['ι'] = LatexCmds['iota'];
LatexCmds['θ'] = LatexCmds['theta'];
LatexCmds['η'] = LatexCmds['eta'];
LatexCmds['ζ'] = LatexCmds['zeta'];
LatexCmds['δ'] = LatexCmds['delta'];
LatexCmds['γ'] = LatexCmds['gamma'];
LatexCmds['β'] = LatexCmds['beta'];
LatexCmds['α'] = LatexCmds['alpha'];
LatexCmds['ϕ'] = LatexCmds['phi'];
LatexCmds['φ'] = LatexCmds['varphi'];
LatexCmds['ϵ'] = LatexCmds['epsilon'];
LatexCmds['ε'] = LatexCmds['varepsilon'];
LatexCmds['π'] = LatexCmds['π'];
LatexCmds['ϖ'] = LatexCmds['varpi'];
LatexCmds['ς'] = LatexCmds['varsigma'];
LatexCmds['ϑ'] = LatexCmds['thetasym'];
LatexCmds['υ'] = LatexCmds['upsi'];
LatexCmds['ϝ'] = LatexCmds['digamma'];
LatexCmds['ϰ'] = LatexCmds['varkappa'];
LatexCmds['ϱ'] = LatexCmds['varrho'];
LatexCmds['λ'] = LatexCmds['lambda'];
LatexCmds['Υ'] = LatexCmds['Upsih'];
LatexCmds['∀'] = LatexCmds['forall'];
LatexCmds['Ω'] = LatexCmds['Omega'];
LatexCmds['Ψ'] = LatexCmds['Psi'];
LatexCmds['Φ'] = LatexCmds['Phi'];
LatexCmds['Σ'] = LatexCmds['Sigma'];
LatexCmds['Π'] = LatexCmds['Pi'];
LatexCmds['Ξ'] = LatexCmds['Xi'];
LatexCmds['Λ'] = LatexCmds['Lambda'];
LatexCmds['Θ'] = LatexCmds['Theta'];
LatexCmds['Δ'] = LatexCmds['Delta'];
LatexCmds['Γ'] = LatexCmds['Gamma'];
LatexCmds['∓'] = LatexCmds['minusplus'];
LatexCmds['⋅'] = LatexCmds['cdot'];
LatexCmds['∞'] = LatexCmds['infinity'];
LatexCmds['∐'] = LatexCmds['coproduct'];
LatexCmds['⋃'] = LatexCmds['bigcup'];
LatexCmds['⋂'] = LatexCmds['bigcap'];
LatexCmds['⊕'] = LatexCmds['oplus'];
LatexCmds['⊗'] = LatexCmds['otimes'];
LatexCmds['≡'] = LatexCmds['equiv'];
LatexCmds['≅'] = LatexCmds['cong'];
LatexCmds['∴'] = LatexCmds['therefore'];
LatexCmds['∵'] = LatexCmds['because'];
LatexCmds['∝'] = LatexCmds['propto'];
LatexCmds['∈'] = LatexCmds['in'];
LatexCmds['∋'] = LatexCmds['contains'];
LatexCmds['⊂'] = LatexCmds['subset'];
LatexCmds['⊃'] = LatexCmds['superset'];
LatexCmds['⊆'] = LatexCmds['subseteq'];
LatexCmds['⊇'] = LatexCmds['superseteq'];
LatexCmds['ℕ'] = LatexCmds['Naturals'];
LatexCmds['ℙ'] = LatexCmds['Probability'];
LatexCmds['ℤ'] = LatexCmds['Integers'];
LatexCmds['ℚ'] = LatexCmds['Rationals'];
LatexCmds['ℝ'] = LatexCmds['Reals'];
LatexCmds['ℂ'] = LatexCmds['ComplexPlane'];
LatexCmds['ℍ'] = LatexCmds['Quaternions'];
LatexCmds['⋄'] = LatexCmds['diamond'];
LatexCmds['△'] = LatexCmds['bigtriangleup'];
LatexCmds['⊖'] = LatexCmds['ominus'];
LatexCmds['⊎'] = LatexCmds['uplus'];
LatexCmds['▽'] = LatexCmds['bigtriangledown'];
LatexCmds['⊓'] = LatexCmds['sqcap'];
LatexCmds['⊔'] = LatexCmds['sqcup'];
LatexCmds['⊙'] = LatexCmds['circledot'];
LatexCmds['†'] = LatexCmds['dagger'];
LatexCmds['‡'] = LatexCmds['ddagger'];
LatexCmds['≀'] = LatexCmds['wr'];
LatexCmds['⨿'] = LatexCmds['amalg'];
LatexCmds['⊧'] = LatexCmds['models'];
LatexCmds['≺'] = LatexCmds['prec'];
LatexCmds['≻'] = LatexCmds['succ'];
LatexCmds['⪯'] = LatexCmds['preceq'];
LatexCmds['⪰'] = LatexCmds['succeq'];
LatexCmds['≃'] = LatexCmds['simeq'];
LatexCmds['≪'] = LatexCmds['ll'];
LatexCmds['≫'] = LatexCmds['gg'];
LatexCmds['⋈'] = LatexCmds['bowtie'];
LatexCmds['⊏'] = LatexCmds['sqsubset'];
LatexCmds['⊐'] = LatexCmds['sqsupset'];
LatexCmds['⌣'] = LatexCmds['smile'];
LatexCmds['⊑'] = LatexCmds['sqsubseteq'];
LatexCmds['⊒'] = LatexCmds['sqsupseteq'];
LatexCmds['⌢'] = LatexCmds['frown'];
LatexCmds['⊢'] = LatexCmds['vdash'];
LatexCmds['⊣'] = LatexCmds['dashv'];
LatexCmds['≮'] = LatexCmds['nless'];
LatexCmds['≯'] = LatexCmds['ngtr'];
LatexCmds['⟵'] = LatexCmds['longleftarrow'];
LatexCmds['⟶'] = LatexCmds['longrightarrow'];
LatexCmds['⟸'] = LatexCmds['Longleftarrow'];
LatexCmds['⟹'] = LatexCmds['Longrightarrow'];
LatexCmds['⟷'] = LatexCmds['longleftrightarrow'];
LatexCmds['↕'] = LatexCmds['updownarrow'];
LatexCmds['⟺'] = LatexCmds['Longleftrightarrow'];
LatexCmds['⇕'] = LatexCmds['Updownarrow'];
LatexCmds['↗'] = LatexCmds['nearrow'];
LatexCmds['↩'] = LatexCmds['hookleftarrow'];
LatexCmds['↪'] = LatexCmds['hookrightarrow'];
LatexCmds['↘'] = LatexCmds['searrow'];
LatexCmds['↼'] = LatexCmds['leftharpoonup'];
LatexCmds['⇀'] = LatexCmds['rightharpoonup'];
LatexCmds['↙'] = LatexCmds['swarrow'];
LatexCmds['↽'] = LatexCmds['leftharpoondown'];
LatexCmds['⇁'] = LatexCmds['rightharpoondown'];
LatexCmds['↖'] = LatexCmds['nwarrow'];
LatexCmds['⇌'] = LatexCmds['rightleftharpoons'];
LatexCmds['↶'] = LatexCmds['curvearrowleft'];
LatexCmds['↷'] = LatexCmds['curvearrowright'];
LatexCmds['⋮'] = LatexCmds['vdots'];
LatexCmds['ℓ'] = LatexCmds['ell'];
LatexCmds['⊤'] = LatexCmds['top'];
LatexCmds['♭'] = LatexCmds['flat'];
LatexCmds['⊺'] = LatexCmds['intercal'];
LatexCmds['♮'] = LatexCmds['natural'];
LatexCmds['♯'] = LatexCmds['sharp'];
LatexCmds['℘'] = LatexCmds['wp'];
LatexCmds['⊥'] = LatexCmds['bot'];
LatexCmds['♣'] = LatexCmds['clubsuit'];
LatexCmds['♢'] = LatexCmds['diamondsuit'];
LatexCmds['♡'] = LatexCmds['heartsuit'];
LatexCmds['♠'] = LatexCmds['spadesuit'];
LatexCmds['∮'] = LatexCmds['oint'];
LatexCmds['⨆'] = LatexCmds['bigsqcup'];
LatexCmds['⋁'] = LatexCmds['bigvee'];
LatexCmds['⋀'] = LatexCmds['bigwedge'];
LatexCmds['⨀'] = LatexCmds['bigodot'];
LatexCmds['⨂'] = LatexCmds['bigotimes'];
LatexCmds['⨁'] = LatexCmds['bigoplus'];
LatexCmds['⨄'] = LatexCmds['biguplus'];
LatexCmds['⌊'] = LatexCmds['lfloor'];
LatexCmds['⌋'] = LatexCmds['rfloor'];
LatexCmds['⌈'] = LatexCmds['lceil'];
LatexCmds['⌉'] = LatexCmds['rceil'];
LatexCmds['∇'] = LatexCmds['del'];
LatexCmds['∘'] = LatexCmds['circle'];
LatexCmds['•'] = LatexCmds['bullet'];
LatexCmds['⧵'] = LatexCmds['smallsetminus'];
LatexCmds['↓'] = LatexCmds['downarrow'];
LatexCmds['⇓'] = LatexCmds['Downarrow'];
LatexCmds['⇑'] = LatexCmds['Uparrow'];
LatexCmds['⇒'] = LatexCmds['implies'];
LatexCmds['⇐'] = LatexCmds['impliedby'];
LatexCmds['↔'] = LatexCmds['leftrightarrow'];
LatexCmds['⇔'] = LatexCmds['iff'];
LatexCmds['ℜ'] = LatexCmds['real'];
LatexCmds['ℑ'] = LatexCmds['Imaginary'];
LatexCmds['∂'] = LatexCmds['partial'];
LatexCmds['£'] = LatexCmds['pounds'];
LatexCmds['ℵ'] = LatexCmds['alephsym'];
LatexCmds['∃'] = LatexCmds['exists'];
LatexCmds['∄'] = LatexCmds['nexist'];
LatexCmds['∧'] = LatexCmds['wedge'];
LatexCmds['∨'] = LatexCmds['vee'];
LatexCmds['∅'] = LatexCmds['varnothing'];
LatexCmds['∪'] = LatexCmds['union'];
LatexCmds['∩'] = LatexCmds['intersection'];
LatexCmds['∠'] = LatexCmds['angle'];
LatexCmds['∡'] = LatexCmds['measuredangle'];

LatexCmds['̲'] = LatexCmds.underline;
LatexCmds['̅'] = LatexCmds.bar;
LatexCmds['̇'] = LatexCmds.dot;
LatexCmds['̈'] = LatexCmds.ddot;
LatexCmds['̃'] = LatexCmds.tilde;

//AL-1830: these are 3 diacritics that we support but do not yet support copy-pasting.
// LatexCmds['x⃡'] = LatexCmds.overleftrightarrow;
// LatexCmds['⃛'] = LatexCmds.dddot;
// LatexCmds['x⃑'] = LatexCmds.vec;
