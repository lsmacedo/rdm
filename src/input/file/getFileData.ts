import { readCsvFile } from './csv';
import root from '../../utils/root';
import { flattenObjectToArrayOfRows } from '../../utils/flattenObjectToArrayOfRows';
import { RdmObject } from '../../types/rdmObject';

export function getFileData(
  file: RdmObject['input']['file']
): Promise<Record<string, string>[]> {
  const fileType = file!.path.slice(file!.path.lastIndexOf('.') + 1);

  switch (fileType) {
    case 'csv':
      return readCsvFile(`${root}/../datasets/${file!.path}`);
    case 'json':
      return Promise.resolve(
        flattenObjectToArrayOfRows(require(`${root}/../datasets/${file!.path}`))
      );
    default:
      throw new Error('Dataset type not supported');
  }
}
