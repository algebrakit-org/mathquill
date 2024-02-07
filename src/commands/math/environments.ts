// LaTeX environments
// Environments are delimited by an opening \begin{} and a closing
// \end{}. Everything inside those tags will be formatted in a
// special manner depending on the environment type.

const NO_PAREN_SYM = {
  html: () => h.text(''),
  width: 0,
};

LatexCmds.begin = class extends MathCommand {
  parser() {
    const string = Parser.string;
    const regex = Parser.regex;
    return string('{')
      .then(regex(/^[a-z]+/i))
      .skip(string('}'))
      .then(function (env) {
        return (
          Environments[env]
            ? new Environments[env]().parser()
            : Parser.fail('unknown environment type: ' + env)
        ).skip(string('\\end{' + env + '}'));
      });
  }
};

abstract class EnvironmentNode extends MathCommand {
  abstract environment: string;

  envTemplate = [
    ['\\begin{', '}'],
    ['\\end{', '}'],
  ];
  wrappers(): [string, string] {
    return [
      this.envTemplate[0].join(this.environment),
      this.envTemplate[1].join(this.environment),
    ];
  }
}

class MatrixEnvironment extends EnvironmentNode {
  blocks: MatrixCell[];
  environment = 'matrix';

  rowSize: number;

  delimiters = {
    column: '&',
    row: '\\\\',
  };
  parentheses: { left: string; right: string } = {
    left: '',
    right: '',
  };
  // The parentheses that are used for standard latex rendering
  parenthesesLatex = {
    left: '',
    right: '',
  };
  // Ensure this is in reverse-column order (so [4, 2, 1])
  vlines: number[] = [];

  wrappers(): [string, string] {
    if (this.vlines.length > 0 && MathQuill.latexSyntax == 'STANDARD') {
      return [
        this.parenLatex(this.parenthesesLatex.left) +
          this.envTemplate[0].join('array'),
        this.envTemplate[1].join('array') +
          this.parenLatex(this.parenthesesLatex.right),
      ];
    } else {
      return super.wrappers();
    }
  }

  eachCell(yield_: (node: MatrixCell) => boolean | void | undefined) {
    return this.eachChild(yield_ as (node: MQNode) => boolean);
  }

  html() {
    this.buildDOMView();

    return super.html();
  }

  buildDOMView() {
    function parenSymbol(
      paren?: string,
      side?: L | R
    ): {
      html: ChildNode | DocumentFragment;
      width: string;
    } {
      if (paren) {
        const symbol = SVG_SYMBOLS[paren as keyof typeof SVG_SYMBOLS];
        const bracketSide = side === L ? 'mq-bracket-l' : 'mq-bracket-r';
        return {
          html: h(
            'span',
            {
              class: `mq-scaled mq-paren ${bracketSide}`,
              style: `width:${symbol.width}`,
            },
            [symbol.html()]
          ),
          width: symbol.width,
        };
      } else {
        return {
          html: h.text(''),
          width: '0',
        };
      }
    }

    this.domView = new DOMView(this.blocks.length, (blocks) => {
      let i = 0;

      // Build <tr><td>.. structure from cells
      let row: number;
      const table: HTMLElement[][] = [];
      this.eachCell(function (cell) {
        if (row !== cell.row) {
          row = cell.row;
          table[row] = [];
        }

        table[row].push(
          h('td', undefined, [h.block('span', undefined, blocks[i])])
        );
        i++;
      });

      // Inject vertical lines in between cells
      this.vlines.forEach(function (vIndex) {
        const _vIndex = Math.max(0, Math.min(table[0].length, vIndex));
        table.forEach(function (tr) {
          tr.splice(_vIndex, 0, h('td', { class: 'mq-matrix-vline ' }, []));
        });
      });

      const lSymbol = parenSymbol(this.parentheses.left, L);
      const rSymbol = parenSymbol(this.parentheses.right, R);
      return h('span', { class: 'mq-matrix mq-non-leaf' }, [
        lSymbol.html,
        h(
          'table',
          {
            class: 'mq-non-leaf',
            style: `margin-left:${lSymbol.width};margin-right:${rSymbol.width};`,
          },
          table.map((tr) => {
            return h('tr', undefined, tr);
          })
        ),
        rSymbol.html,
      ]);
    });
  }

  createBlocks() {
    this.blocks = [
      new MatrixCell(0, this),
      new MatrixCell(0, this),
      new MatrixCell(1, this),
      new MatrixCell(1, this),
    ];
  }

  latexRecursive(ctx: LatexContext) {
    this.checkCursorContextOpen(ctx);

    let _latex: string = '',
      matrixLatex: string = '';
    let row: number,
      nCols: number = 0;

    const self = this;

    this.eachChild(function (node) {
      const cell = node as unknown as MatrixCell;
      if (typeof row !== 'undefined') {
        matrixLatex +=
          row !== cell.row ? self.delimiters.row : self.delimiters.column;
      }
      row = cell.row;

      if (row === 0) nCols++;
      matrixLatex += cell.latex();
    });

    if (self.vlines.length > 0 && MathQuill.latexSyntax == 'STANDARD') {
      let alignArg: string = '{';
      for (let i = 0; i < nCols; i++) {
        if (self.vlines.indexOf(i) > -1) {
          alignArg += '|';
        }
        alignArg += 'c';
      }
      alignArg += '}';
      _latex = alignArg + matrixLatex;
    } else {
      _latex =
        this.vlines
          .map(function (line) {
            return ['[', ']'].join(line + '');
          })
          .reverse()
          .join('') + matrixLatex;
    }

    ctx.latex += self.wrappers().join(_latex);

    this.checkCursorContextClose(ctx);
  }

  parenLatex(paren: string): string {
    return paren || '';
  }

  parser() {
    const self = this;
    const optWhitespace = Parser.optWhitespace;
    const optMathBlock = latexMathParser.optBlock;
    const string = Parser.string;

    return optWhitespace
      .then(
        optMathBlock.many().then(function (result) {
          if (result.length > 0) {
            const vlines = [];
            for (let ii = 0; ii < result.length; ii++) {
              const block = result[ii];
              const vlineIndex = parseInt(block.join('latex'));
              if (vlineIndex == undefined || isNaN(vlineIndex)) {
                return Parser.fail('matrix optional argument must be integger');
              }
              vlines.push(vlineIndex);
            }
            self.vlines = vlines
              .filter(function (v, i, a) {
                return a.indexOf(v) === i;
              })
              .sort()
              .reverse();
          } // else no optional parameter found, continue silently with rest of parsing
          return Parser.succeed(undefined);
        })
      )
      .then(
        optWhitespace
          .then(
            string(this.delimiters.column)
              .or(string(this.delimiters.row))
              .or(latexMathParser.block)
          )
          .many()
          .skip(optWhitespace)
          .then(function (items) {
            let blocks: MatrixCell[] = [];
            let row = 0;
            self.blocks = [];

            function addCell() {
              self.blocks.push(new MatrixCell(row, self, blocks));
              blocks = [];
            }

            for (let i = 0; i < items.length; i += 1) {
              if (items[i] instanceof MathBlock) {
                blocks.push(items[i] as MatrixCell);
              } else {
                addCell();
                if (items[i] === self.delimiters.row) row += 1;
              }
            }
            addCell();
            self.autocorrect();
            return Parser.succeed(self);
          })
      );
  }
  // Relink all the cells after parsing
  finalizeTree() {
    const table = this.domFrag().oneElement().querySelector('table');
    if (table)
      DOMFragment.create(table).toggleClass(
        'mq-rows-1',
        table.querySelectorAll('tr').length === 1
      );

    this.relink();
  }

  // Enter the matrix at the top or bottom row if updown is configured.
  getEntryPoint(dir: L | R, updown: 'up' | 'down') {
    if (updown === 'up') {
      if (dir === L) {
        return this.blocks[this.rowSize - 1];
      } else {
        return this.blocks[0];
      }
    } else {
      // updown === 'down'
      if (dir === L) {
        return this.blocks[this.blocks.length - 1];
      } else {
        return this.blocks[this.blocks.length - this.rowSize];
      }
    }
  }
  // Exit the matrix at the first and last columns if updown is configured.
  atExitPoint(dir: L | R, cursor: Cursor) {
    // Which block are we in?
    const i = this.blocks.indexOf(cursor.parent as MatrixCell);

    if (i < 0) {
      // If index not found, assume we should exit.
      return true;
    } else if (dir === L) {
      // If we're on the left edge and moving left, we should exit.
      return i % this.rowSize === 0;
    } else {
      // If we're on the right edge and moving right, we should exit.
      return (i + 1) % this.rowSize === 0;
    }
  }
  moveTowards(dir: L | R, cursor: Cursor, updown: 'up' | 'down') {
    const entryPoint = updown && this.getEntryPoint(dir, updown);
    const minDir = dir === L ? R : L;
    cursor.insAtDirEnd(minDir, entryPoint || this.getEnd(minDir));
  }
  // Set up directional pointers between cells
  relink() {
    const blocks = this.blocks;
    const rows: MatrixCell[][] = [];
    let row: number = -1,
      column: number = -1,
      cell: MatrixCell;

    // The row size will be used by other functions down the track.
    // Begin by assuming we're a one-row matrix, an we'll overwrite this if we find another row.
    this.rowSize = blocks.length;

    // Use a for-loop rather than eachChild as we're still making sure
    // children() is set up properly
    for (let i = 0; i < blocks.length; i += 1) {
      cell = blocks[i];
      if (row !== cell.row) {
        if (cell.row === 1) {
          // We've just finished iterating the first row.
          this.rowSize = column;
        }
        row = cell.row;
        rows[row] = [];
        column = 0;
      }
      rows[row][column] = cell;

      // Set up horizontal linkage
      cell[R] = blocks[i + 1];
      cell[L] = blocks[i - 1];

      // Set up vertical linkage
      if (rows[row - 1] && rows[row - 1][column]) {
        cell.upOutOf = rows[row - 1][column];
        rows[row - 1][column].downOutOf = cell;
      }

      column += 1;
    }

    // set start and end blocks of matrix
    this.setEnds({
      [L]: blocks[0],
      [R]: blocks[blocks.length - 1],
    });
  }

  // Ensure consistent row lengths
  autocorrect() {
    const lengths = [];
    const rows: MatrixCell[][] = [];
    const blocks = this.blocks;
    let row: number;

    for (let i = 0; i < blocks.length; i += 1) {
      row = blocks[i].row;
      rows[row] = rows[row] || [];
      rows[row].push(blocks[i]);
      lengths[row] = rows[row].length;
    }

    const maxLength = Math.max(...lengths);
    if (maxLength !== Math.min(...lengths)) {
      // Pad shorter rows to correct length
      for (let i = 0; i < rows.length; i += 1) {
        let shortfall = maxLength - rows[i].length;
        while (shortfall) {
          const position = maxLength * i * rows[i].length;
          blocks.splice(position, 0, new MatrixCell(i, this));
          shortfall -= 1;
        }
      }
      this.relink();
    }

    // Correct vlines that are not supported
    this.vlines = this.vlines.filter(function (v) {
      return v > 0 && v < maxLength;
    });
  }
  correctVlines() {
    // Assume lengths of each row are consistent
    // Sore retrieve number fo columns from first row
    const blocks = this.blocks;
    const self = this;

    let i: number;
    for (i = 0; i < blocks.length; i += 1) {
      if (blocks[i].row > 0) break;
    }
    const nCols = i;

    this.vlines
      .filter(function (v, i, a) {
        return v === 0 || v === nCols || a.indexOf(v) != i;
      })
      .forEach(function (colIndex) {
        self.deleteVline(colIndex);
      });
  }
  addVline(colIndex: number) {
    pray(
      "the vline shouldn't already exist at index",
      this.vlines.indexOf(colIndex) < 0
    );
    this.vlines.push(colIndex);
    this.vlines.sort().reverse();

    this.domFrag()
      .oneElement()
      .querySelectorAll('tr')
      .forEach((tr) => {
        const targetFrag = DOMFragment.create(
          tr.querySelectorAll('td:not(.mq-matrix-vline)').item(colIndex - 1)
        );
        const vlineFrag = DOMFragment.create(
          h('td', { class: 'mq-matrix-vline' }, [])
        );

        vlineFrag.insertAfter(targetFrag);
      });
  }
  deleteVline(colIndex: number) {
    const vIndex = this.vlines.indexOf(colIndex);

    pray('there should be a vline to remove at index', vIndex > -1);
    this.domFrag()
      .oneElement()
      .querySelectorAll('tr')
      .forEach((tr) => {
        DOMFragment.create(
          tr
            .querySelectorAll('td.mq-matrix-vline')
            .item(this.vlines.length - 1 - vIndex)
        ).remove();
      });
    this.vlines.splice(vIndex, 1);
  }
  // Deleting a cell will also delete the current row and column if they
  // are empty, and relink the matrix.
  deleteCell(currentCell: MatrixCell) {
    const rows: MatrixCell[][] = [];
    const columns: MatrixCell[][] = [];
    let myRow: MatrixCell[] = [];
    let myColumn: MatrixCell[] = [];
    const blocks = this.blocks;
    let row: number = -1,
      column: number;

    // Create arrays for cells in the current row / column
    this.eachChild(function (cell) {
      pray('child is not a matrix cell', cell instanceof MatrixCell);
      if (row !== cell.row) {
        row = cell.row;
        rows[row] = [];
        column = 0;
      }
      columns[column] = columns[column] || [];
      columns[column].push(cell);
      rows[row].push(cell);

      if (cell === currentCell) {
        myRow = rows[row];
        myColumn = columns[column];
      }

      column += 1;
    });

    // only remove the final row or column if it's a 1-by-1 matrix
    if (myColumn.length === 1 && myRow.length === 1 && isEmpty(myRow)) {
      remove(myRow);
      DOMFragment.create(
        this.domFrag().oneElement().querySelectorAll('tr').item(row)
      ).remove();
    }
    if (isEmpty(myRow) && myColumn.length > 1) {
      row = rows.indexOf(myRow);
      // Decrease all following row numbers
      this.eachChild(function (cell) {
        pray('child is not a matrix cell', cell instanceof MatrixCell);
        if (cell.row > row) cell.row -= 1;
      });
      // Dispose of cells and remove <tr>
      remove(myRow);
      DOMFragment.create(
        this.domFrag().oneElement().querySelectorAll('tr').item(row)
      ).remove();
    }
    if (isEmpty(myColumn) && myRow.length > 1) {
      // First correct the vline indices
      const colIndex = columns.indexOf(myColumn);

      for (let i = 0; i < this.vlines.length; i++) {
        const vIndex = this.vlines[i];
        if (vIndex > colIndex) {
          this.vlines[i] = vIndex - 1;
        } else {
          break;
        }
      }

      // Then remove column
      remove(myColumn);

      // Check for invalidated vlines (duplicates and edge lines)
      // and remove them.
      this.correctVlines();
    }

    return;

    function isEmpty(cells: MatrixCell[]) {
      const empties: MatrixCell[] = [];
      for (let i = 0; i < cells.length; i += 1) {
        if (cells[i].isEmpty()) empties.push(cells[i]);
      }
      return empties.length === cells.length;
    }

    function remove(cells: MatrixCell[]) {
      for (let i = 0; i < cells.length; i += 1) {
        if (blocks.indexOf(cells[i]) > -1) {
          cells[i].remove();
          blocks.splice(blocks.indexOf(cells[i]), 1);
        }
      }
    }
  }
  addRow(afterCell: MatrixCell, ctrlr?: Controller) {
    const previous: MatrixCell[] = [];
    const newCells: MatrixCell[] = [];
    const next: MatrixCell[] = [];

    let row = afterCell.row;
    let columns: number = 0,
      column: number = -1,
      block: MatrixCell;
    const tds: HTMLElement[] = [];

    const self = this;

    this.eachChild(function (cell) {
      pray('child is not a matrix cell', cell instanceof MatrixCell);
      // Cache previous rows
      if (cell.row <= row) {
        previous.push(cell);
      }
      // Work out how many columns
      if (cell.row === row) {
        if (cell === afterCell) column = columns;
        columns += 1;
      }
      // Cache cells after new row
      if (cell.row > row) {
        cell.row += 1;
        next.push(cell);
      }
    });

    // Treat first possible vline (before any cells) as special case
    if (this.vlines.indexOf(0) > -1) {
      tds.push(h('td', { class: 'mq-matrix-vline' }, []));
    }

    // Add new cells, one for each column
    for (let i = 0; i < columns; i += 1) {
      // Add cell routine
      block = new MatrixCell(row + 1);
      block.parent = self;
      newCells.push(block);

      tds.push(
        h('td', undefined, [h.block('span', { class: 'mq-empty' }, block)])
      );

      // Addd vline if needed
      if (this.vlines.indexOf(i + 1) > -1) {
        tds.push(h('td', { class: 'mq-matrix-vline' }, []));
      }
    }

    const targetTrFrag = DOMFragment.create(
      this.domFrag().oneElement().querySelectorAll('tr').item(row)
    );
    const newTrFrag = DOMFragment.create(h('tr', undefined, tds));
    newTrFrag.insertAfter(targetTrFrag);

    // Insert the new row
    this.blocks = previous.concat(newCells, next);
    this.finalizeTree();
    ctrlr?.moveDown();

    this.bubble((node) => {
      node.reflow();
      return undefined;
    });
    return newCells[column];
  }
  addColumn(afterCell: MatrixCell, ctrlr?: Controller) {
    const rows: MatrixCell[][] = [];
    const newCells: MatrixCell[] = [];
    let column: number = -1;

    const self = this;

    // Build rows array and find new column index
    this.eachChild(function (cell) {
      pray('child is a matrix cell', cell instanceof MatrixCell);
      rows[cell.row] = rows[cell.row] || [];
      rows[cell.row].push(cell);
      if (cell === afterCell) column = rows[cell.row].length;
    });

    // Add new cells, one for each row
    for (let i = 0; i < rows.length; i += 1) {
      // Add cell routine
      const block = new MatrixCell(i);
      block.parent = self;
      newCells.push(block);
      rows[i].splice(column, 0, block);
    }

    pray('column index is positive', column > -1);

    // Correect vline indices
    for (let i = 0; i < this.vlines.length; i++) {
      const vIndex = this.vlines[i];
      if (vIndex >= column) {
        this.vlines[i] = vIndex + 1;
      } else {
        break;
      }
    }

    // Add cell <td> elements in correct positions
    this.domFrag()
      .oneElement()
      .querySelectorAll('tr')
      .forEach((trEl, i) => {
        const tdSiblingEl = trEl
          .querySelectorAll('td:not(.mq-matrix-vline)')
          .item(column - 1);
        const newBlockEl = h('td', undefined, [
          h.block('span', { class: 'mq-empty' }, newCells[i]),
        ]);
        const newBlockFrag = DOMFragment.create(newBlockEl);
        newBlockFrag.insDirOf(R, DOMFragment.create(tdSiblingEl));
      });

    // @ts-ignore Flatten the rows array-of-arrays
    this.blocks = [].concat.apply([], rows);
    this.finalizeTree();
    ctrlr?.moveRight();

    this.bubble(function (node: MQNode) {
      node.reflow();
      return undefined;
    });
    return newCells[afterCell.row];
  }
  toggleVline(afterCell: MatrixCell) {
    const rows: MatrixCell[][] = [];
    let column!: number;
    let returnCell = afterCell;

    // Build rows array and find column index
    this.eachChild(function (cell) {
      pray('child is not a matrix cell', cell instanceof MatrixCell);

      rows[cell.row] = rows[cell.row] || [];
      rows[cell.row].push(cell);
      if (cell === afterCell) column = rows[cell.row].length;
    });

    let nCols = rows[afterCell.row].length;

    // If in the final column of the matrix, first add column to be able to
    // put vline in between.
    if (column === nCols) {
      returnCell = this.addColumn(afterCell);
      nCols++;
    }

    if (column >= 0 && column < nCols) {
      const vIndex = this.vlines.indexOf(column);
      if (vIndex < 0) {
        // toggle on
        this.addVline(column);
      } else {
        // toggle off
        this.deleteVline(this.vlines[vIndex]);
      }
    }

    this.bubble((node) => {
      node.reflow();
      return undefined;
    });

    return returnCell;
  }
  backspace(
    cell: MatrixCell,
    dir: L | R,
    cursor: Cursor,
    finalDeleteCallback: () => void
  ) {
    const oppDir = dir === L ? R : L;
    let dirwards: MatrixCell = cell[dir] as MatrixCell;
    if (cell.isEmpty()) {
      this.deleteCell(cell);
      while (
        dirwards &&
        dirwards.getEnd(dir) &&
        this.blocks.indexOf(dirwards) === -1
      ) {
        dirwards = dirwards[dir] as MatrixCell;
      }
      if (dirwards) {
        cursor.insAtDirEnd(oppDir, dirwards);
      }
      if (this.blocks.length === 0) {
        finalDeleteCallback();
      }
      this.bubble(function (node: MQNode) {
        node.reflow();
        return undefined;
      });
    }
  }
}
Environments.matrix = MatrixEnvironment;

class MatrixCell extends MathBlock {
  parent: MatrixEnvironment;

  constructor(
    public row: number,
    parent?: MatrixEnvironment,
    replaces?: MatrixCell[]
  ) {
    super();
    if (parent) {
      this.adopt(parent, parent.getEnd(R), 0);
    }
    if (replaces) {
      for (let i = 0; i < replaces.length; i++) {
        replaces[i].children().adopt(this, this.getEnd(R), 0);
      }
    }
  }
  keystroke(key: string, e: KeyboardEvent | undefined, ctrlr: Controller) {
    switch (key) {
      case 'Ctrl-Alt-Spacebar':
        e?.preventDefault();
        return this.parent.toggleVline(this);
      case 'Shift-Spacebar':
        e?.preventDefault();
        return this.parent.addColumn(this, ctrlr);
      case 'Shift-Enter':
        e?.preventDefault();
        return this.parent.addRow(this, ctrlr);
    }
    return super.keystroke(key, e, ctrlr);
  }
  deleteOutOf(dir: L | R, cursor: Cursor) {
    const _deleteOutOf = super.deleteOutOf;
    this.parent.backspace(this, dir, cursor, function () {
      // called when last cell gets deleted
      _deleteOutOf(dir, cursor);
    });
  }
  moveOutOf(dir: L | R, cursor: Cursor, updown: 'up' | 'down') {
    const atExitPoint = updown && this.parent.atExitPoint(dir, cursor);
    // Step out of the matrix if we've moved apst an edge column
    const oppDir = dir === L ? R : L;
    if (!atExitPoint && this[dir])
      cursor.insAtDirEnd(oppDir, this[dir] as MQNode);
    else cursor.insDirOf(dir, this.parent);
  }
  // This should be super_.remove() with the this.jQ.remove(); replaced by
  // removing its parent
  remove() {
    this.domFrag().parent().remove();
    return this.disown();
  }
}

class CasesEnvironment extends MatrixEnvironment {
  environment = 'cases';
  parentheses = {
    left: '{',
    right: '',
  };
  parenthesesLatex = {
    left: '\\left\\{\\hspace{-5pt}',
    right: '\\right.',
  };
}
Environments.cases = CasesEnvironment;

class PMatrixEnvironment extends MatrixEnvironment {
  environment = 'pmatrix';
  parentheses = {
    left: '(',
    right: ')',
  };
  parenthesesLatex = {
    left: '\\left(\\hspace{-5pt}',
    right: '\\hspace{-5pt}\\right)',
  };
}
Environments.pmatrix = PMatrixEnvironment;

Environments.bmatrix = class extends MatrixEnvironment {
  environment = 'bmatrix';
  parentheses = {
    left: '[',
    right: ']',
  };
  parenthesesLatex = {
    left: '\\left[\\hspace{-5pt}',
    right: '\\hspace{-5pt}\\right]',
  };
};

Environments.Bmatrix = class extends MatrixEnvironment {
  environment = 'Bmatrix';
  parentheses = {
    left: '{',
    right: '}',
  };
  parenthesesLatex = {
    left: '\\left\\{\\hspace{-5pt}',
    right: '\\hspace{-5pt}\\right\\}',
  };
};

Environments.vmatrix = class extends MatrixEnvironment {
  environment = 'vmatrix';
  parentheses = {
    left: '|',
    right: '|',
  };
  parenthesesLatex = {
    left: '\\left|\\hspace{-5pt}',
    right: '\\hspace{-5pt}\\right|',
  };
};

Environments.Vmatrix = class extends MatrixEnvironment {
  environment = 'Vmatrix';
  parentheses = {
    left: '&#8214;',
    right: '&#8214;',
  };
  parenthesesLatex = {
    left: '\\left|\\hspace{-1pt}\\left|\\hspace{-5pt}',
    right: '\\hspace{-5pt}\\right|\\hspace{-1pt}\\right|',
  };
};

LatexCmds.SpaceVector = class extends PMatrixEnvironment {
  createBlocks() {
    this.blocks = [
      new MatrixCell(0, this),
      new MatrixCell(0, this),
      new MatrixCell(0, this),
    ];
  }
};

LatexCmds.PlaneVector = class extends PMatrixEnvironment {
  createBlocks() {
    this.blocks = [new MatrixCell(0, this), new MatrixCell(0, this)];
  }
};

LatexCmds.cases = class extends CasesEnvironment {
  createBlocks() {
    this.blocks = [new MatrixCell(0, this), new MatrixCell(1, this)];
  }
};
