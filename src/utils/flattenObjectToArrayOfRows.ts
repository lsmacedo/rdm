/**
 * Flattens an object or array into an array of rows. Example:
 *
 * Input:
 * ```
 *   {
 *     name: 'Save Your Tears (Remix)',
 *     album: {
 *       name: 'Save Your Tears (Remix)',
 *       type: 'single',
 *     },
 *     artists: [
 *       { name: 'The Weeknd' },
 *       { name: 'Ariana Grande' }
 *     ],
 *   }
 * ```
 * Output:
 * ```
 *   [
 *     {
 *       name: 'Save Your Tears (Remix)',
 *       album__name: 'Save Your Tears (Remix)',
 *       album__type: 'Single',
 *       artists__name: 'The Weeknd',
 *     },
 *     {
 *       name: 'Save Your Tears (Remix)',
 *       album__name: 'Save Your Tears (Remix)',
 *       album__type: 'Single',
 *       artists__name: 'Ariana Grande',
 *     }
 *   ]
 * ```
 * @param obj Object or array to flatten
 * @param pathDelimiter Path delimiter setting for nested properties
 */
export function flattenObjectToArrayOfRows(
  obj: any,
  pathDelimiter = '__'
): Record<string, string>[] {
  // Initial object should not be empty or of primitive type
  if (!obj || typeof obj !== 'object') {
    throw new Error('Input should be either an object or an array');
  }

  // Call helper function to flatten the object into an array of rows
  const result = _flattenObjectToArrayOfRowsHelper(obj, '', pathDelimiter);

  // Return resulting array of rows
  return Array.isArray(result) ? result : [result];
}

function _flattenObjectToArrayOfRowsHelper(
  obj: any,
  propName: string,
  pathDelimiter: string
): Record<string, string> | Record<string, string>[] {
  // If the property is empty, return an object with its value
  //
  // Example:
  //   obj: null
  //   propName: href
  // Becomes:
  //   { href: null }
  //
  if (!obj) return { [propName]: obj };

  // If the property is of primitive type, return an object with its value
  //
  // Example:
  //   obj: true
  //   propName: public
  // Becomes:
  //   { public: true }
  //
  if (typeof obj !== 'object') {
    return { [propName]: obj };
  }

  // If the property is an array, make recursive calls to flatten each element
  //
  // Example:
  //   obj: [1, 2]
  //   propName: ids
  // Becomes:
  //   [{ ids: 1 }, { ids: 2 }]
  //
  if (Array.isArray(obj)) {
    return obj
      .map((item) =>
        _flattenObjectToArrayOfRowsHelper(item, propName, pathDelimiter)
      )
      .flat();
  }

  // If the property is an object, make recursive calls
  // Resulting objects should be reduced to a single object with all the properties
  // Resulting arrays should include all the properties from reduced object
  //
  // Example:
  //   obj: { name: 'Save your Tears (Remix)', artists: [{ name: 'The Weeknd' }, { name: 'Ariana Grande' }] }
  //   propName: tracks
  // Generates following reduced object:
  //   { tracks__name: 'Save your Tears (Remix)' }
  // And following partial array:
  //   [{ tracks__artists__name: 'The Weeknd' }, { tracks__artists__name: 'Ariana Grande' }]
  // Becomes:
  //   [
  //     { tracks__name: 'Save your Tears (Remix)', tracks__artists__name: 'The Weeknd' },
  //     { tracks__name: 'Save your Tears (Remix)', tracks__artists__name: 'Ariana Grande' },
  //   ]
  //
  const results = Object.keys(obj).map((key) => {
    const newPropName = propName ? `${propName}${pathDelimiter}${key}` : key;
    return _flattenObjectToArrayOfRowsHelper(
      obj[key],
      newPropName,
      pathDelimiter
    );
  });
  const reducedObject = results
    .filter((result) => !Array.isArray(result))
    .reduce((acc, result) => ({ ...acc, ...result }), {});
  const partialArray = results
    .filter((result) => Array.isArray(result))
    .flat()
    .map((result) => ({ ...reducedObject, ...result })) as Record<
    string,
    string
  >[];

  return partialArray.length ? partialArray : reducedObject;
}
