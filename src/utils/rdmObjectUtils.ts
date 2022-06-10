import { stringify } from 'querystring';
import { RdmObject } from 'src/types/rdmObject';
import { uniqueArray } from './uniqueArray';

/**
 * Get field name from a rdm field string
 */
export function fieldName(str: string): string {
  return str.substring(str.indexOf('.') + 1);
}

/**
 * Get entity name from a rdm entity string
 */
export function entityName(str: string): string {
  return str.split('.')[0];
}

/**
 * Get field names array from an array of rdm field strings
 */
export function fieldsArray(array: string[]): string[] {
  return array
    .filter((v) => !/{{.*}}/.test(v))
    .map((v) => fieldName(v))
    .filter(uniqueArray);
}

/**
 * Get entity names array from an array of rdm entities strings
 */
export function entitiesArray(array: string[]): string[] {
  return array
    .filter((v) => !/{{.*}}/.test(v))
    .map((v) => entityName(v))
    .filter(uniqueArray);
}

/**
 * Gets the value being assigned to a column. Example:
 *
 * Input:
 * ```
 *   table: 'track'
 *   column: 'name'
 *   rdmObject: {
 *     input: { type: 'json', path: 'example.json' },
 *     output: {
 *       type: 'database',
 *       tables: { track: { name: '_.title' } }
 *     }
 *   }
 * ```
 *
 * Output:
 * ```
 *   { template: null, table: '_', column: 'title' }
 * ```
 */
export function columnValue(
  table: string,
  column: string,
  rdmObject: RdmObject
): { template: string | null; table: string; column: string } {
  const value = rdmObject.output.database!.tables[table].set[column];
  return {
    template: templateFromValue(value),
    table: entityName(value),
    column: fieldName(value),
  };
}

/**
 * Gets the template from a field value. Returns null if string does not contain
 * a template. Example:
 *
 * Input:
 * ```
 * '{{true}}'
 * ```
 *
 * Output:
 * ```
 * true
 * ```
 */
export function templateFromValue(value: string): string | null {
  return /{{.*}}/.test(value) ? value.replace(/{|}/g, '') : null;
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
  rdmObject: RdmObject
): string {
  const column = entityName(value);
  const alias = rdmObject.output.alias?.[column];
  return alias ? value.replace(column, alias) : value;
}

export const getDependentsFromTable = (
  tableName: string,
  rdmObject: RdmObject
): { table: string; column: string }[] => {
  const { tables } = rdmObject.output.database!;
  return Object.keys(tables)
    .filter((key) => key !== tableName)
    .flatMap((key) =>
      Object.keys(tables[key].set)
        .filter((column) => tables[key].set[column].startsWith(`${tableName}.`))
        .map((column) => ({ table: key, column }))
    );
};
