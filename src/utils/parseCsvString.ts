import * as CSV from 'csv-string';

/**
 * Parses a CSV string into an array of rows
 */
export function parseCsvString(csvString: string): Record<string, string>[] {
  return CSV.parse(csvString, { output: 'objects' });
}
