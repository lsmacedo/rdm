/**
 * Removes duplicated elements from an array using the `===` operator
 */
export function uniqueArray<T>(value: T, index: number, self: T[]) {
  return self.indexOf(value) === index;
}
