import { RdmObject } from './rdmObject';

export const getDependentsFromTable = (
  tableName: string,
  rdmObject: RdmObject
): { table: string; column: string }[] => {
  const { tables } = rdmObject.output;
  return Object.keys(tables)
    .filter((key) => key !== tableName)
    .flatMap((key) =>
      Object.keys(tables[key].set)
        .filter((column) => tables[key].set[column].startsWith(`${tableName}.`))
        .map((column) => ({ table: key, column }))
    );
};
