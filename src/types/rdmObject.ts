type InputType = 'csv' | 'json';
type OutputType = 'database';
export type MergeType = 'insert' | 'update' | 'upsert';

export type RdmTable = {
  set: Record<string, string>;
  strategy?: MergeType;
  uniqueConstraint?: string[];
};

export type RdmObject = {
  name: string;
  description: string;
  source: string;
  input: {
    type: InputType;
    path: string;
  };
  output: {
    type: OutputType;
    tables: {
      [tableName: string]: RdmTable;
    };
  };
};
