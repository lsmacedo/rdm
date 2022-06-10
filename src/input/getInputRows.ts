import { getApiData } from './api/getApiData';
import { getFileData } from './file/getFileData';
import { RdmObject } from '../../src/types/rdmObject';

/**
 * Calls the appropriate function to read the dataset rows.
 */
export async function readDatasetRows(
  input: RdmObject['input'],
  rdmFilePath: string
): Promise<Record<string, string>[]> {
  const { file, http } = input;
  const response = await Promise.all(
    Object.keys(input).map(async (type) => {
      switch (type) {
        case 'http':
          return getApiData(http);
        case 'file': {
          return getFileData(file, rdmFilePath);
        }
        default:
          throw new Error(`Invalid input type "${type}"`);
      }
    })
  );
  return response.flat();
}
