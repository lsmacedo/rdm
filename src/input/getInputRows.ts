import { getApiData } from './api/api';
import { parseCsvString, readCsvFile } from './file/csv';
import { RdmObject } from '../../src/types/rdmObject';
import { flattenObjectToArrayOfRows } from '../../src/utils/flattenObjectToArrayOfRows';

/**
 * Calls the appropriate function to read the dataset rows.
 */
export async function readDatasetRows(
  input: RdmObject['input']
): Promise<Record<string, string>[]> {
  const { file, api } = input;

  if (!file === !api) {
    throw new Error('Exactly one value for input is required');
  }

  const apiData = api ? await getApiData(input) : null;
  const responseType = api
    ? api.responseType
    : file?.path.split('.')[file?.path.split('.').length - 1];

  switch (responseType) {
    case 'csv':
      return apiData
        ? parseCsvString(apiData)
        : readCsvFile(`./datasets/${file!.path}`);
    case 'json':
      return flattenObjectToArrayOfRows(
        apiData ?? require(`../../datasets/${file!.path}`)
      ) as Record<string, string>[];
    default:
      throw new Error('Dataset type not supported');
  }
}
