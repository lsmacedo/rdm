export const stepTypes = ['file', 'http', 'database'] as const;
export const responseTypes = ['csv', 'json'] as const;
export const mergeTypes = ['insert', 'update', 'upsert'] as const;

export type FileStep = {
  path?: string;
};

export type HttpStep = {
  url?: string | string[];
  method?: typeof httpRequestMethods[number];
  responseType?: typeof responseTypes[number];
  headers?: { [key: string]: string };
  body?: { [key: string]: string };
  params?: { [key: string]: string };
};

export type DatabaseStep = {
  url?: string;
  tables?: { [tableName: string]: Table };
};

export type Table = {
  set: Record<string, string>;
  strategy?: typeof mergeTypes[number];
  failIfExists?: boolean;
  uniqueConstraint?: string[];
};

export type Step = {
  name?: string;
  type?: typeof stepTypes[number];
} & FileStep &
  HttpStep &
  DatabaseStep;

export type RdmObject = {
  cron?: string;
  steps: Step[];
};

// Deprecated

// Input Types
export const httpRequestMethods = ['get', 'post', 'put', 'delete'] as const;

export type RdmObjectInput = {
  file?: { path: string };
  http?: {
    url: string;
    method: typeof httpRequestMethods[number];
    responseType: typeof responseTypes[number];
    headers?: { [key: string]: string };
    body?: { [key: string]: string };
    params?: { [key: string]: string };
  };
};

export type RdmObjectOld = {
  input: RdmObjectInput | RdmObjectInput[];
  output: {
    alias?: { [key: string]: string };
    database?: {
      url: string;
      tables: { [tableName: string]: Table };
    };
  };
  cron?: string;
};
