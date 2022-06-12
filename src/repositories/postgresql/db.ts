import { Client } from 'pg';

export const getPostgresClient = async (connectionString: string) => {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
};
