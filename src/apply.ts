import { format } from 'sql-formatter';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { getPostgresClient } from './repositories/postgresql/db';
import {
  createCtesPostgreSql,
  insertFromSelectPostgreSql,
  OnConflictAction,
  QueryType,
  selectFromValuesPostgreSql,
  updateFromSelectPostgreSql,
} from './repositories/postgresql/queries';
import { getDependentsFromTable } from './utils/rdmObjectUtils';
import { topologicalSort } from './utils/topologicalSort';
import {
  entityName,
  entitiesArray,
  fieldName,
  columnValue,
  templateFromValue,
  replaceAliasFromValue,
} from './utils/rdmObjectUtils';
import { uniqueArray } from './utils/uniqueArray';
import { readDatasetRows } from './input/getInputRows';
import { RdmObject, RdmTable } from './types/rdmObject';

dotenv.config();

const PRINT_ERROR_STACK_TRACE = process.env.PRINT_ERROR_STACK_TRACE === 'true';
const PRINT_QUERY_SQL = process.env.PRINT_QUERY_SQL === 'true';
const PRINT_QUERY_VALUES = process.env.PRINT_QUERY_VALUES === 'true';
const PRINT_DATASET_COLUMNS = process.env.PRINT_DATASET_COLUMNS === 'true';
const PRINT_DATASET_ROWS = process.env.PRINT_DATASET_ROWS === 'true';

export async function applyDataTransfer(rdmFilePath: string): Promise<void> {
  try {
    const rdmObject = getRdmObject(rdmFilePath);
    await apply(rdmFilePath, rdmObject);
    console.info(new Date(), 'The data has been migrated successfully!');

    if (rdmObject.cron) {
      cron.schedule(rdmObject.cron, () => apply(rdmFilePath, rdmObject));
      console.info(new Date(), 'Task scheduled');
    }
  } catch (err) {
    if (PRINT_ERROR_STACK_TRACE) {
      console.error(err);
    } else {
      console.error(`Error: ${(err as Error).message}`);
    }
  }
}

/**
 * Gets the RDM Object from the current directory
 */
function getRdmObject(rdmFilePath: string): RdmObject {
  try {
    return require(`${rdmFilePath}/rdm.json`) as RdmObject;
  } catch (err) {
    throw new Error('rdm.json not found in the current working directory');
  }
}

/**
 * Import data from dataset into the database.
 */
async function apply(rdmFilePath: string, rdmObject: RdmObject): Promise<void> {
  // Read from dataset
  const datasetRows = await readDatasetRows(rdmObject, rdmFilePath);

  // Get tables data from RDM object
  const [dataset, ...tables] = getTables(rdmObject);

  // List of required columns from dataset rows
  const baseColumns = getDependentsFromTable(dataset.name, rdmObject)
    .map(({ table, column }) => columnValue(table, column, rdmObject).column)
    .filter(uniqueArray);

  // Sort columns of dataset rows according to baseColumnNames
  // Also filter out columns that don't have all expected keys
  const rows = datasetRows
    .map((row) =>
      Object.keys(row)
        .filter((key) => baseColumns.includes(key))
        .sort((a, b) => baseColumns.indexOf(a) - baseColumns.indexOf(b))
        .reduce((acc, key) => ({ ...acc, [key]: row[key] }), {})
    )
    .filter((row) => Object.keys(row).length === baseColumns.length);

  if (rows.length === 0) {
    throw new Error('No valid rows found in dataset');
  }

  // Insert data using CTEs
  const ctePrefix = 'cte_';
  const ctes = createCtesPostgreSql({
    ctes: [
      // For the base entity
      {
        name: `${ctePrefix}${dataset.name}`,
        type: QueryType.select,
        // Select the data that other entities depend on
        innerSql: selectFromValuesPostgreSql({
          columns: baseColumns,
          rowsCount: rows.length,
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
          dataset,
          rdmObject,
        }),
      })),
    ],
  });
  const sql = `${ctes.join('')} select 1`;

  // Logging
  if (PRINT_QUERY_SQL) {
    console.log('query sql:', format(sql, { language: 'postgresql' }));
  }
  if (PRINT_QUERY_VALUES) {
    console.log(
      'query values:',
      rows.flatMap((row) => Object.values(row))
    );
  }
  if (PRINT_DATASET_COLUMNS) {
    console.log('dataset columns:', baseColumns);
  }
  if (PRINT_DATASET_ROWS) {
    console.log('dataset rows:', rows);
  }

  // Execute SQL
  const client = getPostgresClient(rdmObject.output.database!.url);
  await client.connect();
  await client.query(
    sql,
    rows.flatMap((row) => Object.values(row))
  );
}

/**
 * Generates CTE SQL for inserting/upserting/updating data
 */
function getCteInnerSqlForTable(data: {
  table: { name: string; data: RdmTable };
  tables: { name: string; data: RdmTable }[];
  ctePrefix: string;
  dataset: { name: string; data: RdmTable };
  rdmObject: RdmObject;
}): string {
  const { table, tables, ctePrefix, dataset, rdmObject } = data;
  // Insert into table the columns to be assigned
  const insert = { table: table.name, columns: Object.keys(table.data.set) };
  // Select the data to be assigned to it (distinct on the unique keys)
  const select = {
    tablePrefix: ctePrefix,
    table: dataset.name,
    columns: Object.values(table.data.set).map((field) => ({
      template: templateFromValue(field),
      table: entityName(field),
      column: fieldName(field),
    })),
    distinctOn: table.data.uniqueConstraint?.map((key) =>
      columnValue(table.name, key, rdmObject)
    ),
  };
  // Join other tables required for the assignments
  const joins = entitiesArray(Object.values(table.data.set))
    .filter((dependency) => dependency !== dataset.name)
    .map((dependency) => ({
      table: dependency,
      // Join on unique keys from dependencies
      on: tables
        // Get the Entity object for the dependency
        .find((entity) => entity.name === dependency)!
        // Get the unique keys for the dependency
        .data.uniqueConstraint!.map((column) => {
          const value = columnValue(dependency, column, rdmObject);
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
            table: entityName(table.data.set[key]),
            column: fieldName(table.data.set[key]),
          },
        })),
        select,
        // Join other tables required for the assignments
        joins,
        uniqueKeys: table.data.uniqueConstraint!,
      });
    default:
      throw new Error(
        `Invalid value provided for strategy for table ${table.name}`
      );
  }
}

/**
 * Get the tables from the RDM object sorted by their dependencies.
 */
function getTables(rdmObject: RdmObject): { name: string; data: RdmTable }[] {
  // TODO: validate input from RDM file against SQL injection
  const { database } = rdmObject.output;

  if (!database) {
    throw new Error('An output database is required');
  }

  // Replace alias from rdmObject
  Object.keys(database.tables).forEach((tableName) => {
    const table = database.tables[tableName];
    table.set = Object.keys(table.set).reduce(
      (acc, column) => ({
        ...acc,
        [column]: replaceAliasFromValue(table.set[column], rdmObject),
      }),
      {}
    );
  });

  // Sort tables
  const tableNames = ['_', ...Object.keys(database.tables)];
  const sortedTables = sortTablesByDependencies(tableNames, rdmObject);
  return sortedTables.map((name) => {
    const data = database.tables[name] || { set: {} };
    return { name, data };
  });
}

/**
 * Sort the tables by their dependencies.
 */
function sortTablesByDependencies(
  tables: string[],
  rdmObject: RdmObject
): string[] {
  // Get object in the necessary format for the topologicalSort function
  const obj = tables.reduce((acc, cur) => {
    const dependencies = entitiesArray(
      Object.values(rdmObject.output.database!.tables[cur]?.set || {})
    );
    return { ...acc, [cur]: dependencies };
  }, {});

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
