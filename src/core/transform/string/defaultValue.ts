/**
 * Creates a default value transform function
 * @param defaultValue - The default value to use when input is null or undefined
 * @returns A function that returns the input value or default
 */
export function createDefaultValue(
  defaultValue: string
): (value: string | null | undefined) => string {
  return (value: string | null | undefined): string => {
    return value ?? defaultValue;
  };
}
