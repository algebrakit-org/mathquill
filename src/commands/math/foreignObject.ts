/**
 * ForeignObjectCommand - Embeds external HTMLElements in MathQuill expressions
 *
 * This command allows embedding arbitrary DOM elements using the syntax:
 *   \foreignobject{objectId}
 *
 * The objectId references a pre-registered HTMLElement in the MathField's
 * foreign object registry. This approach completely decouples the LaTeX
 * representation from the actual DOM structure and component lifecycle.
 */
class ForeignObjectCommand extends MQSymbol {
  private objectId: string = '';
  private registry: ForeignObjectRegistry | null;

  /**
   * Parse the LaTeX syntax: \foreignobject{id}
   * Extracts the object ID from the braces
   */
  parser() {
    var self = this;
    var string = Parser.string;
    var regex = Parser.regex;

    return string('{')
      .then(regex(/^[a-zA-Z0-9_-]+/))
      .skip(string('}'))
      .map(function (id: string) {
        self.objectId = id;
        self.ctrlSeq = '\\foreignobject{' + id + '}';
        return self;
      });
  }

  /**
   * Render the foreign object to DOM
   * Looks up the registered element and wraps it in a protective container
   */
  html(): HTMLElement {
    pray('parent is defined', this.parent);
    // The parent should be a MathBlock which has the controller
    let ancestorNode: MQNode = this.parent;
    while (ancestorNode.parent) {
      ancestorNode = ancestorNode.parent;
    }
    const rootNode = ancestorNode as RootMathBlock;

    pray('controller is defined', rootNode.controller);
    const controller = rootNode.controller!;
    this.registry = controller.getForeignObjectRegistry();
    const registeredElement = this.registry.get(this.objectId);

    let el: HTMLElement;
    if (registeredElement) {
      el = this.wrapRegisteredElement(registeredElement);
    } else {
      el = this.createErrorElement();
    }

    this.setDOM(el);
    NodeBase.linkElementByCmdNode(el, this);

    return el;
  }

  /**
   * Wrap the registered element in a protective container with event isolation
   *
   * Note: We use the original element directly (not cloned) because the
   * application owns and manages the element's lifecycle. The wrapper just
   * provides event isolation to prevent MathQuill from interfering with
   * the embedded component.
   */
  private wrapRegisteredElement(element: HTMLElement): HTMLElement {
    // Use h() for regular HTML elements, not h.block() which is for MathBlocks
    var wrapper = h(
      'span',
      { class: 'mq-foreign-object-container', 'data-object-id': this.objectId },
      []
    );

    // Use the original element directly - no cloning
    // The application controls the element's lifecycle and state
    wrapper.appendChild(element);

    // Isolate events to prevent MathQuill interference
    this.isolateElement(wrapper);

    return wrapper;
  }

  /**
   * Stop event propagation to prevent MathQuill from interfering with
   * embedded component events, while allowing certain keys to bubble up
   */
  private isolateElement(wrapper: HTMLElement): void {
    wrapper.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    wrapper.addEventListener('mousedown', function (e) {
      e.stopPropagation();
    });

    wrapper.addEventListener('keydown', function (e) {
      // Allow Tab, Enter, and Escape to bubble up for navigation
      var allowedKeys = ['Tab', 'Enter', 'Escape'];
      if (allowedKeys.indexOf(e.key) === -1) {
        e.stopPropagation();
      }
    });

    wrapper.addEventListener('keyup', function (e) {
      var allowedKeys = ['Tab', 'Enter', 'Escape'];
      if (allowedKeys.indexOf(e.key) === -1) {
        e.stopPropagation();
      }
    });

    wrapper.addEventListener('input', function (e) {
      e.stopPropagation();
    });
  }

  /**
   * Create an error element when the object ID is not found in the registry
   */
  private createErrorElement(): HTMLElement {
    return h('span', { class: 'mq-foreign-object-error' }, [
      h.text('[Error: Foreign object "' + this.objectId + '" not found]'),
    ]);
  }

  /**
   * Export to LaTeX - just output the command with the object ID
   */
  latexRecursive(ctx: LatexContext): void {
    this.checkCursorContextOpen(ctx);
    ctx.latex += '\\foreignobject{' + this.objectId + '}';
    this.checkCursorContextClose(ctx);
  }

  /**
   * Export to plain text - use a placeholder representation
   */
  text(): string {
    return '[' + this.objectId + ']';
  }

  /**
   * Mathspeak representation for screen readers
   */
  mathspeak(): string {
    return 'embedded object ' + this.objectId;
  }

  remove(): this {
    if (this.objectId && this.registry && this.registry.has(this.objectId)) {
      this.registry.unregister(this.objectId);
    }

    // Call parent remove() to actually remove from tree
    return super.remove();
  }
}

// Register the command in LatexCmds so it can be parsed from LaTeX
LatexCmds.foreignobject = ForeignObjectCommand;
