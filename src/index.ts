import { format } from 'sql-formatter';
import { v4 } from 'uuid';
import prisma from './prisma';
import json from '../maps/local.template.json';
import { MergeType, RdmObject } from './types/rdmObject';
import { readCsv } from './utils/readCsv';
import { topologicalSort } from './utils/topologicalSort';
import {
  entityName,
  entitiesArray,
  fieldName,
  fieldsArray,
} from './utils/rdmObjectUtils';
import {
  createCtesPostgreSql,
  createTemporaryTablePostgreSql,
  insertFromSelectPostgreSql,
  insertMultipleRowsPostgreSql,
} from './repositories/postgresql/queries';

type Entity = {
  name: string;
  assignments: Record<string, string>;
  dependents: Record<string, string>;
  uniqueKeys: string[];
  mergeStrategy: MergeType;
};

/**
 * Import data from a dataset into database.
 */
async function importDataset(): Promise<void> {
  // Read dataset and RDM file
  const datasetRows = await readDatasetRows(`./datasets/${json.path}`);
  const rdmObject = json as RdmObject;

  // Get entities data from RDM object
  const entities = getEntitiesData(rdmObject);

  // Create temporary table with columns from dataset
  const tempTableName = `_rdm_${v4()}`;
  await createTemporaryTable(entities, tempTableName);

  // Insert data using CTEs
  const baseColumnNames = fieldsArray(Object.values(entities[0].dependents));
  const ctes = createCtesPostgreSql({
    ctes: [
      // Insert into temporary table the data that other entities depend on
      // and return it
      {
        name: '__',
        innerSql: insertMultipleRowsPostgreSql({
          tableName: tempTableName,
          columnNames: baseColumnNames,
          rows: datasetRows.map((row) =>
            Object.keys(row)
              .filter((key) => baseColumnNames.includes(key))
              .sort(
                (a, b) =>
                  baseColumnNames.indexOf(a) - baseColumnNames.indexOf(b)
              )
              .map((key) => row[key])
          ),
        }),
      },
      // Insert into table the data that it needs to assign
      // Select the data that it needs to assign
      // From __
      // Join other dependencies
      // Return the data that others depend on
      ...entities.slice(1).map((entity) => ({
        name: `_${entity.name}`,
        innerSql: insertFromSelectPostgreSql({
          insertTableName: entity.name,
          insertColumns: fieldsArray(Object.keys(entity.assignments)),
          selectTableName: '__',
          selectColumns: Object.values(entity.assignments).map((field) => ({
            table: `_${entityName(field)}`,
            column: fieldName(field),
          })),
          selectDistinctOn: entity.uniqueKeys.map((key) => {
            const field = rdmObject.fields[`${entity.name}.${key}`];
            return { table: `_${entityName(field)}`, column: fieldName(field) };
          }),
          joins: entitiesArray(Object.values(entity.assignments))
            .filter((dependency) => dependency !== '_')
            .sort(
              (a, b) =>
                entities.map((e) => e.name).indexOf(a) -
                entities.map((e) => e.name).indexOf(b)
            )
            .map((dependency) => ({
              type: 'inner',
              tableName: `_${dependency}`,
              on: entities
                .find((entity) => entity.name === dependency)!
                .uniqueKeys.map((field) => {
                  const other = rdmObject.fields[`${dependency}.${field}`];
                  return {
                    column: field,
                    value: {
                      table: `_${entityName(other)}`,
                      column: fieldName(other),
                    },
                  };
                }),
            })),
          onConflict: {
            on: entity.uniqueKeys,
            action: entity.mergeStrategy === 'upsert' ? 'update' : 'nothing',
            set: fieldsArray(Object.keys(entity.assignments)).map((field) => ({
              column: field,
              value: {
                table: 'excluded',
                column: field,
              },
            })),
          },
        }),
      })),
    ],
  });

  // Execute SQL
  const sql = `
    ${ctes.join('')}
    select 1 from ${entities[entities.length - 1]?.name}
  `;
  console.log(format(sql, { language: 'postgresql' }));
  await prisma.$executeRawUnsafe(sql);
}

async function createTemporaryTable(
  entities: Entity[],
  tableName: string
): Promise<void> {
  // TODO: infer type or add new property to RdmObject type
  const baseColumnNames = fieldsArray(Object.values(entities[0].dependents));
  const columns = baseColumnNames.map((name) => ({ name, type: 'text' }));

  await prisma.$executeRawUnsafe(
    createTemporaryTablePostgreSql({ tableName, columns })
  );
}

function readDatasetRows(path: string): Promise<Record<string, string>[]> {
  if (path.endsWith('.csv')) {
    return readCsv(path);
  } else {
    throw new Error('Dataset type not supported');
  }
}

function getEntitiesData(rdmObject: RdmObject): Entity[] {
  const entityNames = ['_', ...Object.values(rdmObject.entities)];
  return sortEntitiesByDependencies(
    entityNames.map((name) => {
      const assignments = Object.keys(rdmObject.fields)
        .filter((key) => key.startsWith(`${name}.`))
        .reduce(
          (acc, key) => ({ ...acc, [key]: rdmObject.fields[key] }),
          {} as Record<string, string>
        );
      const dependents = Object.keys(rdmObject.fields)
        .filter((key) => rdmObject.fields[key].startsWith(`${name}.`))
        .reduce(
          (acc, key) => ({ ...acc, [key]: rdmObject.fields[key] }),
          {} as Record<string, string>
        );
      const uniqueKeys = rdmObject.merge[name]?.on ?? [];
      const mergeStrategy = rdmObject.merge[name]?.strategy ?? 'upsert';
      return {
        name,
        assignments,
        dependents,
        uniqueKeys,
        mergeStrategy,
      };
    })
  );
}

function sortEntitiesByDependencies(entities: Entity[]): Entity[] {
  // Get object in the necessary format for the topologicalSort function
  const names = entities.map((e) => e.name);
  const obj = entities.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.name]: entitiesArray(Object.values(cur.assignments)),
    }),
    {}
  );

  // Execute topological sort
  const result = topologicalSort(names, obj);

  // Check for cycles
  if (result.length !== entities.length) {
    throw new Error('Cyclic dependency detected');
  }

  return result.map((n) => entities.find((e) => e.name === n)!);
}

importDataset().then(() => {});
