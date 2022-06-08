/** Topological sort to help manage dependencies
 *
 * Expects input in the following format:
 * ```
 * names = ['A', 'B', 'C']
 * obj = {
 *   'A': ['B'],
 *   'B': [],
 *   'C': ['A', 'B', 'C],
 * }
 * ```
 *
 * For the above input, the result would be:
 * ```
 * ['B', 'A', 'C']
 * ```
 */
export function topologicalSort(
  names: string[],
  obj: Record<string, string[]>
): string[] {
  return topologicalSortHelper(names, obj, [], 0);
}

function topologicalSortHelper(
  names: string[],
  obj: Record<string, string[]>,
  start: string[],
  depth: number
): string[] {
  // Process dependencies
  const processed = names.reduce((acc, name) => {
    // If all dependencies of this item have been processed, add it to the result
    if (obj[name].every((item) => acc.includes(item))) {
      return [...acc, name];
    } else {
      return acc;
    }
  }, start);
  // Get the items that have not been processed yet
  const nextNames = names.filter((n) => !processed.includes(n));
  // If there are still items to process, recurse; otherwise return the result
  return nextNames.length && depth <= names.length
    ? topologicalSortHelper(nextNames, obj, processed, depth + 1)
    : processed;
}
