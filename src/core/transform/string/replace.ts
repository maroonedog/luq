/**
 * Creates a replace transform function
 * @param searchValue - The string or regex pattern to search for
 * @param replaceValue - The string to replace matches with
 * @returns A function that performs the replacement
 */
export function createReplace(
  searchValue: string | RegExp,
  replaceValue: string
): (value: string) => string {
  return (value: string): string => {
    return value.replace(searchValue, replaceValue);
  };
}

/**
 * Replaces all occurrences of a string
 * @param searchValue - The string to search for
 * @param replaceValue - The string to replace matches with
 * @returns A function that performs the replacement
 */
export function createReplaceAll(
  searchValue: string,
  replaceValue: string
): (value: string) => string {
  return (value: string): string => {
    // Handle empty search string case - insert between each character and at boundaries
    if (searchValue === "") {
      if (value === "") {
        return replaceValue;
      }
      return replaceValue + value.split("").join(replaceValue) + replaceValue;
    }
    return value.split(searchValue).join(replaceValue);
  };
}
