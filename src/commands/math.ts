/*************************************************
 * Abstract classes of math blocks and commands.
 ************************************************/

/**
 * Math tree node base class.
 * Some math-tree-specific extensions to MQNode.
 * Both MathBlock's and MathCommand's descend from it.
 */
class MathElement extends MQNode {
  finalizeInsert(options: CursorOptions, cursor: Cursor) {
    var self = this;
    self.postOrder(function (node) {
      node.finalizeTree(options);
    });
    self.postOrder(function (node) {
      node.contactWeld(cursor);
    });

    // note: this order is important.
    // empty elements need the empty box provided by blur to
    // be present in order for their dimensions to be measured
    // correctly by 'reflow' handlers.
    self.postOrder(function (node) {
      node.blur(cursor);
    });

    self.postOrder(function (node) {
      node.reflow();
    });
    var selfR = self[R];
    var selfL = self[L];
    if (selfR) selfR.siblingCreated(options, L);
    if (selfL) selfL.siblingCreated(options, R);
    self.bubble(function (node) {
      node.reflow();
      return undefined;
    });
  }
  // If the maxDepth option is set, make sure
  // deeply nested content is truncated. Just return
  // false if the cursor is already too deep.
  prepareInsertionAt(cursor: Cursor) {
    var maxDepth = cursor.options.maxDepth;
    if (maxDepth !== undefined) {
      var cursorDepth = cursor.depth();
      if (cursorDepth > maxDepth) {
        return false;
      }
      this.removeNodesDeeperThan(maxDepth - cursorDepth);
    }
    return true;
  }
  // Remove nodes that are more than `cutoff`
  // blocks deep from this node.
  removeNodesDeeperThan(cutoff: number) {
    var depth = 0;
    var queue: [[MQNode, number]] = [[this, depth]];
    var current: [MQNode, number] | undefined;

    // Do a breadth-first search of this node's descendants
    // down to cutoff, removing anything deeper.
    while ((current = queue.shift())) {
      var c = current;
      c[0].children().each(function (child) {
        var i = child instanceof MathBlock ? 1 : 0;
        depth = c[1] + i;

        if (depth <= cutoff) {
          queue.push([child, depth]);
        } else {
          (i ? child.children() : child).remove();
        }
        return undefined;
      });
    }
  }
}

class DOMView {
  constructor(
    public readonly childCount: number,
    public readonly render: (blocks: MathBlock[]) => Element
  ) {}
}

/**
 * Commands and operators, like subscripts, exponents, or fractions.
 * Descendant commands are organized into blocks.
 */
class MathCommand extends MathElement {
  replacedFragment: Fragment | undefined;
  protected domView: DOMView;
  protected ends: Ends<MQNode>;

  constructor(ctrlSeq?: string, domView?: DOMView, textTemplate?: string[]) {
    super();
    this.setCtrlSeqHtmlAndText(ctrlSeq, domView, textTemplate);
  }

  setEnds(ends: Ends<MQNode>) {
    pray('MathCommand ends are never empty', ends[L] && ends[R]);
    this.ends = ends;
  }

  getEnd(dir: Direction): MQNode {
    return this.ends[dir];
  }

  setCtrlSeqHtmlAndText(
    ctrlSeq?: string,
    domView?: DOMView,
    textTemplate?: string[]
  ) {
    if (!this.ctrlSeq) this.ctrlSeq = ctrlSeq;
    if (domView) this.domView = domView;
    if (textTemplate) this.textTemplate = textTemplate;
  }

  // obvious methods
  replaces(replacedFragment: Fragment) {
    replacedFragment.disown();
    this.replacedFragment = replacedFragment;
  }
  isEmpty() {
    return this.foldChildren(true, function (isEmpty, child) {
      return isEmpty && child.isEmpty();
    });
  }

  parser(): Parser<MQNode | Fragment> {
    var block = latexMathParser.block;

    return block.times(this.numBlocks()).map((blocks) => {
      this.blocks = blocks;

      for (var i = 0; i < blocks.length; i += 1) {
        blocks[i].adopt(this, this.getEnd(R), 0);
      }

      return this;
    });
  }

  // createLeftOf(cursor) and the methods it calls
  createLeftOf(cursor: Cursor) {
    var cmd = this;
    var replacedFragment = cmd.replacedFragment;

    cmd.createBlocks();
    super.createLeftOf(cursor);
    if (replacedFragment) {
      const cmdEndsL = cmd.getEnd(L);
      replacedFragment.adopt(cmdEndsL, 0, 0);
      replacedFragment.domFrag().appendTo(cmdEndsL.domFrag().oneElement());
      cmd.placeCursor(cursor);
      cmd.prepareInsertionAt(cursor);
    }
    cmd.finalizeInsert(cursor.options, cursor);
    cmd.placeCursor(cursor);
  }
  createBlocks() {
    var cmd = this,
      numBlocks = cmd.numBlocks(),
      blocks = (cmd.blocks = Array(numBlocks));

    for (var i = 0; i < numBlocks; i += 1) {
      var newBlock = (blocks[i] = new MathBlock());
      newBlock.adopt(cmd, cmd.getEnd(R), 0);
    }
  }
  placeCursor(cursor: Cursor) {
    //insert the cursor at the right end of the first empty child, searching
    //left-to-right, or if none empty, the right end child
    cursor.insAtRightEnd(
      this.foldChildren(this.getEnd(L), function (leftward, child) {
        return leftward.isEmpty() ? leftward : child;
      })
    );
  }

  // editability methods: called by the cursor for editing, cursor movements,
  // and selection of the MathQuill tree, these all take in a direction and
  // the cursor
  moveTowards(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
    var updownInto: NodeRef | undefined;
    if (updown === 'up') {
      updownInto = this.upInto;
    } else if (updown === 'down') {
      updownInto = this.downInto;
    }

    const el = updownInto || this.getEnd(-dir as Direction);
    cursor.insAtDirEnd(-dir as Direction, el);
    cursor.controller.aria
      .queueDirEndOf(-dir as Direction)
      .queue(cursor.parent, true);
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    if (this.isEmpty()) cursor[dir] = this.remove()[dir];
    else this.moveTowards(dir, cursor);
  }
  selectTowards(dir: Direction, cursor: Cursor) {
    cursor[-dir as Direction] = this;
    cursor[dir] = this[dir];
  }
  selectChildren(): MQSelection {
    return new MQSelection(this, this);
  }
  unselectInto(dir: Direction, cursor: Cursor) {
    const antiCursor = cursor.anticursor as Anticursor;
    const ancestor = antiCursor.ancestors[this.id] as MQNode;
    cursor.insAtDirEnd(-dir as Direction, ancestor);
  }
  seek(clientX: number, cursor: Cursor) {
    function getBounds(node: MQNode) {
      const el = node.domFrag().oneElement();
      const l = getBoundingClientRect(el).left;
      var r: number = l + el.offsetWidth;
      return {
        [L]: l,
        [R]: r,
      };
    }

    var cmd = this;
    var cmdBounds = getBounds(cmd);

    if (clientX < cmdBounds[L]) return cursor.insLeftOf(cmd);
    if (clientX > cmdBounds[R]) return cursor.insRightOf(cmd);

    var leftLeftBound = cmdBounds[L];
    cmd.eachChild(function (block) {
      var blockBounds = getBounds(block);
      if (clientX < blockBounds[L]) {
        // closer to this block's left bound, or the bound left of that?
        if (clientX - leftLeftBound < blockBounds[L] - clientX) {
          if (block[L]) cursor.insAtRightEnd(block[L] as MQNode);
          else cursor.insLeftOf(cmd);
        } else cursor.insAtLeftEnd(block);
        return false;
      } else if (clientX > blockBounds[R]) {
        if (block[R]) leftLeftBound = blockBounds[R];
        // continue to next block
        else {
          // last (rightmost) block
          // closer to this block's right bound, or the cmd's right bound?
          if (cmdBounds[R] - clientX < clientX - blockBounds[R]) {
            cursor.insRightOf(cmd);
          } else cursor.insAtRightEnd(block);
        }
        return undefined;
      } else {
        block.seek(clientX, cursor);
        return false;
      }
    });

    return undefined;
  }

  numBlocks() {
    return this.domView.childCount;
  }

  /**
   * Render the entire math subtree rooted at this command to a DOM node. Assumes `this.domView` is defined.
   *
   * See dom.test.js for example templates and intended outputs.
   */
  html(): Element | DocumentFragment {
    const blocks = this.blocks;
    pray('domView is defined', this.domView);
    const template = this.domView;
    const dom = template.render(blocks || []);
    this.setDOM(dom);
    NodeBase.linkElementByCmdNode(dom, this);
    return dom;
  }

  // methods to export a string representation of the math tree
  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    ctx.latex += this.ctrlSeq || '';
    this.eachChild((child) => {
      ctx.latex += '{';

      let beforeLength = ctx.latex.length;
      child.latexRecursive(ctx);
      let afterLength = ctx.latex.length;
      if (beforeLength === afterLength) {
        // nothing was written so we write a space
        ctx.latex += ' ';
      }

      ctx.latex += '}';
    });

    this.checkCursorContextClose(ctx);
  }
  textTemplate = [''];
  text() {
    var cmd = this,
      i = 0;
    return cmd.foldChildren(cmd.textTemplate[i], function (text, child) {
      i += 1;
      var child_text = child.text();
      if (
        text &&
        cmd.textTemplate[i] === '(' &&
        child_text[0] === '(' &&
        child_text.slice(-1) === ')'
      )
        return text + child_text.slice(1, -1) + cmd.textTemplate[i];
      return text + child_text + (cmd.textTemplate[i] || '');
    });
  }
  mathspeakTemplate = [''];
  mathspeak() {
    var cmd = this,
      i = 0;
    return cmd.foldChildren(
      cmd.mathspeakTemplate[i] || 'Start' + cmd.ctrlSeq + ' ',
      function (speech, block) {
        i += 1;
        return (
          speech +
          ' ' +
          block.mathspeak() +
          ' ' +
          (cmd.mathspeakTemplate[i] + ' ' || 'End' + cmd.ctrlSeq + ' ')
        );
      }
    );
  }

  akitLatexChildren() {
    const childLatexList: string[] = [];

    this.eachChild((child) => {
      const ctx: LatexContext = {
        latex: ' ',
        startIndex: -1,
        endIndex: -1,
      };

      child.latexRecursive(ctx);
      if (ctx.latex.length > 0) {
        childLatexList.push(ctx.latex);
      } else {
        childLatexList.push(' ');
      }
    });

    return childLatexList;
  }
}

/**
 * Lightweight command without blocks or children.
 */
class MQSymbol extends MathCommand {
  constructor(
    ctrlSeq?: string,
    html?: HTMLElement,
    text?: string,
    mathspeak?: string
  ) {
    super();
    this.setCtrlSeqHtmlTextAndMathspeak(
      ctrlSeq,
      html
        ? new DOMView(0, () => html.cloneNode(true) as HTMLElement)
        : undefined,
      text,
      mathspeak
    );
  }

  setCtrlSeqHtmlTextAndMathspeak(
    ctrlSeq?: string,
    html?: DOMView,
    text?: string,
    mathspeak?: string
  ) {
    if (!text && !!ctrlSeq) {
      text = ctrlSeq.replace(/^\\/, '');
    }

    this.mathspeakName = mathspeak || text;
    super.setCtrlSeqHtmlAndText(ctrlSeq, html, [text || '']);
  }

  parser(): Parser<MQNode | Fragment> {
    return Parser.succeed(this);
  }

  numBlocks() {
    return 0 as const;
  }

  replaces(replacedFragment: Fragment) {
    replacedFragment.remove();
  }
  createBlocks() {}

  moveTowards(dir: Direction, cursor: Cursor) {
    cursor.domFrag().insDirOf(dir, this.domFrag());
    cursor[-dir as Direction] = this;
    cursor[dir] = this[dir];
    cursor.controller.aria.queue(this);
  }
  deleteTowards(dir: Direction, cursor: Cursor) {
    cursor[dir] = this.remove()[dir];
  }
  seek(clientX: number, cursor: Cursor) {
    // insert at whichever side the click was closer to
    const el = this.domFrag().oneElement();
    const left = getBoundingClientRect(el).left;
    if (clientX - left < el.offsetWidth / 2) cursor.insLeftOf(this);
    else cursor.insRightOf(this);

    return cursor;
  }

  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);
    // ctx.latex += this.ctrlSeq || '';

    // AL-872
    const saneLatex = (this.ctrlSeq || '').replace(
      /[^\x00-\x7F\u2030]+/g,
      function (ch) {
        return '\\text{' + ch + '}';
      }
    ); //mslob: wrap unicode stuff in \text
    ctx.latex += saneLatex;

    this.checkCursorContextClose(ctx);
  }
  text() {
    return this.textTemplate.join('');
  }
  mathspeak(_opts?: MathspeakOptions) {
    return this.mathspeakName || '';
  }
  placeCursor() {}
  isEmpty() {
    return true;
  }
}
class VanillaSymbol extends MQSymbol {
  constructor(ch: string, html?: ChildNode, mathspeak?: string) {
    super(ch, h('span', {}, [html || h.text(ch)]), undefined, mathspeak);
  }
}
function bindVanillaSymbol(
  ch: string,
  htmlEntity?: string,
  mathspeak?: string
) {
  return () =>
    new VanillaSymbol(
      ch,
      htmlEntity ? h.entityText(htmlEntity) : undefined,
      mathspeak
    );
}

class BinaryOperator extends MQSymbol {
  constructor(
    ctrlSeq?: string,
    html?: ChildNode,
    text?: string,
    mathspeak?: string,
    treatLikeSymbol?: boolean
  ) {
    if (treatLikeSymbol) {
      super(
        ctrlSeq,
        h('span', {}, [html || h.text(ctrlSeq || '')]),
        undefined,
        mathspeak
      );
    } else {
      super(
        ctrlSeq,
        h('span', { class: 'mq-binary-operator' }, html ? [html] : []),
        text,
        mathspeak
      );
    }
  }
}
function bindBinaryOperator(
  ctrlSeq?: string,
  htmlEntity?: string,
  text?: string,
  mathspeak?: string
) {
  return () =>
    new BinaryOperator(
      ctrlSeq,
      htmlEntity ? h.entityText(htmlEntity) : undefined,
      text,
      mathspeak
    );
}

/**
 * Children and parent of MathCommand's. Basically partitions all the
 * symbols and operators that descend (in the Math DOM tree) from
 * ancestor operators.
 */
class MathBlock extends MathElement {
  controller?: Controller;

  join(methodName: JoinMethod) {
    return this.foldChildren('', function (fold, child) {
      return fold + child[methodName]();
    });
  }
  html() {
    const fragment = document.createDocumentFragment();
    this.eachChild((el) => {
      const childHtml = el.html();
      fragment.appendChild(childHtml);
      return undefined;
    });
    return fragment;
  }
  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);
    this.eachChild((child) => child.latexRecursive(ctx));
    this.checkCursorContextClose(ctx);
  }
  text() {
    var endsL = this.getEnd(L);
    var endsR = this.getEnd(R);
    return endsL === endsR && endsL !== 0 ? endsL.text() : this.join('text');
  }
  mathspeak() {
    var tempOp = '';
    var autoOps: CursorOptions['autoOperatorNames'] = {};
    if (this.controller) autoOps = this.controller.options.autoOperatorNames;
    return (
      this.foldChildren<string[]>([], function (speechArray, cmd) {
        if (cmd.isPartOfOperator) {
          tempOp += cmd.mathspeak();
        } else {
          if (tempOp !== '') {
            if (autoOps._maxLength! > 0) {
              var x = autoOps[tempOp.toLowerCase()];
              if (typeof x === 'string') tempOp = x;
            }
            speechArray.push(tempOp + ' ');
            tempOp = '';
          }
          var mathspeakText = cmd.mathspeak();
          var cmdText = cmd.ctrlSeq;
          if (
            isNaN(cmdText as any) && // TODO - revisit this to improve the isNumber() check
            cmdText !== '.' &&
            (!cmd.parent ||
              !cmd.parent.parent ||
              !cmd.parent.parent.isTextBlock())
          ) {
            mathspeakText = ' ' + mathspeakText + ' ';
          }
          speechArray.push(mathspeakText);
        }
        return speechArray;
      })
        .join('')
        .replace(/ +(?= )/g, '')
        // For Apple devices in particular, split out digits after a decimal point so they aren't read aloud as whole words.
        // Not doing so makes 123.456 potentially spoken as "one hundred twenty-three point four hundred fifty-six."
        // Instead, add spaces so it is spoken as "one hundred twenty-three point four five six."
        .replace(/(\.)([0-9]+)/g, function (_match, p1, p2) {
          return p1 + p2.split('').join(' ').trim();
        })
    );
  }

  ariaLabel = 'block';

  keystroke(key: string, e: KeyboardEvent | undefined, ctrlr: Controller) {
    const cursor = ctrlr.cursor;
    const cursorL = cursor[L];
    const cursorR = cursor[R];

    if (key === 'Spacebar' || key === 'Shift-Spacebar') {
      const hasWhitespaceAtL = cursorL ? cursorL.ctrlSeq == '\\ ' : false;
      const hasNeighboringWhitespace =
        hasWhitespaceAtL || (cursorR && cursorR.ctrlSeq == '\\ ');
      let preventDefault = false;

      if (ctrlr.options.spaceBehavesLikeTab) {
        if (ctrlr.doubleSpaceCache) {
          preventDefault = true;

          if (ctrlr.doubleSpaceCache?.consumeWhitespace && hasWhitespaceAtL) {
            // consume left whitespace
            new Fragment(cursorL, cursorL).remove();
            cursor[L] = cursorL ? cursorL.getEnd(L) : 0;
          }

          const escapeDir = key === 'Spacebar' ? R : L;
          if (cursor.parent !== ctrlr.root) {
            // cursor is in nested block, move up one level
            ctrlr.escapeDir(escapeDir, key, e);
          } else {
            // at top level, behave as home / end is pressed
            cursor.insAtDirEnd(escapeDir, ctrlr.root);
          }

          // the cached operation is performed, remove obj
          window.clearTimeout(ctrlr.doubleSpaceCache.timeoutId);
          delete ctrlr.doubleSpaceCache;
        } else {
          if (hasNeighboringWhitespace) preventDefault = true;

          const timeoutId = window.setTimeout(function () {
            delete ctrlr.doubleSpaceCache;
          }, 500);

          ctrlr.doubleSpaceCache = {
            consumeWhitespace: !preventDefault,
            timeoutId: timeoutId,
          };
        }
      } else {
        // prevent arbitrary amounts of whitespace
        if (hasNeighboringWhitespace) preventDefault = true;
      }

      if (preventDefault) {
        e?.preventDefault();
        return;
      }
    } else if (ctrlr.doubleSpaceCache) {
      window.clearTimeout(ctrlr.doubleSpaceCache.timeoutId);
      delete ctrlr.doubleSpaceCache;
    }

    return super.keystroke(key, e, ctrlr);
  }

  // editability methods: called by the cursor for editing, cursor movements,
  // and selection of the MathQuill tree, these all take in a direction and
  // the cursor
  moveOutOf(dir: Direction, cursor: Cursor, updown?: 'up' | 'down') {
    var updownInto: NodeRef | undefined;
    if (updown === 'up') {
      updownInto = this.parent.upInto;
    } else if (updown === 'down') {
      updownInto = this.parent.downInto;
    }

    if (!updownInto && this[dir]) {
      const otherDir = -dir as Direction;
      cursor.insAtDirEnd(otherDir, this[dir] as MQNode);
      cursor.controller.aria.queueDirEndOf(otherDir).queue(cursor.parent, true);
    } else {
      cursor.insDirOf(dir, this.parent);
      cursor.controller.aria.queueDirOf(dir).queue(this.parent);
    }
  }
  selectOutOf(dir: Direction, cursor: Cursor) {
    cursor.insDirOf(dir, this.parent);
  }
  deleteOutOf(_dir: Direction, cursor: Cursor) {
    cursor.unwrapGramp();
  }
  seek(clientX: number, cursor: Cursor) {
    var node = this.getEnd(R);
    if (!node) return cursor.insAtRightEnd(this);
    const el = node.domFrag().oneElement();
    const left = getBoundingClientRect(el).left;
    if (left + el.offsetWidth < clientX) {
      return cursor.insAtRightEnd(this);
    }

    var endsL = this.getEnd(L) as MQNode;
    if (clientX < getBoundingClientRect(endsL.domFrag().oneElement()).left)
      return cursor.insAtLeftEnd(this);
    while (clientX < getBoundingClientRect(node.domFrag().oneElement()).left)
      node = node[L] as MQNode;
    return node.seek(clientX, cursor);
  }
  chToCmd(ch: string, options: CursorOptions) {
    var cons;
    // exclude f because it gets a dedicated command with more spacing
    if (ch.match(/^[a-eg-zA-Z]$/)) {
      if (ch === 'x' && options && options.typingXWritesTimesSymbol) {
        return (LatexCmds as LatexCmdsSingleCharBuilder)['×'](ch);
      } else {
        return new Letter(ch);
      }
    } else if (/^\d$/.test(ch)) return new Digit(ch);
    else if (
      options &&
      ((options.typingSlashWritesDivisionSymbol && ch === '/') ||
        (options.typingColonWritesDivisionSymbol && ch === ':'))
    )
      return (LatexCmds as LatexCmdsSingleCharBuilder)['÷'](ch);
    else if (options && options.typingAsteriskWritesTimesSymbol && ch === '*')
      return (LatexCmds as LatexCmdsSingleCharBuilder)['×'](ch);
    else if (options && options.typingPercentWritesPercentOf && ch === '%')
      return (LatexCmds as LatexCmdsSingleCharBuilder).percentof(ch);
    else if (
      (cons = (CharCmds as CharCmdsAny)[ch] || (LatexCmds as LatexCmdsAny)[ch])
    ) {
      if (cons.constructor) {
        return new cons(ch);
      } else {
        return cons(ch);
      }
    } else return new VanillaSymbol(ch);
  }
  write(cursor: Cursor, ch: string) {
    let cmd = this.handleAutoCommands(cursor, ch);
    if (
      cmd &&
      (ch == ' ' || (ch == '(' && cmd.numBlocks && cmd.numBlocks() > 0))
    ) {
      // no need to render the space or opening bracket
      return;
    }

    cmd = this.chToCmd(ch, cursor.options);
    const seln = cursor.replaceSelection();
    if (seln) cmd?.replaces(seln);
    if (!cursor.isTooDeep()) {
      cmd?.createLeftOf(cursor.show());
      // special-case the slash so that fractions are voiced while typing
      if (ch === '/') {
        cursor.controller.aria.alert('over');
      } else {
        cursor.controller.aria.alert(cmd?.mathspeak({ createdLeftOf: cursor }));
      }
    }
  }

  handleAutoCommands(cursor: Cursor, ch: string): any {
    const autoCmds = cursor.options.autoCommands;
    const maxLength = autoCmds._maxLength;

    if (maxLength && maxLength > 0 && !/[a-z]/i.test(ch)) {
      // mslob: trigger autocommand only after non-letter

      let str: string = '',
        l: NodeRef = cursor[L],
        i: number = 0;
      while (l instanceof Letter && l.ctrlSeq === l.letter && i < maxLength) {
        str = l.letter + str;
        l = l[L];
        i += 1;
      }
      // check for an autocommand, check only longest string of letters (so not api --> a\pi)
      if (str.length > 0 && autoCmds.hasOwnProperty(str)) {
        for (
          i = 1, l = cursor[L];
          i < str.length;
          i += 1, l = (l as MQNode)[L]
        );
        new Fragment(l, cursor[L]).remove();
        cursor[L] = l ? l[L] : 0;

        let cmd = autoCmds[str];
        if (cmd == 1) cmd = str; // mslob: can be removed once old autocmds implementation is gone

        var cmdKlass = (LatexCmds as LatexCmdsSingleChar)[cmd];
        if (cmdKlass) {
          let node: MathCommand;
          if (cmdKlass.constructor) {
            var actualClass = cmdKlass as typeof MathCommand; // TODO - figure out how to know the difference
            node = new actualClass(cmd);
          } else {
            var builder = cmdKlass as (c: string) => MathCommand; // TODO - figure out how to know the difference
            node = builder(cmd);
          }
          node?.createLeftOf(cursor);
          return node;
        } else {
          // error
        }
      }
    }
    return;
  }

  writeLatex(cursor: Cursor, latex: string) {
    var all = Parser.all;
    var eof = Parser.eof;

    var block = latexMathParser
      .skip(eof)
      .or(all.result<false>(false))
      .parse(latex);

    if (block && !block.isEmpty() && block.prepareInsertionAt(cursor)) {
      block
        .children()
        .adopt(cursor.parent, cursor[L] as NodeRef, cursor[R] as NodeRef); // TODO - masking undefined. should be 0
      domFrag(block.html()).insertBefore(cursor.domFrag());
      cursor[L] = block.getEnd(R);
      block.finalizeInsert(cursor.options, cursor);
      var blockEndsR = block.getEnd(R);
      var blockEndsL = block.getEnd(L);
      var blockEndsRR = (blockEndsR as MQNode)[R];
      var blockEndsLL = (blockEndsL as MQNode)[L];
      if (blockEndsRR) blockEndsRR.siblingCreated(cursor.options, L);
      if (blockEndsLL) blockEndsLL.siblingCreated(cursor.options, R);
      cursor.parent.bubble(function (node) {
        node.reflow();
        return undefined;
      });
    }
  }

  focus() {
    this.domFrag().addClass('mq-hasCursor');
    this.domFrag().removeClass('mq-empty');

    return this;
  }
  blur(cursor: Cursor) {
    this.domFrag().removeClass('mq-hasCursor');
    if (this.isEmpty()) {
      this.domFrag().addClass('mq-empty');
      if (
        cursor &&
        this.isQuietEmptyDelimiter(cursor.options.quietEmptyDelimiters)
      ) {
        this.domFrag().addClass('mq-quiet-delimiter');
      }
    }
    return this;
  }
}

Options.prototype.mouseEvents = true;
API.StaticMath = function (APIClasses: APIClasses) {
  return class StaticMath extends APIClasses.AbstractMathQuill {
    innerFields: InnerFields;
    static RootBlock = MathBlock;

    __mathquillify(opts: ConfigOptions, _interfaceVersion: number) {
      this.config(opts as MathQuill.v3.Config);
      super.mathquillify('mq-math-mode');
      this.__controller.setupStaticField();
      if (this.__options.mouseEvents) {
        this.__controller.addMouseEventListener();
        this.__controller.staticMathTextareaEvents();
      }
      return this;
    }
    constructor(el: Controller) {
      super(el);
      var innerFields = (this.innerFields = []);
      this.__controller.root.postOrder(function (node: MQNode) {
        node.registerInnerField(innerFields, APIClasses.InnerMathField);
      });
    }
    latex(s: string): IBaseMathQuill;
    latex(): string;
    latex(_latex?: string): string | IBaseMathQuill {
      var returned = super.latex.apply(this, arguments as unknown as any);
      if (arguments.length > 0) {
        var innerFields = (this.innerFields = []);
        this.__controller.root.postOrder(function (node: MQNode) {
          node.registerInnerField(innerFields, APIClasses.InnerMathField);
        });
        // Force an ARIA label update to remain in sync with the new LaTeX value.
        this.__controller.updateMathspeak();
      }
      return returned;
    }
    setAriaLabel(ariaLabel: string) {
      this.__controller.setAriaLabel(ariaLabel);
      return this;
    }
    getAriaLabel() {
      return this.__controller.getAriaLabel();
    }
  };
};

class RootMathBlock extends MathBlock {}
RootBlockMixin(RootMathBlock.prototype); // adds methods to RootMathBlock

API.MathField = function (APIClasses: APIClasses) {
  return class MathField extends APIClasses.EditableField {
    static RootBlock = RootMathBlock;

    __mathquillify(opts: ConfigOptions, interfaceVersion: number) {
      this.config(opts as MathQuill.v3.Config);
      if (interfaceVersion > 1) this.__controller.root.reflow = noop;
      super.mathquillify('mq-editable-field mq-math-mode');
      // TODO: Why does this need to be deleted (contrary to the type definition)? Could we set it to `noop` instead?
      delete (this.__controller.root as any).reflow;
      return this;
    }
  };
};

API.InnerMathField = function (APIClasses: APIClasses) {
  pray('MathField class is defined', APIClasses.MathField);
  return class extends APIClasses.MathField {
    makeStatic() {
      this.__controller.editable = false;
      this.__controller.root.blur();
      this.__controller.unbindEditablesEvents();
      domFrag(this.__controller.container).removeClass('mq-editable-field');
    }
    makeEditable() {
      this.__controller.editable = true;
      this.__controller.editablesTextareaEvents();
      this.__controller.cursor.insAtRightEnd(this.__controller.root);
      domFrag(this.__controller.container).addClass('mq-editable-field');
    }
  };
};
