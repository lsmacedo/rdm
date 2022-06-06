export type MergeType = 'insert' | 'update' | 'upsert';

export type RdmObject = {
  name: string;
  description: string;
  source: string;
  type: 'local';
  path: string;
  entities: string[];
  // TODO: create new type for fields instead of string
  fields: {
    [key: string]: string;
  };
  merge: {
    [key: string]: {
      strategy: MergeType;
      on: string[];
    };
  };
};
