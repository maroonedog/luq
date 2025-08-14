/**
 * Field Type Detector
 * Detects the actual type of a field by tracking which type builder is used
 */

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array"
  | "object"
  | "tuple"
  | "union";

/**
 * Detect field type by executing the builder function and tracking which type builder is accessed
 */
export function detectFieldType(
  fieldDef: { path: string; builderFunction: Function },
  plugins: Record<string, any>
): FieldType | null {
  try {
    let detectedType: FieldType | null = null;

    // Create a tracking context that records which type builder is accessed
    const trackingContext = new Proxy(
      {},
      {
        get(target, prop) {
          if (typeof prop === "string" && isFieldType(prop)) {
            detectedType = prop as FieldType;
            // Return a mock builder that allows chaining
            return createMockBuilder();
          }
          return undefined;
        },
      }
    );

    // Execute the builder function with tracking context
    fieldDef.builderFunction(trackingContext);

    return detectedType;
  } catch (error) {
    return null;
  }
}

/**
 * Check if a property name is a valid field type
 */
function isFieldType(prop: string): boolean {
  return [
    "string",
    "number",
    "boolean",
    "date",
    "array",
    "object",
    "tuple",
    "union",
  ].includes(prop);
}

/**
 * Create a mock builder that allows method chaining
 */
function createMockBuilder(): any {
  const builder: any = new Proxy(() => builder, {
    get() {
      return createMockBuilder();
    },
    apply() {
      return builder;
    },
  });
  return builder;
}

/**
 * Batch detect field types for multiple field definitions
 */
export function detectFieldTypes(
  fieldDefinitions: Array<{ path: string; builderFunction: Function }>,
  plugins: Record<string, any>
): Map<string, FieldType> {
  const fieldTypes = new Map<string, FieldType>();

  for (const fieldDef of fieldDefinitions) {
    const type = detectFieldType(fieldDef, plugins);
    if (type) {
      fieldTypes.set(fieldDef.path, type);
    }
  }

  return fieldTypes;
}
