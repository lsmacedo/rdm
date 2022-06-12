import dotenv from 'dotenv';
import { Client } from 'pg';
import { DatabaseStep, Table } from '../../types/rdmObject';
import { getPostgresClient } from '../../repositories/postgresql/db';
import {
  createCtesPostgreSql,
  getTableTypesPostgreSql,
  insertFromSelectPostgreSql,
  OnConflictAction,
  QueryType,
  selectFromValuesPostgreSql,
  updateFromSelectPostgreSql,
} from '../../repositories/postgresql/queries';
import {
  columnName,
  columnValue,
  tableName,
  tablesArray,
  templateFromValue,
} from '../../utils/rdmObjectUtils';
import { topologicalSort } from '../../utils/topologicalSort';
import { uniqueArray } from '../../utils/uniqueArray';
import { format } from 'sql-formatter';

dotenv.config();

const PRINT_QUERY_SQL = process.env.PRINT_QUERY_SQL === 'true';
const PRINT_QUERY_VALUES = process.env.PRINT_QUERY_VALUES === 'true';
const PRINT_DATASET_COLUMNS = process.env.PRINT_DATASET_COLUMNS === 'true';
const PRINT_DATASET_ROWS = process.env.PRINT_DATASET_ROWS === 'true';
const PRINT_AFFECTED_ROWS = process.env.PRINT_AFFECTED_ROWS === 'true';

export async function saveInDatabase(
  database: DatabaseStep,
  responses: Record<string, any>
): Promise<void> {
  const { url } = database!;

  // Validations
  if (!url) {
    throw new Error('Property "url" is required for step of type database');
  }
  if (!database.tables) {
    throw new Error('Property "tables" is required for step of type database');
  }

  // Get column types from database tables
  const client = await getPostgresClient(url);
  const tables = getTables(database, responses);
  const columnsTypes = await getColumnsTypes(tables, responses, client);

  // List of required columns from dataset rows
  const requiredColumns = getRequiredColumns(database, responses);

  // Sort columns of responses rows based on required columns
  // Also filter out columns that don't have all expected keys
  const rows = sortKeysFromResponses(responses, requiredColumns);
  if (rows.length === 0) {
    throw new Error('No valid rows found in dataset');
  }

  // Insert data using CTEs
  const ctePrefix = 'cte_';
  const ctes = createCtesPostgreSql({
    ctes: [
      // Select required columns values into a CTE
      {
        name: `${ctePrefix}_`,
        type: QueryType.select,
        // Select the data that other entities depend on
        innerSql: selectFromValuesPostgreSql({
          columns: requiredColumns,
          rowsCount: rows.length,
          columnsTypes: columnsTypes,
        }),
      },
      // For each table...
      ...tables.map((table) => ({
        name: `${ctePrefix}${table.name}`,
        type:
          table.data.strategy === 'update'
            ? QueryType.update
            : QueryType.insert,
        innerSql: getCteInnerSqlForTable({
          table,
          tables,
          ctePrefix,
          database,
          responses,
        }),
      })),
    ],
  });
  const sql = `
    ${ctes.join('')}
    select 1
    `;
  // Logging
  if (PRINT_QUERY_SQL) {
    try {
      console.log('query sql:', format(sql, { language: 'postgresql' }));
    } catch (err) {
      console.log(sql);
    }
  }
  if (PRINT_QUERY_VALUES) {
    console.log(
      'query values:',
      rows.flatMap((row: any) => Object.values(row))
    );
  }
  if (PRINT_DATASET_COLUMNS) {
    console.log('dataset columns:', requiredColumns);
  }
  if (PRINT_DATASET_ROWS) {
    console.log('dataset rows:', rows);
  }
  // Execute SQL
  await client.query(
    sql,
    rows.flatMap((row: any) => Object.values(row))
  );
}

/**
 * Get the tables from the RDM object sorted by their dependencies.
 */
function getTables(
  database: DatabaseStep,
  responses: Record<string, any>
): { name: string; data: Table }[] {
  // TODO: validate input from RDM file against SQL injection

  // Sort tables
  const tableNames = [
    ...Object.keys(responses),
    ...Object.keys(database.tables!),
  ];
  const sortedTables = sortTablesByDependencies(tableNames, database);
  const partialArray = sortedTables.map((name) => {
    const data = database.tables![name] || { set: {} };
    return { name, data };
  });
  return partialArray.filter(
    ({ name }) => !Object.keys(responses).includes(name)
  );
}

/**
 * Sort the tables by their dependencies.
 */
function sortTablesByDependencies(
  tables: string[],
  database: DatabaseStep
): string[] {
  // Get object in the necessary format for the topologicalSort function
  const obj = tables.reduce((acc, cur) => {
    const dependencies = tablesArray(
      Object.values(database.tables![cur]?.set || {})
    );
    return { ...acc, [cur]: dependencies };
  }, {});

  console.log(obj);

  // Execute topological sort
  const sortedTables = topologicalSort(tables, obj);

  // Check for cycles
  const missingTables = tables.filter((table) => !sortedTables.includes(table));
  if (missingTables.length) {
    throw new Error(
      `There was an error processing the following tables: [${missingTables.join(
        ', '
      )}]. This can be caused by cyclic dependencies or invalid configuration.`
    );
  }

  return sortedTables;
}

/**
 * Get column types from database tables
 */
async function getColumnsTypes(
  tables: { name: string; data: Table }[],
  responses: Record<string, any>,
  client: Client
): Promise<Record<string, string>> {
  const tableNames = tables
    .filter(({ name }) => !Object.keys(responses).includes(name))
    .map(({ name }) => name);
  const { rows } = await client.query(getTableTypesPostgreSql(tableNames));
  return tables
    .map((table) => ({
      table: table,
      keys: Object.keys(table.data.set),
      values: Object.values(table.data.set),
    }))
    .reduce(
      (acc, table) => ({
        ...acc,
        ...table.keys.reduce(
          (acc, key, index) => ({
            ...acc,
            [`${table.values[index]}`]: rows.find(
              ({ table_name, column_name }) =>
                table_name === table.table.name && key === column_name
            ).data_type,
          }),
          {}
        ),
      }),
      {}
    );
}

/**
 * Get list of required columns from database step
 */
function getRequiredColumns(
  database: DatabaseStep,
  responses: Record<string, any>
): string[] {
  const tables = database.tables!;
  return Object.keys(tables)
    .flatMap((table) =>
      Object.values(tables[table].set).filter((value) =>
        Object.keys(responses).includes(tableName(value))
      )
    )
    .filter(uniqueArray);
}

/**
 * Sort columns of responses rows based on required columns
 * Also filter out columns that don't have all expected keys
 */
function sortKeysFromResponses(
  responses: Record<string, any>,
  requiredColumns: string[]
): Record<string, any> {
  return Object.keys(responses)
    .flatMap((table) =>
      responses[table].map((value: any) =>
        Object.keys(value).reduce(
          (acc, key) => ({
            ...acc,
            [`${table}.${key}`]: value[key],
          }),
          {}
        )
      )
    )
    .map((row) =>
      Object.keys(row)
        .filter((key) => requiredColumns.includes(key))
        .sort((a, b) => requiredColumns.indexOf(a) - requiredColumns.indexOf(b))
        .reduce((acc, key) => ({ ...acc, [key]: row[key] }), {})
    )
    .filter((row) => Object.keys(row).length === requiredColumns.length);
}

/**
 * Generates CTE SQL for inserting/upserting/updating data
 */
function getCteInnerSqlForTable(data: {
  table: { name: string; data: Table };
  tables: { name: string; data: Table }[];
  ctePrefix: string;
  database: DatabaseStep;
  responses: Record<string, any>;
}): string {
  const { table, tables, ctePrefix, database, responses } = data;
  // Insert into table the columns to be assigned
  const insert = { table: table.name, columns: Object.keys(table.data.set) };
  // Select the data to be assigned to it (distinct on the unique keys)
  const select = {
    tablePrefix: ctePrefix,
    table: '_',
    columns: Object.values(table.data.set).map((field) => ({
      template: templateFromValue(field),
      table: tableName(field, responses),
      column: columnName(field, responses),
    })),
    distinctOn: table.data.uniqueConstraint?.map((key) =>
      columnValue(table.name, key, database, responses)
    ),
  };
  // Join other tables required for the assignments
  const joins = Object.values(table.data.set)
    .map((value) =>
      Object.keys(responses).includes(value)
        ? value.split('.').slice(0, 2).join('.')
        : tableName(value)
    )
    .filter(uniqueArray)
    .filter((dependency) => !Object.keys(responses).includes(dependency))
    .map((dependency) => ({
      table: dependency,
      // Join on unique keys from dependencies
      on: tables
        // Get the Entity object for the dependency
        .find((entity) => entity.name === dependency)!
        // Get the unique keys for the dependency
        .data.uniqueConstraint!.map((column) => {
          const value = columnValue(dependency, column, database, responses);
          return { column, value };
        }),
    }));
  // If inserting/upserting, set onConflict
  const onConflict =
    ['insert', 'upsert'].includes(table.data.strategy!) &&
    !table.data.failIfExists
      ? {
          on: table.data.uniqueConstraint!,
          action:
            table.data.strategy === 'upsert'
              ? OnConflictAction.update
              : OnConflictAction.nothing,
          update: Object.keys(table.data.set),
        }
      : undefined;

  switch (table.data.strategy) {
    case 'insert':
    case 'upsert':
      return insertFromSelectPostgreSql({
        insert,
        select,
        joins,
        onConflict,
      });
    case 'update':
      return updateFromSelectPostgreSql({
        update: { table: table.name },
        set: Object.keys(table.data.set).map((key) => ({
          column: key,
          value: {
            template: templateFromValue(table.data.set[key]),
            table: tableName(table.data.set[key], responses),
            column: columnName(table.data.set[key], responses),
          },
        })),
        select,
        joins,
        uniqueKeys: table.data.uniqueConstraint!,
      });
    default:
      throw new Error(
        `Invalid value provided for strategy for table ${table.name}`
      );
  }
}
