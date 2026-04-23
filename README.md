# [MathQuill](http://mathquill.com)

by [Han](http://github.com/laughinghan), [Jeanine](http://github.com/jneen), and [Mary](http://github.com/stufflebear) (<maintainers@mathquill.com>) [<img alt="slackin.mathquill.com" src="http://slackin.mathquill.com/badge.svg" align="top">](http://slackin.mathquill.com)

MathQuill is a web formula editor designed to make typing math easy and beautiful.

[<img alt="homepage demo" src="https://cloud.githubusercontent.com/assets/225809/15163580/1bc048c4-16be-11e6-98a6-de467d00cff1.gif" width="260">](http://mathquill.com)

The MathQuill project is supported by its [partners](http://mathquill.com/partners.html). We hold ourselves to a compassionate [Code of Conduct](http://docs.mathquill.com/en/latest/Code_of_Conduct/).

MathQuill is resuming active development and we're committed to getting things running smoothly. Find a dusty corner? [Let us know in Slack.](http://slackin.mathquill.com) (Prefer IRC? We're `#mathquill` on Freenode.)

## Getting Started

MathQuill has a simple interface. This brief example creates a MathQuill element and renders, then reads a given input:

```javascript
var htmlElement = document.getElementById('some_id');
var config = {
  handlers: { edit: function(){ ... } },
  restrictMismatchedBrackets: true
};
var mathField = MQ.MathField(htmlElement, config);

mathField.latex('2^{\\frac{3}{2}}'); // Renders the given LaTeX in the MathQuill field
mathField.latex(); // => '2^{\\frac{3}{2}}'
```

Check out our [Getting Started Guide](http://docs.mathquill.com/en/latest/Getting_Started/) for setup instructions and basic MathQuill usage.

## Docs

Most documentation for MathQuill is located on [ReadTheDocs](http://docs.mathquill.com/en/latest/).

Some older documentation still exists on the [Wiki](https://github.com/mathquill/mathquill/wiki).

## Open-Source License

The Source Code Form of MathQuill is subject to the terms of the Mozilla Public
License, v. 2.0: [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/)

The quick-and-dirty is you can do whatever if modifications to MathQuill are in
public GitHub forks. (Other ways to publicize modifications are also fine, as
are private use modifications. See also: [MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/))

## Export to AlgebraKiT Widgets

To export the new version of mathquill to the algebrakit widgets:

- make clean
- make all
- copy the following files to widgets/source/dist/mathquill:
  - mathquill.css
  - mathquill.js
  - mathquill.min.js

## Running unit tests
Run `make test` in the root directory of this repo. After this process is finished running, 
open the `./test/unit.html` file in a browser to view the results (no need to host the file in a webserver).

## Contributing

### Git hooks setup

This repo uses [Husky](https://typicode.github.io/husky/) to run pre-commit checks (Prettier via lint-staged).

Git clients like GitHub Desktop launch Git with a restricted `PATH` that may not include Node.js. If you see an error like `node: No such file or directory` or `npx: command not found` when committing, you need to extend the PATH for Husky by creating `~/.config/husky/init.sh`.

Find your Node installation path first:

| Setup | Command to find Node path |
|-------|--------------------------|
| [nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) | `dirname $(nvm which current)` |
| [nvm-windows](https://github.com/coreybutler/nvm-windows) | `where node` in Git Bash |
| [Volta](https://volta.sh/) | `echo $HOME/.volta/bin` |
| System Node (macOS/Linux) | `dirname $(which node)` |
| System Node (Windows/Git Bash) | `where node` |

Then create the Husky init script with your Node path. Examples:

**macOS/Linux** — create `~/.config/husky/init.sh`:

```sh
# nvm
NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" --no-use
export PATH="$(nvm which default | xargs dirname):$PATH"

# Volta
export PATH="$HOME/.volta/bin:$PATH"

# System Node — replace with output of: dirname $(which node)
export PATH="/usr/local/bin:$PATH"
```

**Windows (Git Bash)** — create `C:\Users\<YourUsername>\.config\husky\init.sh`:

```sh
# nvm-windows — replace with output of: where node (minus the \node.exe)
export PATH="/c/Users/<YourUsername>/AppData/Roaming/nvm/v20.0.0:$PATH"

# Volta
export PATH="/c/Users/<YourUsername>/.volta/bin:$PATH"

# System Node — replace with output of: where node (minus the \node.exe)
export PATH="/c/Program Files/nodejs:$PATH"
```
