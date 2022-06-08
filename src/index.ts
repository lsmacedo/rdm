import { format } from 'sql-formatter';
import prisma from './prisma';
import { RdmObject, RdmTable } from './types/rdmObject';
import { readCsv } from './utils/readCsv';
import { topologicalSort } from './utils/topologicalSort';
import {
  entityName,
  entitiesArray,
  fieldName,
  columnValue,
  templateFromValue,
} from './utils/rdmObjectUtils';
import {
  createCtesPostgreSql,
  insertFromSelectPostgreSql,
  selectFromValuesPostgreSql,
} from './repositories/postgresql/queries';
import { flattenObjectToArrayOfRows } from './utils/flattenObjectToArrayOfRows';
import { getDependentsFromTable } from './types/rdmTable';
import axios from 'axios';

/**
 * Import data from a dataset into database.
 */
async function importDataset(): Promise<void> {
  // Parse command line arguments
  const [rdmFilePath] = process.argv.slice(2);
  if (!rdmFilePath) {
    throw new Error('Missing rdm file path');
  }

  // Read dataset and RDM file
  const json = require(`../maps/${rdmFilePath}.json`) as RdmObject;
  const datasetRows = await readDatasetRows(json.input);
  const rdmObject = json as RdmObject;

  // Get tables data from RDM object
  const [dataset, ...tables] = getTables(rdmObject);

  // List of columns from dataset rows
  const baseColumns = getDependentsFromTable(dataset.name, rdmObject).map(
    ({ table, column }) => columnValue(table, column, rdmObject).column
  );

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
        operationType: 'select',
        // Select the data that other entities depend on
        innerSql: selectFromValuesPostgreSql({
          columns: baseColumns,
          rowsCount: rows.length,
        }),
      },
      // For each table...
      ...tables.map((table) => ({
        name: `${ctePrefix}${table.name}`,
        operationType: 'insert',
        innerSql: insertFromSelectPostgreSql({
          // Insert into table the columns to be assigned
          insert: { table: table.name, columns: Object.keys(table.data.set) },
          // Select the data to be assigned to it (distinct on the unique keys)
          select: {
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
          },
          // Join other tables required for the assignments
          joins: entitiesArray(Object.values(table.data.set))
            .filter((dependency) => dependency !== dataset.name)
            .map((dependency) => ({
              type: 'inner',
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
            })),
          onConflict: {
            on: table.data.uniqueConstraint!,
            action: table.data.strategy === 'upsert' ? 'update' : 'nothing',
            update: Object.keys(table.data.set),
          },
        }),
      })),
    ],
  });

  // Execute SQL
  const sql = `
    ${ctes.join('')}
    select 1 from ${tables[tables.length - 1]?.name}
  `;
  console.log(format(sql, { language: 'postgresql' }));
  console.log(
    'Values',
    rows.flatMap((row) => Object.values(row))
  );
  await prisma.$executeRawUnsafe(
    sql,
    ...rows.flatMap((row) => Object.values(row))
  );
}

/**
 * Calls the appropriate function to read the dataset rows.
 */
async function readDatasetRows(
  input: RdmObject['input']
): Promise<Record<string, string>[]> {
  const { remote, type, path } = input;
  let data;
  if (remote) {
    const response = await axios[input.method || 'get'](path);
    data = response.data;
  }
  switch (type) {
    case 'csv':
      if (remote) {
        throw new Error('Remote CSV datasets are not yet supported');
      }
      return readCsv(`./datasets/${path}`);
    case 'json': {
      const file = data ?? require(`../datasets/${path}`);
      return Promise.resolve(
        flattenObjectToArrayOfRows(file) as Record<string, string>[]
      );
    }
    default:
      throw new Error('Dataset type not supported');
  }
}

/**
 * Get the tables from the RDM object sorted by their dependencies.
 */
function getTables(rdmObject: RdmObject): { name: string; data: RdmTable }[] {
  // TODO: validate input from RDM file against SQL injection
  const output = rdmObject.output;

  // Sort tables
  const tableNames = ['_', ...Object.keys(output.tables)];
  const sortedTables = sortTablesByDependencies(tableNames, rdmObject);
  return sortedTables.map((name) => {
    const data = output.tables[name] || { set: {} };
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
      Object.values(rdmObject.output.tables[cur]?.set || {})
    );
    return { ...acc, [cur]: dependencies };
  }, {});

  // Execute topological sort
  const sortedTables = topologicalSort(tables, obj);

  // Check for cycles
  if (sortedTables.length !== tables.length) {
    throw new Error('Cyclic dependency detected');
  }

  return sortedTables;
}

importDataset().then(() => {});
