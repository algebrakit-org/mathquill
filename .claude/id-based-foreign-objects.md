# ID-Based Foreign Objects Implementation

## Implementation Progress

**Overall Status: 40% Complete (2 of 5 phases)**

- ✅ Phase 1: Internal Registry Foundation - COMPLETED
- ✅ Phase 2: MathQuill Command Integration - COMPLETED
- ⏳ Phase 3: MathField API Extension - NEXT
- 📋 Phase 4: EmbedNode Refactoring - PLANNED
- 📋 Phase 5: Advanced Features & Polish - PLANNED

## Core Concept

Store only an identifier in LaTeX (`\foreignobject{objId}`) that resolves to actual HTMLElements from a managed registry during rendering. This completely decouples the LaTeX representation from the actual DOM structure and component lifecycle.

```latex
x = \foreignobject{myComponent123} + y
```

This resolves to a pre-registered HTMLElement at render time, allowing components to maintain full control over their own rendering and state management.

## Architecture Overview

```
┌─────────────────┐    
│   LaTeX Input   │    
│ \foreignobject  │    
│   {objId}       │    
└─────────┬───────┘    
          │             
          │ Parse LaTeX 
          ▼             
┌─────────────────┐    
│   MathQuill     │    
│   Rendering     │    
└─────────┬───────┘    
          │             
          │ Resolve ID  
          ▼             
┌─────────────────┐    
│  Foreign Object │    
│   Registry      │    
│(Instance Scoped)│    
└─────────┬───────┘    
          │             
          │ Return HTMLElement
          ▼             
┌─────────────────┐    
│ Rendered Math   │    
│ Expression with │    
│ Embedded        │    
│ Components      │    
└─────────────────┘    

    External Components
    (Registered Separately)
┌─────────────────┐
│ StencilJS Comp  │◄── Independent lifecycle
│ (Independent)   │    and state management
└─────────────────┘
```

### Registry Architecture
Each MathField instance maintains its own foreign object registry, eliminating cross-instance complexity and ensuring automatic cleanup when the MathField is destroyed. The registry lifecycle is directly tied to the MathField lifecycle.

## Implementation Strategy

### 1. Internal Foreign Object Registry

Foreign objects persist in the registry until explicitly removed or the MathField is destroyed. LaTeX changes trigger onUnmount callbacks rather than automatic removal, allowing the parent application to decide whether to retain components for future reuse or clean them up immediately.

```typescript
interface ForeignObjectRegistry {
  // Core registry operations
  register(id: string, element: HTMLElement, options?: ForeignObjectOptions): void;
  unregister(id: string): void;
  get(id: string): HTMLElement | null;
  has(id: string): boolean;
  
  // Simplified lifecycle (no reference counting needed)
  clear(): void; // Called when MathField destroys
}

interface ForeignObjectOptions {
  onUnmount?: (id: string, element: HTMLElement, reason: UnmountReason) => boolean; // return true to keep in registry
}

enum UnmountReason {
  LATEX_CHANGED = 'latex_changed',
  MATHFIELD_DESTROYED = 'mathfield_destroyed',
  EXPLICIT_UNREGISTER = 'explicit_unregister'
}
```

### 2. MathQuill Integration Points

#### LaTeX Command Registration
```typescript
class ForeignObjectCommand extends MQSymbol {
  private objectId: string;
  private registry: ForeignObjectRegistry;
  
  constructor(objectId: string) {
    super();
    this.objectId = objectId;
    this.registry = this.getInternalRegistry();
    this.ctrlSeq = `\\foreignobject{${objectId}}`;
  }
  
  html(): HTMLElement {
    const registeredElement = this.registry.get(this.objectId);
    
    if (registeredElement) {
      return this.wrapRegisteredElement(registeredElement);
    } else {
      return this.createErrorElement();
    }
  }
}
```

#### MathField API Extension (Public Interface)
```typescript
interface MathField {
  // Foreign object management (only public-facing methods)
  registerForeignObject(id: string, element: HTMLElement, options?: ForeignObjectOptions): void;
  unregisterForeignObject(id: string): void;
  getForeignObject(id: string): HTMLElement | null;
  updateForeignObject(id: string, data: any): void;
}
```

### 3. Element Wrapping Strategy

Instead of complex DOM integration, wrap foreign elements in a protective container:

```typescript
private wrapRegisteredElement(element: HTMLElement): HTMLElement {
  // Create protective wrapper
  const wrapper = document.createElement('span');
  wrapper.className = 'mq-foreign-object-container';
  wrapper.setAttribute('data-object-id', this.objectId);
  
  // Clone or move the element
  const elementCopy = this.cloneOrReference(element);
  wrapper.appendChild(elementCopy);
  
  // Prevent MathQuill event interference
  this.isolateElement(wrapper);
  
  return wrapper;
}

private isolateElement(wrapper: HTMLElement): void {
  // Stop event propagation to prevent MathQuill interference
  wrapper.addEventListener('click', (e) => e.stopPropagation());
  wrapper.addEventListener('keydown', (e) => {
    // Only allow specific keys to bubble up
    if (!['Tab', 'Enter', 'Escape'].includes(e.key)) {
      e.stopPropagation();
    }
  });
}
```

### 4. Error Handling for Missing References

When an ID isn't registered, show a clear error state:

```typescript
private createErrorElement(): HTMLElement {
  const error = document.createElement('span');
  error.className = 'mq-foreign-object-error';
  error.textContent = `[Error: ${this.objectId} not found]`;
  return error;
}
```

## Benefits of ID-Based Approach

### 1. Complete DOM Independence
- StencilJS components maintain full control over their DOM
- No risk of MathQuill interfering with component rendering
- Components can update independently of MathQuill state

### 2. Flexible State Management
- Component state lives entirely outside LaTeX
- Real-time updates don't affect LaTeX serialization
- Complex, non-serializable states fully supported

### 3. Improved Performance
- LaTeX remains lightweight (just IDs)
- No component serialization/deserialization overhead
- Registry lookups are fast and cached

### 4. Enhanced Reusability
- Components can exist independent of specific math expressions
- Same component type can be registered with different IDs for multiple instances

### 5. Predictable Error Handling
- Clear error states for unresolved references
- Explicit registration requirement prevents runtime errors
- Immediate feedback for missing components

## Implementation Phases

### Phase 1: Internal Registry Foundation ✅
**Status: COMPLETED**
- ✅ Created `ForeignObjectRegistry` class in `src/foreignObjectRegistry.ts`
- ✅ Implemented core operations: register, unregister, get, has, clear, size, getAllIds
- ✅ Added `UnmountReason` enum (LATEX_CHANGED, MATHFIELD_DESTROYED, EXPLICIT_UNREGISTER)
- ✅ Implemented `ForeignObjectOptions` with `onUnmount` callback support
- ✅ Integrated registry into `ControllerBase` constructor
- ✅ Added cleanup in `revert()` method when MathField destroyed
- ✅ Updated Makefile to include foreignObjectRegistry.ts
- ✅ Build and lint passing

**Key Implementation Details:**
- Used `pray()` for validation instead of throwing errors (MathQuill convention)
- Registry is instance-scoped (one per MathField)
- Automatic cleanup when MathField is destroyed
- Callbacks allow parent application to control component retention

### Phase 2: MathQuill Command Integration ✅
**Status: COMPLETED**
- ✅ Created `ForeignObjectCommand` extending `MQSymbol` in `src/commands/math/foreignObject.ts`
- ✅ Implemented LaTeX parsing for `\foreignobject{id}` syntax using Parser combinators
- ✅ Added element wrapping in protective container with `data-object-id` attribute
- ✅ Implemented event isolation to prevent MathQuill interference (click, mousedown, keydown, keyup, input)
- ✅ Allowed Tab, Enter, Escape keys to bubble up for navigation
- ✅ Registered command in `LatexCmds.foreignobject`
- ✅ Created CSS styles in `src/css/foreignObject.less`
- ✅ Imported CSS in `main.less`
- ✅ Added to Makefile SOURCES_FULL
- ✅ Build and lint passing

**Key Implementation Details:**
- **No cloning**: Uses original HTMLElement directly (not cloned) because application owns lifecycle
- **Extends `MQSymbol`**: Appropriate for leaf nodes without child blocks (similar to `EmbedNode`)
- **Controller access**: Casts `this.parent` to `MathBlock` to access controller
- **Error handling**: Shows `.mq-foreign-object-error` element when ID not found in registry
- **LaTeX serialization**: `latexRecursive()` outputs `\foreignobject{id}`
- **Text export**: Returns `[id]` for plain text representation
- **Mathspeak**: Returns "embedded object {id}" for screen readers

**Design Decision:**
- Extends `MQSymbol` (not `MathCommand`) because it's a leaf node without child blocks
- Similar to existing `EmbedNode` which also extends `MQSymbol`
- Appropriate for atomic elements that maintain no internal math structure
- Application controls element creation and lifecycle; MathQuill just references it

### Phase 3: MathField API Extension
- Extend MathField with public registry management methods
- Add public API for object registration/updates
- Implement proper cleanup and lifecycle management
- Update TypeScript definitions in `mathquill.d.ts`

### Phase 4: EmbedNode Refactoring
**NEW PHASE: Align EmbedNode with ForeignObject architecture**

After analysis, we discovered that MathQuill already has an `EmbedNode` class with similar goals but different implementation:

**EmbedNode (existing):**
- Uses global `EMBEDS` registry
- Takes HTML strings that get parsed into DOM
- Factory-based: `registerEmbed(name, factory)`
- Syntax: `\embed{name}[optionalData]`
- Good for: Static HTML snippets, simple custom notation

**ForeignObject (new):**
- Uses instance-scoped registry (per MathField)
- Takes live HTMLElement references
- Direct registration: `registerForeignObject(id, element, options)`
- Syntax: `\foreignobject{id}`
- Good for: Interactive widgets, StencilJS/React/Vue components, stateful UI

**Refactoring Goals:**
1. Keep `registerEmbed()` API unchanged (backwards compatible)
2. Refactor EmbedNode to use ForeignObject registry internally
3. Unify rendering path and lifecycle management
4. Maintain separate public APIs for different use cases
5. Reduce code duplication

### Phase 5: Advanced Features & Polish
- Add debugging and inspection tools
- Registry inspection utilities
- Optional logging for registry operations
- Documentation and comprehensive tests

## Challenges and Solutions

### Challenge: Element Reference Management
**Solution**: Use element cloning vs. reference strategies based on component type and registration options.

### Challenge: Memory Management
**Solution**: Instance-scoped registries with callback-driven lifecycle management. Registry automatically clears when MathField is destroyed, while LaTeX changes trigger `onUnmount` callbacks allowing parent application to control component cleanup.

### Challenge: Serialization for Persistence
**Solution**: Separate serialization strategy - LaTeX contains only IDs, separate storage for registry state.

This approach provides a much more robust foundation for integrating complex components while maintaining clean separation of concerns between MathQuill and foreign objects.