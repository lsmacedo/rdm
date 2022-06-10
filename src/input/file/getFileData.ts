import { readCsvFile } from './csv';
import { flattenObjectToArrayOfRows } from '../../utils/flattenObjectToArrayOfRows';
import { RdmObject } from '../../types/rdmObject';

export function getFileData(
  file: RdmObject['input']['file'],
  rdmFilePath: string
): Promise<Record<string, string>[]> {
  const fileType = file!.path.slice(file!.path.lastIndexOf('.') + 1);

  switch (fileType) {
    case 'csv':
      return readCsvFile(`${rdmFilePath}/${file!.path}`);
    case 'json':
      return Promise.resolve(
        flattenObjectToArrayOfRows(require(`${rdmFilePath}/${file!.path}`))
      );
    default:
      throw new Error('Dataset type not supported');
  }
}
