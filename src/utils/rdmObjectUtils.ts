import { DatabaseStep, RdmObjectOld } from 'src/types/rdmObject';
import { uniqueArray } from './uniqueArray';

// Matches URLs
export const urlRegex =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

// Matches table.column
export const tableColumnRegex = /\w+\.\w+/g;

// Matches strings
export const stringRegex = /'[^']*'/g;

// Matches:
// 'string' + table.column;
// 1 + 1; 1 - 1; 1 * 1; 1 / 1;
export const basicOperationsRegex =
  /([\w+\.\w+]+|\w+|'[^']*') +([\/\+*-]) +([\w+\.\w+]+|\w+|'[^']*')/g;

/**
 * Get table name from a rdm value string
 * If responses is specified, it will skip the response key to return the actual
 * table name.
 */
export function tableName(
  str: string,
  responses?: Record<string, any>
): string {
  const tableName = str.split('.')[0];
  if (!responses || !Object.keys(responses).includes(tableName)) {
    return tableName;
  } else {
    return '_';
  }
}

/**
 * Get column name from a rdm value string
 * If responses is specified, it will skip the response key to return the actual
 * column name.
 */
export function columnName(
  str: string,
  responses?: Record<string, any>
): string {
  const [tableName, ...remaining] = str.split('.');
  if (!responses || !Object.keys(responses).includes(tableName)) {
    return remaining.join('.');
  } else {
    return [tableName, ...remaining].join('.');
  }
}

/**
 * Get table names array from an array of rdm values strings
 */
export function tablesArray(
  array: string[],
  responses?: Record<string, any>
): string[] {
  return (
    array
      // .filter((v) => tableColumnRegex.test(v))
      .map((v) => tableName(v, responses))
      .filter(uniqueArray)
  );
}

/**
 * Get column names array from an array of rdm values strings
 */
export function columnsArray(array: string[]): string[] {
  return (
    array
      // .filter((v) => tableColumnRegex.test(v))
      .map((v) => columnName(v))
      .filter(uniqueArray)
  );
}

/**
 * Gets the value being assigned to a column.
 */
export function columnValue(
  table: string,
  column: string,
  database: DatabaseStep,
  responses?: Record<string, any>
): { template: string | null; table: string; column: string } {
  const value = database.tables![table].set[column];
  return {
    template: templateFromValue(value),
    table: tableName(value, responses),
    column: columnName(value, responses),
  };
}

/**
 * Gets the template from a field value. Returns null if string does not contain
 * a template.
 */
export function templateFromValue(value: string): string | null {
  // return !tableColumnRegex.test(value) ? value : null;
  return null;
}

/**
 * Replaces alias with its declaration in a field value. Example:
 *
 * Input:
 * ```
 * '$track.name'
 * ```
 *
 * Output:
 * ```
 '* _.data.items.track.name'
 * ```
 */
export function replaceAliasFromValue(
  value: string,
  rdmObject: RdmObjectOld
): string {
  const column = tableName(value);
  const alias = rdmObject.output.alias?.[column];
  return alias ? value.replace(column, alias) : value;
}

export function processObject(value: any, responses: Record<string, any>): any {
  // If no value, return
  if (!value) {
    return value;
  }
  // If primitive type, process it
  if (typeof value === 'string') {
    const response = processTemplate(value, responses);
    if (Array.isArray(response)) {
      return response.map((res) => res.replace(/'/g, ''));
    } else {
      return response.replace(/'/g, '');
    }
  }
  // If an array, map it with recursive calls
  if (Array.isArray(value)) {
    return value.map((v) => processObject(v, responses));
  }
  // If an object, reduce it with recursive calls
  return Object.keys(value).reduce(
    (acc, key) => ({
      ...acc,
      [key]: processObject(value[key], responses),
    }),
    {}
  );
}

export function processTemplate(
  value: string,
  responses: Record<string, any>
): string | string[] {
  // If no value, return
  if (!value) {
    return value;
  }
  // If value is a string, return
  if (value.match(stringRegex)?.[0] === value) {
    return value;
  }
  // If has basic operation (+, -, *, /)
  const iterable = value.matchAll(basicOperationsRegex);
  const result = iterable.next();
  if (result?.value) {
    const value1 = processTemplate(result.value[1], responses);
    const operator = processTemplate(result.value[2], responses);
    const value2 = processTemplate(result.value[3], responses);

    const value1IsArray = Array.isArray(value1);
    const value2IsArray = Array.isArray(value2);

    if (value1IsArray && value2IsArray) {
      throw new Error('Cannot execute operation with multiple arrays');
    } else if (value1IsArray) {
      return value1.map((v1) => `'${eval(`${v1} ${operator} ${value2}`)}'`);
    } else if (value2IsArray) {
      return value2.map((v2) => `'${eval(`${value1} ${operator} ${v2}`)}'`);
    } else {
      return `'${eval(`${value1} ${operator} ${value2}`)}'`;
    }
  }
  // If matches table.column
  if (!value.match(urlRegex) && value.match(tableColumnRegex)?.[0]) {
    const table = tableName(value);
    const column = columnName(value);
    // If table is the env, read from environment variable
    if (table === 'env') {
      return `'${process.env[column]}'` || '';
    }
    // Else, read from a previous response
    else {
      const tableResponse = responses[table];
      if (Array.isArray(tableResponse) && tableResponse.length > 0) {
        return tableResponse
          .filter((response) => response[column])
          .map((response) => `'${response?.[column] || ''}'`);
      } else if (Object.keys(responses).includes(table)) {
        const response = [responses[table]].flat()[0];
        return `'${response?.[column] || ''}'`;
      }
    }
  }
  // Return the value if none of above
  return value;
}
