import { Client } from 'pg';

export const getPostgresClient = (connectionString: string) => {
  return new Client({ connectionString });
};
