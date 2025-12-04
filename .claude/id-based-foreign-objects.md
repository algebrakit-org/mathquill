# ID-Based Foreign Objects Implementation

## Implementation Progress

- ✅ Phase 1: Internal Registry Foundation - COMPLETED
- ✅ Phase 2: MathQuill Command Integration - COMPLETED
- ✅ Phase 3: Automatic Registry Management - COMPLETED

**All implementation phases complete! The foreign object system is fully functional and ready to use.**

## Core Concept

Store only an identifier in LaTeX (`\foreignobject{objId}`) that resolves to actual HTMLElements from an automatically-managed registry during rendering. This completely decouples the LaTeX representation from the actual DOM structure and component lifecycle.

```latex
x = \foreignobject{myComponent123} + y
```

This resolves to a pre-registered HTMLElement at render time, allowing components to maintain full control over their own rendering and state management.

## Architecture Overview

```
┌─────────────────────────┐
│  User calls             │
│  foreignObject(id, el)  │
└───────────┬─────────────┘
            │
            │ Auto-register + insert
            ▼
┌─────────────────────────┐
│   MathQuill Rendering   │
│   \foreignobject{id}    │
└───────────┬─────────────┘
            │
            │ Resolve ID
            ▼
┌─────────────────────────┐
│  Foreign Object         │
│  Registry (Internal)    │
│  Instance Scoped        │
└───────────┬─────────────┘
            │
            │ Return HTMLElement
            ▼
┌─────────────────────────┐
│ Rendered Math           │
│ Expression with         │
│ Embedded Components     │
└─────────────────────────┘

    Automatic Cleanup
┌─────────────────────────┐
│ User deletes/changes    │◄── Registry cleaned up
│ LaTeX → Registry scans  │    automatically
│ and removes orphaned IDs│
└─────────────────────────┘
```

### Registry Architecture
Each MathField instance maintains its own internal foreign object registry. The registry is **fully automatic**:
- Objects are registered when `foreignObject(id, element)` is called
- Objects are cleaned up when removed from LaTeX (via backspace, cut, or `latex()` setter)
- All objects are cleaned up when the MathField is destroyed

## Implementation Strategy

### 1. Internal Foreign Object Registry (Automatic Lifecycle)

The registry is completely internal - users never interact with it directly. Objects are automatically cleaned up when no longer referenced in the LaTeX.

```typescript
interface ForeignObjectRegistry {
  // Internal registry operations (not exposed to users)
  register(id: string, element: HTMLElement): void;
  unregister(id: string): void;
  get(id: string): HTMLElement | null;
  has(id: string): boolean;
  getAllIds(): string[];
  cleanupUnreferencedIds(referencedIds: string[]): void;
  clear(): void;
}
```

### 2. MathQuill Integration Points

#### LaTeX Command Registration
```typescript
class ForeignObjectCommand extends MQSymbol {
  private objectId: string;
  private registry: ForeignObjectRegistry;

  html(): HTMLElement {
    const registeredElement = this.registry.get(this.objectId);

    if (registeredElement) {
      return this.wrapRegisteredElement(registeredElement);
    } else {
      return this.createErrorElement();
    }
  }

  override remove() {
    // Automatic cleanup when user deletes the object
    if (this.objectId && this.registry) {
      this.registry.unregister(this.objectId);
    }
    return super.remove();
  }
}
```

#### MathField API Extension (Public Interface)
```typescript
interface EditableMathQuill {
  // Automatic registration + insertion in one call
  foreignObject(id: string, element: HTMLElement): EditableMathQuill;
}
```

**Note**: The `foreignObject()` method returns `EditableMathQuill` (same as `write()`, `cmd()`, `typedText()`), enabling seamless method chaining with other editing operations.

**Usage Pattern:**
```typescript
const mathField = MQ.MathField(element);

// Create your component
const myButton = document.createElement('button');
myButton.textContent = 'Click me';

// Insert it - automatically registers AND inserts in one call
mathField
  .foreignObject('btn1', myButton)
  .write(' + y');  // Method chaining works!

// When LaTeX changes, orphaned objects are automatically removed
mathField.latex('x + z');  // btn1 automatically cleaned up
```

### 3. Automatic Cleanup Strategy

**Two cleanup mechanisms work together:**

1. **Explicit Deletion** - When user deletes via backspace:
   - `ForeignObjectCommand.remove()` is called
   - Immediately unregisters from registry

2. **LaTeX Replacement** - When `latex()` setter is called:
   - After rendering, scan new LaTeX for `\foreignobject{id}` references
   - Extract all referenced IDs using regex
   - Call `registry.cleanupUnreferencedIds(referencedIds)`
   - Orphaned objects are removed automatically

**Implementation:**
```typescript
// In latex() setter
latex(latex?: unknown) {
  if (arguments.length > 0) {
    this.__controller.renderLatexMath(latex);

    // Automatic cleanup after LaTeX changes
    const latexString = typeof latex === 'string' ? latex : String(latex);
    const referencedIds = extractForeignObjectIds(latexString);
    this.__controller
      .getForeignObjectRegistry()
      .cleanupUnreferencedIds(referencedIds);

    return this;
  }
  return this.__controller.exportLatex();
}
```

```typescript
// Helper function to scan LaTeX
function extractForeignObjectIds(latex: string): string[] {
  const regex = /\\foreignobject\{([a-zA-Z0-9_-]+)\}/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(latex)) !== null) {
    ids.push(match[1]);
  }

  return ids;
}
```

### 4. Element Wrapping Strategy

Foreign elements are wrapped in a protective container with event isolation:

```typescript
private wrapRegisteredElement(element: HTMLElement): HTMLElement {
  const wrapper = h(
    'span',
    { class: 'mq-foreign-object-container', 'data-object-id': this.objectId },
    []
  );

  // Use the original element directly - no cloning
  wrapper.appendChild(element);

  // Isolate events to prevent MathQuill interference
  this.isolateElement(wrapper);

  return wrapper;
}

private isolateElement(wrapper: HTMLElement): void {
  wrapper.addEventListener('click', (e) => e.stopPropagation());
  wrapper.addEventListener('mousedown', (e) => e.stopPropagation());
  wrapper.addEventListener('keydown', (e) => {
    // Allow Tab, Enter, Escape to bubble up for navigation
    if (!['Tab', 'Enter', 'Escape'].includes(e.key)) {
      e.stopPropagation();
    }
  });
}
```

### 5. Error Handling for Missing References

When an ID isn't registered, show a clear error state:

```typescript
private createErrorElement(): HTMLElement {
  return h('span', { class: 'mq-foreign-object-error' }, [
    h.text('[Error: Foreign object "' + this.objectId + '" not found]'),
  ]);
}
```

## Benefits of Automatic Management

### 1. Simplified API
- Single method call: `foreignObject(id, element)`
- No manual registration/unregistration needed
- Follows same pattern as `write()`, `cmd()`, `typedText()`

### 2. Automatic Cleanup
- Objects cleaned up when deleted by user
- Objects cleaned up when LaTeX replaced
- No memory leaks from orphaned objects
- Predictable lifecycle management

### 3. Complete DOM Independence
- StencilJS components maintain full control over their DOM
- No risk of MathQuill interfering with component rendering
- Components can update independently of MathQuill state

### 4. Flexible State Management
- Component state lives entirely outside LaTeX
- Real-time updates don't affect LaTeX serialization
- Complex, non-serializable states fully supported

### 5. Improved Performance
- LaTeX remains lightweight (just IDs)
- No component serialization/deserialization overhead
- Registry lookups are fast and cached

## Implementation Phases

### Phase 1: Internal Registry Foundation ✅
**Status: COMPLETED**
- ✅ Created `ForeignObjectRegistry` class in `src/foreignObjectRegistry.ts`
- ✅ Implemented core operations: register, unregister, get, has, clear, size, getAllIds
- ✅ Added `cleanupUnreferencedIds()` method for automatic cleanup
- ✅ Added `extractForeignObjectIds()` helper function for LaTeX scanning
- ✅ Integrated registry into `ControllerBase` constructor
- ✅ Added cleanup in `revert()` method when MathField destroyed
- ✅ Updated Makefile to include foreignObjectRegistry.ts
- ✅ Build and lint passing

**Key Implementation Details:**
- Used `pray()` for validation instead of throwing errors (MathQuill convention)
- Registry is instance-scoped (one per MathField)
- Automatic cleanup when MathField is destroyed
- Simplified interface - no callbacks, immediate removal

### Phase 2: MathQuill Command Integration ✅
**Status: COMPLETED**
- ✅ Created `ForeignObjectCommand` extending `MQSymbol` in `src/commands/math/foreignObject.ts`
- ✅ Implemented LaTeX parsing for `\foreignobject{id}` syntax using Parser combinators
- ✅ Added element wrapping in protective container with `data-object-id` attribute
- ✅ Implemented event isolation to prevent MathQuill interference (click, mousedown, keydown)
- ✅ Allowed Tab, Enter, Escape keys to bubble up for navigation
- ✅ Registered command in `LatexCmds.foreignobject`
- ✅ Created CSS styles in `src/css/foreignObject.less`
- ✅ Imported CSS in `main.less`
- ✅ Added to Makefile SOURCES_FULL
- ✅ Build and lint passing

**Key Implementation Details:**
- **No cloning**: Uses original HTMLElement directly (not cloned) because application owns lifecycle
- **Extends `MQSymbol`**: Appropriate for leaf nodes without child blocks (similar to `EmbedNode`)
- **Rendering approach**: Element rendering can be implemented via `html()` method or constructor-based approach
- **Controller access**: Casts `this.parent` to `MathBlock` to access controller
- **Parser registration**: Command registered in `LatexCmds.foreignobject` and uses Parser combinators for LaTeX parsing
- **Error handling**: Shows `.mq-foreign-object-error` element when ID not found in registry
- **LaTeX serialization**: `latexRecursive()` outputs `\foreignobject{id}`
- **Text export**: Returns `[id]` for plain text representation
- **Mathspeak**: Returns "embedded object {id}" for screen readers
- **Automatic cleanup on delete**: `remove()` calls `registry.unregister(id)` before calling `super.remove()`

### Phase 3: Automatic Registry Management ✅
**Status: COMPLETED**
- ✅ Added `foreignObject(id, element)` method to `EditableField` class in `publicapi.ts`
- ✅ Method calls `register()` then `write()` to insert LaTeX
- ✅ Returns `this` for method chaining (fluent API)
- ✅ Hooked automatic cleanup into `latex()` setter
- ✅ After rendering, scans LaTeX and cleans up orphaned IDs
- ✅ Updated TypeScript definitions in `mathquill.d.ts` for v3 namespace
- ✅ Build and lint passing

**Public API Method:**
```typescript
foreignObject(id: string, element: HTMLElement): EditableMathQuill;
```

**Key Implementation Details:**
- **v3 API only**: Only added to v3 namespace (latest version), not v1/v2
- **Fluent API**: Method returns `EditableMathQuill` (same as other editing methods like `write()`, `cmd()`, `typedText()`) to enable method chaining
- **Automatic registration**: Internally calls `registry.register()` before inserting
- **Automatic cleanup**: `latex()` setter scans and cleans up after changes
- **Type safety**: Full TypeScript support with proper type definitions
- **Previous API removal**: Earlier versions that exposed manual registration/unregistration methods (e.g., `registerForeignObject()`, `unregisterForeignObject()`) were removed in favor of the simplified automatic approach

**Usage Example:**
```typescript
const MQ = MathQuill.getInterface(3);
const mathField = MQ.MathField(element);

const myWidget = document.createElement('button');
myWidget.textContent = 'Click me';

// Automatic registration + insertion
mathField.foreignObject('btn1', myWidget);

// LaTeX includes the reference
console.log(mathField.latex());  // "\\foreignobject{btn1}"

// Automatic cleanup when LaTeX changes
mathField.latex('x + y');  // btn1 automatically removed from registry
```

## Challenges and Solutions

### Challenge: Automatic Cleanup Timing
**Solution**: Scan LaTeX after `latex()` setter completes. Use regex to find `\foreignobject{id}` references and remove orphaned IDs from registry.

### Challenge: Element Reference Management
**Solution**: Use original element directly (no cloning). Application owns element lifecycle; MathQuill just references it.

### Challenge: Memory Management
**Solution**: Automatic cleanup in two places: (1) `remove()` when user deletes, (2) `latex()` setter when content replaced. Registry automatically clears when MathField is destroyed.

### Challenge: Serialization for Persistence
**Solution**: LaTeX contains only IDs. Application must persist element state separately and re-register elements after deserialization.