import { parse } from 'csv';
import fs from 'fs';

/**
 * Reads a CSV file and returns an array of rows
 */
export function readCsvFile(path: string): Promise<Record<string, string>[]> {
  const columnNames: string[] = [];
  return new Promise((resolve) => {
    const array = [] as Record<string, string>[];
    fs.createReadStream(path)
      .pipe(parse({ delimiter: ',', from_line: 1 }))
      .on('data', (row: string[]) => {
        // First row from dataset has column names
        if (!columnNames.length) {
          columnNames.push(...row);
          return;
        }
        array.push(
          row.reduce(
            (acc, cur, index) => ({ ...acc, [columnNames[index]]: cur }),
            {}
          )
        );
      })
      .on('end', () => {
        resolve(array);
      });
  });
}
