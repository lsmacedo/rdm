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
  valueOf,
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

  // List of columns for temporary table
  const baseColumnNames = fieldsArray(Object.values(entities[0].dependents));

  // Sort columns of dataset rows according to baseColumnNames
  const rows = datasetRows.map((row) =>
    Object.keys(row)
      .filter((key) => baseColumnNames.includes(key))
      .sort((a, b) => baseColumnNames.indexOf(a) - baseColumnNames.indexOf(b))
      .reduce((acc, key) => ({ ...acc, [key]: row[key] }), {})
  );

  // Insert data using CTEs
  const ctePrefix = 'cte_';
  const ctes = createCtesPostgreSql({
    ctes: [
      // For the temporary table
      {
        name: `${ctePrefix}${entities[0].name}`,
        // Insert the data that other entities depend on
        innerSql: insertMultipleRowsPostgreSql({
          tableName: tempTableName,
          columnNames: baseColumnNames,
          rows: rows.map((row) => Object.values(row)),
        }),
      },
      // For each table...
      ...entities.slice(1).map((entity) => ({
        name: `${ctePrefix}${entity.name}`,
        innerSql: insertFromSelectPostgreSql({
          // Insert into table the columns to be assigned
          insert: {
            table: entity.name,
            columns: fieldsArray(Object.keys(entity.assignments)),
          },
          // Select the data to be assigned to it (distinct on the unique keys)
          select: {
            tablePrefix: ctePrefix,
            table: entities[0].name,
            columns: Object.values(entity.assignments).map((field) => ({
              template: /{{.*}}/.test(field) ? field.replace(/{|}/g, '') : null,
              table: entityName(field),
              column: fieldName(field),
            })),
            distinctOn: entity.uniqueKeys.map((key) => {
              const { table, column } = valueOf(entity.name, key, rdmObject);
              return { table: table, column };
            }),
          },
          // Join other tables required for the assignments
          joins: entitiesArray(Object.values(entity.assignments))
            .filter((dependency) => dependency !== entities[0].name)
            .map((dependency) => ({
              type: 'inner',
              table: dependency,
              // Join on unique keys from dependencies
              on: entities
                // Get the Entity object for the dependency
                .find((entity) => entity.name === dependency)!
                // Get the unique keys for the dependency
                .uniqueKeys.map((field) => {
                  const value = valueOf(dependency, field, rdmObject);
                  return {
                    column: field,
                    value: { table: value.table, column: value.column },
                  };
                }),
            })),
          onConflict: {
            on: entity.uniqueKeys,
            action: entity.mergeStrategy === 'upsert' ? 'update' : 'nothing',
            update: fieldsArray(Object.keys(entity.assignments)),
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
  const entities = entityNames.map((name) => {
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
  });

  // Sort entities by their dependencies
  const sortedEntities = sortEntitiesByDependencies(entities);

  // Sort entities assignments according to the entity's dependencies
  return sortedEntities.map((entity) => ({
    ...entity,
    assignments: Object.keys(entity.assignments)
      .sort((a, b) => {
        const entityA = entityName(entity.assignments[a]);
        const entityB = entityName(entity.assignments[b]);
        return (
          sortedEntities.map((e) => e.name).indexOf(entityA) -
          sortedEntities.map((e) => e.name).indexOf(entityB)
        );
      })
      .reduce((acc, key) => ({ ...acc, [key]: entity.assignments[key] }), {}),
  }));
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
