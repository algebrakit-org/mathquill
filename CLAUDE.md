# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building
- `make` - Full build with minification (font, CSS, uglified JS)
- `make dev` - Development build without minification
- `make basic` - Build stripped-down version for basic math (smaller font)
- `make clean` - Remove build directory

### Testing and Linting
- `make test` - Build test files, then open `test/unit.html` in browser for unit tests
- `make server` - Start development server at http://localhost:9292 with auto-rebuild
- `npx tsc --noEmit` - TypeScript type checking
- `make lint` - Run TypeScript compiler for type checking
- `npx prettier --write '**/*.{ts,js,css,html}'` - Code formatting

### Development Server URLs
- Demo: http://localhost:9292/test/demo.html
- Unit tests: http://localhost:9292/test/unit.html  
- Visual tests: http://localhost:9292/test/visual.html

## Architecture Overview

MathQuill uses a layered architecture with four main components:

### 1. Public API Layer (`src/publicapi.ts`)
Thin wrapper around controller methods providing the MathQuill API (StaticMath, MathField, etc.)

### 2. Service Layer (`src/services/`)
Features that apply across commands (typing, cursor movement, LaTeX parsing/export):
- `keystroke.ts` - Keyboard event handling
- `latex.ts` - LaTeX parsing and export
- `mouse.ts` - Mouse interaction handling
- `textarea.ts` - Textarea synchronization
- `focusBlur.ts` - Focus/blur behavior
- `aria.ts` - Accessibility support

### 3. Command Layer (`src/commands/`)
Individual math elements users can type (fractions, roots, symbols):
- `math/basicSymbols.ts` - Basic mathematical symbols
- `math/commands.ts` - Core math commands (fractions, roots, etc.)
- `math/advancedSymbols.ts` - Advanced LaTeX symbols
- `math/environments.ts` - Math environments (matrices, etc.)
- `math/algebrakitCommands.ts` - AlgebraKit-specific commands

### 4. Edit Tree Layer (`src/tree.ts`, `src/cursor.ts`)
Low-level tree manipulation representing the mathematical expression structure, similar to DOM but for math.

## Key Files

- `src/controller.ts` - Main controller class managing MathQuill instances
- `src/tree.ts` - Base classes for tree nodes and manipulation
- `src/cursor.ts` - Cursor positioning and selection handling
- `src/dom.ts` - DOM utilities and element management
- `src/publicapi.ts` - Public API definitions and exports

## Build System

Uses Make with TypeScript compilation pipeline:
- TypeScript files compiled through custom `script/tsc-emit-only` 
- LESS stylesheets compiled to CSS
- Font files copied to build directory
- Minification via UglifyJS for production builds

## Testing

- Unit tests in `test/unit/` (Mocha-based, run in browser)
- Visual tests in `test/visual.html` 
- Support utilities in `test/support/`
- TypeScript configuration for tests in `test/tsconfig.public-types-test.json`

## AlgebraKit Integration

This is a fork with AlgebraKit-specific enhancements:
- Custom commands in `src/commands/math/algebrakitCommands.ts`
- Export instructions for AlgebraKit widgets in README.md
- Build outputs: `mathquill.css`, `mathquill.js`, `mathquill.min.js`