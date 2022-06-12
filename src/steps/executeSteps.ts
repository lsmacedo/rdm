import { getHttpData } from './http/getHttpData';
import { getFileData } from './file/getFileData';
import { FileStep, HttpStep, Step, stepTypes } from '../types/rdmObject';
import {
  columnName,
  processObject,
  tableColumnRegex,
  tableName,
  urlRegex,
} from '../utils/rdmObjectUtils';
import { uniqueArray } from '../utils/uniqueArray';
import { saveInDatabase } from './database/saveInDatabase';

function getExpectedColumns(table: string, value: any): string[] {
  if (!value || !['string', 'object'].includes(typeof value)) {
    return [];
  }
  if (typeof value === 'string') {
    const tableColumn = value.match(tableColumnRegex)?.[0];
    return tableColumn &&
      !value.match(urlRegex) &&
      tableName(tableColumn) === table
      ? [columnName(value)]
      : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v) => getExpectedColumns(table, v));
  }
  return Object.keys(value).flatMap((key) =>
    getExpectedColumns(table, value[key])
  );
}

/**
 * Calls the appropriate function to execute each step.
 */
export async function executeSteps(
  steps: Step[],
  rdmFilePath: string
): Promise<void> {
  const responses: Record<string, any> = {};
  for (const index of steps.keys()) {
    const step =
      steps[index].type !== 'database'
        ? (processObject(steps[index], responses) as Step)
        : steps[index];

    // Validate step type
    if (!step.type || !stepTypes.includes(step.type)) {
      throw new Error('Invalid input');
    }

    // Get the columns that following steps expect from this one as output
    const stepName = step.name || '_';
    const expectedColumns = getExpectedColumns(
      stepName,
      steps.slice(index + 1)
    ).filter(uniqueArray);

    switch (step.type) {
      case 'http':
        responses[stepName] = await getHttpData(
          step as HttpStep,
          expectedColumns
        );
        break;
      case 'file':
        responses[stepName] = await getFileData(
          step as FileStep,
          expectedColumns,
          rdmFilePath
        );
        break;
      case 'database':
        await saveInDatabase(step, responses);
    }
  }
}
