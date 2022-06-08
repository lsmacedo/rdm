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
    remote?: boolean;
    method?: 'get' | 'post' | 'put' | 'delete';
  };
  output: {
    type: OutputType;
    alias?: { [key: string]: string };
    tables: { [tableName: string]: RdmTable };
  };
};
