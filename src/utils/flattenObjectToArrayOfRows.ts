import { RdmObjectOld } from 'src/types/rdmObject';
import { columnName, replaceAliasFromValue } from './rdmObjectUtils';
import { uniqueArray } from './uniqueArray';

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
 *       album.name: 'Save Your Tears (Remix)',
 *       album.type: 'Single',
 *       artists.name: 'The Weeknd',
 *     },
 *     {
 *       name: 'Save Your Tears (Remix)',
 *       album.name: 'Save Your Tears (Remix)',
 *       album.type: 'Single',
 *       artists.name: 'Ariana Grande',
 *     }
 *   ]
 * ```
 * @param obj Object or array to flatten
 * @param expectedColumns Will be used to include only expected properties for the operation
 */
export function flattenObjectToArrayOfRows(
  obj: any,
  expectedColumns: string[]
): Record<string, string>[] {
  // Initial object should not be empty or of primitive type
  if (!obj || typeof obj !== 'object') {
    throw new Error('Input should be either an object or an array');
  }

  // Call helper function to flatten the object into an array of rows
  const result = _flattenObjectToArrayOfRowsHelper(
    obj,
    '',
    '',
    '.',
    expectedColumns
  );

  // Return resulting array of rows
  return Array.isArray(result) ? result : [result];
}

function _flattenObjectToArrayOfRowsHelper(
  obj: any,
  previousPath: string,
  propName: string,
  pathSeparator: string,
  expectedColumns: string[]
): Record<string, string> | Record<string, string>[] {
  const newPath = previousPath
    ? `${previousPath}${pathSeparator}${propName}`
    : propName;

  // If the property is empty, return an object with its value
  if (!obj) return { [newPath]: obj };

  // If the property is of primitive type, return an object with its value
  if (typeof obj !== 'object') {
    return { [newPath]: obj };
  }

  // If the property is an array, make recursive calls to flatten each element
  if (Array.isArray(obj)) {
    return obj
      .map((item: any) => {
        return _flattenObjectToArrayOfRowsHelper(
          item,
          previousPath,
          propName,
          pathSeparator,
          expectedColumns
        );
      })
      .flat();
  }

  // If the property is an object, make recursive calls
  // Resulting objects should be reduced to a single object with all the properties
  // Resulting arrays should include all the properties from reduced object
  const results = Object.keys(obj).flatMap((key) => {
    const newPropName = newPath ? `${newPath}${pathSeparator}${key}` : key;
    const keysArray = [];

    // Check if there are object iterations for this propName
    // TODO: Allow multiple iterations in same value.
    // Example: country.*.city.*.name
    if (
      propName &&
      expectedColumns
        .filter((value) => value.includes('*'))
        .some((value) => {
          const valueStart = value.substring(0, value.indexOf('*'));
          return newPath
            ? valueStart === `${newPath}${pathSeparator}`
            : valueStart === `${pathSeparator}`;
        })
    ) {
      keysArray.push('*');
    }

    // Check if current key is expected from the columns array
    if (expectedColumns.some((column) => column.startsWith(newPropName))) {
      keysArray.push(key);
    }

    if (!keysArray.length) {
      return {};
    }

    return keysArray.map((value) =>
      _flattenObjectToArrayOfRowsHelper(
        obj[key],
        newPath,
        value,
        pathSeparator,
        expectedColumns
      )
    );
  });
  const reducedObject = results
    .filter((result) => !Array.isArray(result))
    .reduce((acc, result) => {
      const hasObjectIteration =
        !newPath.includes('*') &&
        Object.keys(result).some((key) => key.includes('*'));
      if (hasObjectIteration) {
        results.push([result]);
      }
      return {
        ...acc,
        ...(!hasObjectIteration ? result : {}),
      };
    }, {});

  const mappedArray = results
    .filter((result) => Array.isArray(result))
    .flat()
    .map((result) => ({ ...reducedObject, ...result })) as Record<
    string,
    string
  >[];

  return mappedArray.length ? mappedArray : reducedObject;
}
