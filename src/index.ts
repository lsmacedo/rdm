import { format } from 'sql-formatter';
import { v4 } from 'uuid';
import prisma from './prisma';
import json from '../maps/local.template.json';
import { MergeType, RdmObject } from './types/rdmObject';
import { readCsv } from './utils/readCsv';
import { uniqueArray } from './utils/uniqueArray';
import { topologicalSort } from './utils/topologicalSort';
import {
  entityName,
  entitiesArray,
  fieldName,
  fieldsArray,
} from './utils/rdmObjectUtils';

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
  const ctes = entities
    .map((entity, index) => {
      if (index === 0) {
        // Insert into temporary table the data that other entities depend on
        // and return it
        return `
          with __ as (
            insert into "${tempTableName}" (${baseColumnNames.join(', ')})
            values ${datasetRows.map(
              (_, i) => `(${baseColumnNames
                .map((_, j) => `$${i * baseColumnNames.length + j + 1}`)
                .join(', ')}
                )`
            )}
            returning ${baseColumnNames.join(', ')}
          )${entities.length > 1 ? ',' : ''}`;
      } else {
        /*
          Insert into table the data that it needs to assign
          Select the data that it needs to assign
          From __
          Join other dependencies
          Return the data that others depend on
          */
        return `
          _${entity.name} as (
            insert into ${entity.name}
              (${fieldsArray(Object.keys(entity.assignments)).join(', ')})
            select distinct on (${entity.uniqueKeys
              .map((field) => {
                const f = rdmObject.fields[`${entity.name}.${field}`];
                return `_${entityName(f)}.${fieldName(f)}`;
              })
              .join(', ')})
              ${Object.values(entity.assignments)
                // TODO: implement better way to handle templates
                .map((v) => (/{{.*}}/.test(v) ? v.replace(/{{|}}/g, '') : v))
                .map((v) => `_${v}`)
                .join(', ')}
            from
              __
            ${entitiesArray(Object.values(entity.assignments))
              .filter((dependency) => dependency !== '_')
              .sort(
                (a, b) =>
                  entities.map((e) => e.name).indexOf(a) -
                  entities.map((e) => e.name).indexOf(b)
              )
              .map((dependency) => {
                const dependencyEntity = entities.find(
                  (entity) => entity.name === dependency
                );
                return `join _${dependency} on ${dependencyEntity?.uniqueKeys
                  .map(
                    (dependencyField) => `
              _${dependency}.${dependencyField} = _${
                      rdmObject.fields[`${dependency}.${dependencyField}`]
                    }`
                  )
                  .join(' and')}`;
              })
              .join('\n          ')}
            ${
              entity.uniqueKeys.length
                ? `on conflict (${entity.uniqueKeys.join(', ')})
            do
                  ${
                    entity.mergeStrategy === 'upsert'
                      ? `update set ${fieldsArray(
                          Object.keys(entity.assignments)
                        )
                          .map((key) => `${key} = excluded.${key}`)
                          .join(', ')}`
                      : 'nothing'
                  }`
                : ''
            }
            returning ${[
              ...fieldsArray(Object.values(entity.dependents)),
              ...entity.uniqueKeys,
            ]
              .filter(uniqueArray)
              .join(', ')}
          )${index === entities.length - 1 ? '' : ','}`;
      }
    })
    .join('\n');

  // Execute SQL
  const sql = `
    ${ctes}
    select 1 from ${entities[entities.length - 1]?.name}
  `;
  console.log(format(sql, { language: 'postgresql' }));
  await prisma.$executeRawUnsafe(
    sql,
    ...datasetRows.flatMap((row) =>
      baseColumnNames.map((column) => row[column])
    )
  );
}

async function createTemporaryTable(
  entities: Entity[],
  tableName: string
): Promise<void> {
  // TODO: infer type or add new property to RdmObject type
  const baseColumnNames = fieldsArray(Object.values(entities[0].dependents));
  const columns = baseColumnNames.map((value) => `${value} text`);

  await prisma.$executeRawUnsafe(
    `create temporary table "${tableName}" (${columns.join(', ')});`
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
