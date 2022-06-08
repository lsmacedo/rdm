import { stringify } from 'querystring';
import { RdmObject } from 'src/types/rdmObject';
import { uniqueArray } from './uniqueArray';

/**
 * Get field name from a rdm field string
 */
export function fieldName(str: string): string {
  return str.split('.')[1];
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

export function columnValue(
  table: string,
  column: string,
  rdmObject: RdmObject
): { template: string | null; table: string; column: string } {
  const value = rdmObject.output.tables[table].set[column];
  return {
    template: templateFromValue(value),
    table: entityName(value),
    column: fieldName(value),
  };
}

export function templateFromValue(value: string): string | null {
  return /{{.*}}/.test(value) ? value.replace(/{|}/g, '') : null;
}

export function replaceAliasFromValue(
  value: string,
  rdmObject: RdmObject
): string {
  const column = entityName(value);
  const alias = rdmObject.output.alias?.[column];
  return alias ? value.replace(`${column}.`, alias) : value;
}
