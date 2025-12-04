/**
 * Reasons why a foreign object might be unmounted from the DOM
 */
enum UnmountReason {
  /** The LaTeX content changed, removing the foreign object reference */
  LATEX_CHANGED = 'latex_changed',
  /** The entire MathField is being destroyed */
  MATHFIELD_DESTROYED = 'mathfield_destroyed',
  /** Explicit call to unregisterForeignObject */
  EXPLICIT_UNREGISTER = 'explicit_unregister',
}

/**
 * Options for registering a foreign object
 */
interface ForeignObjectOptions {
  /**
   * Callback invoked when the foreign object is unmounted from the DOM.
   * Return true to keep the object in the registry for future reuse.
   * Return false (or omit) to remove it from the registry.
   */
  onUnmount?: (
    id: string,
    element: HTMLElement,
    reason: UnmountReason
  ) => boolean;
}

/**
 * Internal registry entry tracking a foreign object and its metadata
 */
interface ForeignObjectEntry {
  element: HTMLElement;
  options?: ForeignObjectOptions;
}

/**
 * Registry for managing foreign objects embedded in MathQuill expressions.
 * Each MathField instance maintains its own registry, ensuring isolation
 * and automatic cleanup when the MathField is destroyed.
 */
class ForeignObjectRegistry {
  private entries: Map<string, ForeignObjectEntry> = new Map();

  /**
   * Register a foreign object with the given ID
   * @param id - Unique identifier for the foreign object
   * @param element - The HTMLElement to embed
   * @param options - Optional configuration including lifecycle callbacks
   */
  register(
    id: string,
    element: HTMLElement,
    options?: ForeignObjectOptions
  ): void {
    pray(
      'Foreign object ID must be a non-empty string',
      id && typeof id === 'string'
    );
    pray(
      'Foreign object element must be an HTMLElement',
      element instanceof HTMLElement
    );
    pray(
      `Foreign object with ID "${id}" is not already registered`,
      !this.entries.has(id)
    );

    this.entries.set(id, { element, options });
  }

  /**
   * Unregister a foreign object by ID
   * @param id - The ID of the foreign object to remove
   * @param reason - Why the object is being unregistered
   * @returns true if object was unregistered, false if it wasn't found
   */
  unregister(
    id: string,
    reason: UnmountReason = UnmountReason.EXPLICIT_UNREGISTER
  ): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    // Call onUnmount callback if provided
    let shouldKeep = false;
    if (entry.options?.onUnmount) {
      try {
        shouldKeep = entry.options.onUnmount(id, entry.element, reason);
      } catch (error) {
        console.error(
          `Error in onUnmount callback for foreign object "${id}":`,
          error
        );
      }
    }

    // Remove from registry unless callback explicitly requested to keep it
    if (!shouldKeep) {
      this.entries.delete(id);
      return true;
    }

    return false;
  }

  /**
   * Get a registered foreign object by ID
   * @param id - The ID of the foreign object to retrieve
   * @returns The HTMLElement if found, null otherwise
   */
  get(id: string): HTMLElement | null {
    const entry = this.entries.get(id);
    return entry ? entry.element : null;
  }

  /**
   * Check if a foreign object is registered
   * @param id - The ID to check
   * @returns true if the ID is registered, false otherwise
   */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Get all registered foreign object IDs
   * @returns Array of registered IDs
   */
  getAllIds(): string[] {
    const ids: string[] = [];
    this.entries.forEach((_, id) => {
      ids.push(id);
    });
    return ids;
  }

  /**
   * Clear all foreign objects from the registry
   * This is called when the MathField is destroyed
   * @param reason - Why the registry is being cleared
   */
  clear(reason: UnmountReason = UnmountReason.MATHFIELD_DESTROYED): void {
    const ids = this.getAllIds();

    // Notify all entries about unmounting
    for (const id of ids) {
      this.unregister(id, reason);
    }

    // Force clear any remaining entries (those that requested to be kept)
    if (reason === UnmountReason.MATHFIELD_DESTROYED) {
      this.entries.clear();
    }
  }

  /**
   * Get the number of registered foreign objects
   * @returns Count of registered objects
   */
  size(): number {
    return this.entries.size;
  }
}
