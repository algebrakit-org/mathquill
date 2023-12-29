// LaTeX environments
// Environments are delimited by an opening \begin{} and a closing
// \end{}. Everything inside those tags will be formatted in a
// special manner depending on the environment type.

LatexCmds.begin =
    class extends MathCommand {
        parser() {
            const string = Parser.string;
            const regex = Parser.regex;
            return string('{')
                .then(regex(/^[a-z]+/i))
                .skip(string('}'))
                .then(function (env) {
                    return (Environments[env] ?
                        new Environments[env]().parser() :
                        Parser.fail('unknown environment type: ' + env)
                    ).skip(string('\\end{' + env + '}'));
                });
        }
    };

abstract class EnvironmentNode extends MathCommand {
    abstract environment: string;

    envTemplate = [['\\begin{', '}'], ['\\end{', '}']];
    wrappers(): [string, string] {
        return [
            this.envTemplate[0].join(this.environment),
            this.envTemplate[1].join(this.environment)
        ];
    }
}

class MatrixEnvironment extends EnvironmentNode {
    blocks: MatrixCell[];
    environment = 'matrix';

    rowSize: number;

    delimiters = {
        column: '&',
        row: '\\\\'
    };
    parentheses = {
        left: null,
        right: null,
    };
    // The parentheses that are used for standard latex rendering
    parenthesesLatex = {
        left: '',
        right: ''
    };
    vlines: number[] = [];

    reflow() {
        throw Error('NYI')
    }

    wrappers(): [string, string] {
        if (this.vlines.length > 0 && MathQuill.latexSyntax == 'STANDARD') {
            return [
                this.parenLatex(this.parenthesesLatex.left) + this.envTemplate[0].join('array'),
                this.envTemplate[1].join('array') + this.parenLatex(this.parenthesesLatex.right)
            ];
        } else {
            return super.wrappers();
        }
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
                optMathBlock
                    .many()
                    .then(function (result) {
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
                            self.vlines = vlines.filter(function (v, i, a) {
                                return a.indexOf(v) === i
                            }).sort().reverse();
                        } // else no optional parameter found, continue silently with rest of parsing
                        return Parser.succeed(undefined);
                    })
            )
            .then(
                optWhitespace
                    .then(string(this.delimiters.column)
                        .or(string(this.delimiters.row))
                        .or(latexMathParser.block))
                    .many()
                    .skip(optWhitespace)
                    .then(function (items) {
                        let blocks: MatrixCell[] = [];
                        let row = 0;
                        const selfBlocks: MatrixCell[] = self.blocks = [];

                        function addCell() {
                            selfBlocks.push(new MatrixCell(row, self, blocks));
                            blocks = [];
                        }

                        for (let i = 0; i < items.length; i += 1) {
                            if (items[i] instanceof MatrixCell) {
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
            )
    }
    // Relink all the cells after parsing
    finalizeTree() {
        const table = this.domFrag().firstElement()?.querySelector('table');
        if (table) DOMFragment.create(table).toggleClass('mq-rows-1', table.querySelectorAll('tr').length === 1);

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
        } else { // updown === 'down'
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
        }
        else if (dir === L) {
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
            [R]: blocks[1]
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

        this.vlines.filter(function (v, i, a) {
            return v === 0 || v === nCols || a.indexOf(v) != i;
        }).forEach(function (colIndex) {
            self.deleteVline(colIndex);
        })
    }
    addVline(colIndex: number) {
        pray('the vline shouldn\'t already exist at index', this.vlines.indexOf(colIndex) < 0);
        this.vlines.push(colIndex);
        this.vlines.sort().reverse();

        // this.jQ.find('tr').each(function(_, obj) {
        //     jQuery(obj)
        //         .find('td:not(.mq-matrix-vline)')
        //         .eq(colIndex - 1)
        //         .after(jQuery('<td class="mq-matrix-vline"></td>'));
        // });
    }
    deleteVline(colIndex: number) {
        // @ts-expect-error should error while contents are commented
        const self = this;
        const vIndex = this.vlines.indexOf(colIndex);

        pray('there should be a vline to remove at index', vIndex > -1);
        // this.jQ.find('tr').each(function(_, obj) {
        //     const removeIndex = self.vlines.length - 1 - vIndex;
        //     jQuery(obj).find('td.mq-matrix-vline').eq(removeIndex).remove();
        // });
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
        let row: number, column: number;

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
            // this.jQ.find('tr').eq(row).remove();
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
            // this.jQ.find('tr').eq(row).remove();
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
        this.finalizeTree();

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
    addRow(afterCell: MatrixCell) {
        const previous: MatrixCell[] = [];
        const newCells: MatrixCell[] = [];
        const next: MatrixCell[] = [];

        // const newRow = jQuery('<tr></tr>');
        let row = afterCell.row;
        let columns: number = 0,
            column: number = -1,
            block: MatrixCell;
        // @ts-ignore
        let newTd, newVLine;

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
            // jQuery('<td class="mq-matrix-vline"></td>')
            // .appendTo(newRow);
        }

        // Addd new cells, one for each column
        for (let i = 0; i < columns; i += 1) {
            // Add cell routine
            block = new MatrixCell(row + 1);
            block.parent = self;
            newCells.push(block);

            // newTd = jQuery('<tdd></td>');
            // Create cell <td>s and add to new row
            // block.jQ = jQuery('<div class="mq-empty">')
            // .attr(mqBlockId, block.id)
            // .appendTo(newTd);

            // newTd.appendTo(newRow);

            // Add vline if needed
            if (this.vlines.indexOf(i + 1) > -1) {
                // jQuery('<td class="mq-matrix-vline"></td>')
                //   .appendTo(newRow);
            }
        }

        // Inject vlines into new row
        // @ts-expect-error should error while contents are commented
        this.vlines.forEach(function (vIndex) {
            // newVline = jQuery('<td class="mq-matrix-vline"></td>');

            // jquery magic, insert in right place
        });

        // Insert the new row
        // this.jQ.find('tr').eq(row).after(newRow);
        this.blocks = previous.concat(newCells, next);

        pray('column index is positive', column > -1)
        return newCells[column];
    }
    addColumn(afterCell: MatrixCell) {
        const rows: MatrixCell[][] = [];
        const newCells: MatrixCell[] = [];
        let column: number = -1;
        let block: MatrixCell;

        const self = this;

        // Build rows array and find new column index
        this.eachChild(function (cell) {
            pray('child is not a matrix cell', cell instanceof MatrixCell);
            rows[cell.row] = rows[cell.row] || [];
            rows[cell.row].push(cell);
            if (cell === afterCell) column = rows[cell.row].length;
        });

        // Addd new cells, one for each row
        for (let i = 0; i < rows.length; i += 1) {
            // Add cell routine
            block = new MatrixCell(i);
            block.parent = self;
            newCells.push(block);
            rows[i].splice(column, 0, block);

            //   block.jQ = jQuery('<div class="mq-empty">')
            //     .attr(mqBlockId, block.id)
            //     .appendTo(jQuery('<td></td>'));
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
        // this.jQ.find('tr').each(function(i) {
        //   jQuery(this).find('td:not(.mq-matrix-vline').eq(column - 1).after(rows[i][column].jQ.parent());
        // })

        // @ts-ignore Flatten the rows array-of-arrays
        this.blocks = [].concat.apply([], rows);
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

        if (column >= 0
            && column < nCols
            // && this.vlines.indexOf(column) < 0  
        ) {
            const vIndex = this.vlines.indexOf(column);
            if (vIndex < 0) {
                // toggle on
                this.addVline(column);
            } else {
                // toggle off
                this.deleteVline(this.vlines[vIndex]);
            }
        }

        return returnCell;
    }
    backspace(
        cell: MatrixCell,
        dir: L | R,
        cursor: Cursor,
        finalDeleteCallback: () => void
    ) {
        const oppDir = dir === L ? R : L;
        let dirwards: MatrixCell | 0 = cell.getEnd(dir) as MatrixCell | 0;
        if (cell.isEmpty()) {
            this.deleteCell(cell);
            while (dirwards &&
                dirwards.getEnd(dir) &&
                this.blocks.indexOf(dirwards) === -1
            ) { dirwards = dirwards.getEnd(dir) as MatrixCell | 0; }
            if (dirwards) {
                cursor.insAtDirEnd(oppDir, dirwards);
            }
            if (this.blocks.length === 0) {
                finalDeleteCallback();
                this.finalizeTree();
            }
            this.bubble(function (node: MQNode) {
                node.reflow();
                return undefined;
            });
        }
    }
};

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
    keystroke(
        key: string,
        e: KeyboardEvent,
        ctrlr: Controller
    ) {
        switch (key) {
            case 'Ctrl-Alt-Spacebar':
                e.preventDefault();
                return this.parent.toggleVline(this);
            case 'Shift-Spacebar':
                e.preventDefault();
                return this.parent.addColumn(this);
            case 'Shift-Enter':
                e.preventDefault();
                return this.parent.addRow(this);
        }
        return super.keystroke(key, e, ctrlr);
    }
    deleteOurOf(dir: L | R, cursor: Cursor) {
        const _deleteOutOf = super.deleteOutOf;
        this.parent.backspace(this, dir, cursor, function () {
            // called when last cell gets deleted
            _deleteOutOf(dir, cursor);
        })
    }
    moveOutOf(dir: L | R, cursor: Cursor, updown: 'up' | 'down') {
        const atExitPoint = updown && this.parent.atExitPoint(dir, cursor);
        // Step out of the matrix if we've moved apst an edge column
        const oppDir = dir === L ? R : L;
        if (!atExitPoint && this[dir]) cursor.insAtDirEnd(oppDir, this.getEnd(dir) as MQNode);
        else cursor.insDirOf(dir, this.parent);
    }
    // This should be super_.remove() with the this.jQ.remove(); replaced by
    // removing its parent
    remove() {
        // this.jQ.parent().remove();
        return this.disown();
    }
}
