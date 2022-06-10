import { getApiData } from './api/getApiData';
import { getFileData } from './file/getFileData';
import { RdmObject } from '../../src/types/rdmObject';

/**
 * Calls the appropriate function to read the dataset rows.
 */
export async function readDatasetRows(
  rdmObject: RdmObject,
  rdmFilePath: string
): Promise<Record<string, string>[]> {
  const { file, http } = rdmObject.input;
  const response = await Promise.all(
    Object.keys(rdmObject.input).map(async (type) => {
      switch (type) {
        case 'http':
          return getApiData(http, rdmObject);
        case 'file': {
          return getFileData(file, rdmFilePath, rdmObject);
        }
        default:
          throw new Error(`Invalid input type "${type}"`);
      }
    })
  );
  return response.flat();
}
