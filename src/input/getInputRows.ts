import { getApiData } from './api/api';
import { parseCsvString, readCsvFile } from './file/csv';
import { RdmObject } from '../../src/types/rdmObject';
import { flattenObjectToArrayOfRows } from '../../src/utils/flattenObjectToArrayOfRows';

const URL_REGEX =
  /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

/**
 * Calls the appropriate function to read the dataset rows.
 */
export async function readDatasetRows(
  input: RdmObject['input']
): Promise<Record<string, string>[]> {
  const { type, path } = input;

  const remote = URL_REGEX.test(path);
  const apiData = remote ? await getApiData(input) : null;

  switch (type) {
    case 'csv':
      return apiData
        ? parseCsvString(apiData)
        : readCsvFile(`./datasets/${path}`);
    case 'json':
      return flattenObjectToArrayOfRows(
        apiData ?? require(`../datasets/${path}`)
      ) as Record<string, string>[];
    default:
      throw new Error('Dataset type not supported');
  }
}
