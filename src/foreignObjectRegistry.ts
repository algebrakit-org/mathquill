/**
 * Extract all foreign object IDs from a LaTeX string
 * @param latex - The LaTeX string to scan
 * @returns Array of unique IDs found in \foreignobject{id} commands
 */
function extractForeignObjectIds(latex: string): string[] {
  const regex = /\\foreignobject\{([a-zA-Z0-9_-]+)\}/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(latex)) !== null) {
    ids.push(match[1]);
  }

  return ids;
}

/**
 * Internal registry entry tracking a foreign object and its metadata
 */
interface ForeignObjectEntry {
  element: HTMLElement;
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
   */
  register(id: string, element: HTMLElement): void {
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

    this.entries.set(id, { element });
  }

  /**
   * Unregister a foreign object by ID
   * @param id - The ID of the foreign object to remove
   * @param reason - Why the object is being unregistered
   * @returns true if object was unregistered, false if it wasn't found
   */
  unregister(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    this.entries.delete(id);
    return true;
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
  clear(): void {
    const ids = this.getAllIds();

    for (const id of ids) {
      this.unregister(id);
    }

    this.entries.clear();
  }

  /**
   * Get the number of registered foreign objects
   * @returns Count of registered objects
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Remove foreign objects that are not referenced in the provided ID list
   * This is used for automatic cleanup when LaTeX content changes
   * @param referencedIds - Array of IDs that are currently referenced in LaTeX
   */
  cleanupUnreferencedIds(referencedIds: string[]): void {
    const referencedSet = new Set(referencedIds);
    const allIds = this.getAllIds();

    for (const id of allIds) {
      if (!referencedSet.has(id)) {
        this.unregister(id);
      }
    }
  }
}
