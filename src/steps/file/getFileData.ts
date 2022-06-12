import { readCsvFile } from './csv';
import { flattenObjectToArrayOfRows } from '../../utils/flattenObjectToArrayOfRows';
import { FileStep } from '../../types/rdmObject';

export function getFileData(
  file: FileStep,
  expectedColumns: string[],
  rdmFilePath: string
): Promise<Record<string, string>[]> {
  // Validate params
  if (!file.path) {
    throw new Error('Property "path" is required for type file');
  }

  // Get file type from path string
  const fileType = file.path.slice(file.path.lastIndexOf('.') + 1);

  // Full path of the file
  const fullPath = `${rdmFilePath}/${file.path}`;

  // Read, parse and return file
  switch (fileType) {
    case 'csv':
      return readCsvFile(fullPath);
    case 'json':
      return Promise.resolve(
        flattenObjectToArrayOfRows(require(fullPath), expectedColumns)
      );
    default:
      throw new Error('Dataset type not supported');
  }
}
