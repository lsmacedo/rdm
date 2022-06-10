// Input Types
export const inputFormats = ['csv', 'json'] as const;
export const apiRequestMethods = ['get', 'post', 'put', 'delete'] as const;

// Output Types
type OutputType = 'database';
export type MergeType = 'insert' | 'update' | 'upsert';

export type RdmTable = {
  set: Record<string, string>;
  strategy?: MergeType;
  failIfExists?: boolean;
  uniqueConstraint?: string[];
};

export type RdmObject = {
  name: string;
  description: string;
  source: string;
  input: {
    file?: { path: string };
    http?: {
      url: string;
      method: typeof apiRequestMethods[number];
      responseType: typeof inputFormats[number];
      headers?: { [key: string]: string };
      body?: { [key: string]: string };
      params?: { [key: string]: string };
    };
  };
  output: {
    alias?: { [key: string]: string };
    database?: {
      url: string;
      tables: { [tableName: string]: RdmTable };
    };
  };
};
