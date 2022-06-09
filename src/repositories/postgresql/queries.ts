import { uniqueArray } from '../../utils/uniqueArray';

export enum QueryType {
  select,
  insert,
  update,
  delete,
}

export enum OnConflictAction {
  update = 'update',
  nothing = 'nothing',
}

export const createCtesPostgreSql = (data: {
  ctes: {
    name: string;
    type: QueryType;
    innerSql: string;
  }[];
}) => {
  const { ctes } = data;

  // with "cte1" as (... returning *), "cte2" as (... [returning *]), ...
  return ctes.map((cte, index) => {
    const returning = cte.type !== QueryType.select ? 'returning *' : '';
    if (index === 0) {
      return `with "${cte.name}" as (${cte.innerSql} ${returning})`;
    } else {
      return `, "${cte.name}" as (${cte.innerSql} ${returning})`;
    }
  });
};

export const selectFromValuesPostgreSql = (data: {
  columns: string[];
  rowsCount: number;
}) => {
  const { columns, rowsCount } = data;

  // select "column1", "column2"
  // from (values ($1, $2), ($3, $4), ...) as s("column1", "column2")
  return `
    select ${columns.map((column) => `"${column}"`).join(', ')}
    from (
      values
      ${[...Array(rowsCount)]
        .map(
          (row, rowIndex) =>
            `(${columns
              .map(
                (column, columnIndex) =>
                  `$${rowIndex * columns.length + columnIndex + 1}`
              )
              .join(', ')})`
        )
        .join(', ')}
    )
    as s(${columns.map((column) => `"${column}"`).join(', ')})
  `;
};

export const insertFromSelectPostgreSql = (data: {
  insert: {
    table: string;
    columns: string[];
  };
  select: {
    tablePrefix?: string;
    table: string;
    columns: { template: string | null; table: string; column: string }[];
    distinctOn?: { template: string | null; table: string; column: string }[];
  };
  joins?: {
    table: string;
    on: { column: string; value: { table: string; column: string } }[];
  }[];
  onConflict?: {
    on: string[];
    update: string[];
    action: OnConflictAction;
  };
}) => {
  // Get input data
  const { insert, select, joins, onConflict } = data;
  const selectPrefix = select.tablePrefix ?? '';

  // insert into "table1" ("column1", "column2")
  const insertSql = `
    insert into "${insert.table}" (${insert.columns
    .map((column) => `"${column}"`)
    .join(', ')})
  `;

  // select [distinct on ("table2"."column1")] "table2.column1", "table2.column2" from "table2"
  const distinct = select.distinctOn?.length
    ? `distinct on (${select.distinctOn
        .filter(({ template }) => !template)
        .map(({ table, column }) => `"${selectPrefix}${table}"."${column}"`)
        .join(', ')})`
    : '';
  const selectSql = `
    select ${distinct} ${select.columns
    .map(
      ({ template, table, column }) =>
        template ?? `"${selectPrefix}${table}"."${column}"`
    )
    .join(', ')} from "${selectPrefix}${select.table}"
  `;

  // join "table3" on "table3"."column1" = "table1"."column1" and "table3"."column2" = "table2"."column2"
  const joinSql = joins
    ?.map((join) => {
      const { table, on } = join;
      return `
      join "${selectPrefix}${table}" on
      ${on
        .map(
          ({ column, value }) =>
            `"${selectPrefix}${table}"."${column}" = "${selectPrefix}${value.table}"."${value.column}"`
        )
        .join(' and ')}`;
    })
    .join('\n');

  // on conflict ("column1", "column2") do [update set "column1" = excluded."column1"][nothing]
  const onConflictSql = onConflict?.on?.length
    ? `on conflict (${onConflict.on
        .map((on) => `"${on}"`)
        .join(', ')}) do ${onConflict.action.valueOf()}`
    : '';
  const onConflictSetSql =
    onConflict?.action === OnConflictAction.update
      ? `set ${onConflict.update
          .map((column) => `"${column}" = excluded."${column}"`)
          .join(', ')}`
      : '';
  return `
    ${insertSql}
    ${selectSql}
    ${joinSql}
    ${onConflictSql}
    ${onConflictSetSql}
  `;
};

export const updateFromSelectPostgreSql = (data: {
  update: {
    table: string;
  };
  set: {
    column: string;
    value: { template: string | null; table: string; column: string };
  }[];
  select: {
    tablePrefix?: string;
    table: string;
    columns: { template: string | null; table: string; column: string }[];
    distinctOn?: { template: string | null; table: string; column: string }[];
  };
  joins?: {
    table: string;
    on: { column: string; value: { table: string; column: string } }[];
  }[];
  uniqueKeys: string[];
}) => {
  // Get input data
  const { update, set, select, joins, uniqueKeys } = data;
  const selectPrefix = select.tablePrefix ?? '';

  // update "table1"
  const updateSql = `update "${update.table}"`;

  // set "column1" = s."table2_columnA", "column2" = s."table2_columnB"
  const setSql = `
    set ${set
      .map(
        ({ column, value }) =>
          `"${column}" = s."${value.table}_${value.column}"`
      )
      .join(', ')}
  `;

  // join "table3" on "table3"."column1" = "table1"."column1" and "table3"."column2" = "table2"."column2"
  const joinSql = joins
    ?.map((join) => {
      const { table, on } = join;
      return `
      join "${selectPrefix}${table}" on
      ${on
        .map(
          ({ column, value }) =>
            `"${selectPrefix}${table}"."${column}" = "${selectPrefix}${value.table}"."${value.column}"`
        )
        .join(' and ')}`;
    })
    .join('\n');

  // from (select [distinct on ("table2"."column1")] "table2.column1", "table2.column2" from "table2") s
  const distinct = select.distinctOn?.length
    ? `distinct on (${select.distinctOn
        .filter(({ template }) => !template)
        .map(({ table, column }) => `"${selectPrefix}${table}"."${column}"`)
        .join(', ')})`
    : '';
  const selectSql = `from (select ${distinct} ${select.columns
    .map(
      ({ template, table, column }) =>
        template ??
        `"${selectPrefix}${table}"."${column}" as "${table}_${column}"`
    )
    .join(', ')} from "${selectPrefix}${select.table}" ${joinSql}) s
  `;

  // where "table1"."column1" = s."table2__columnA"
  const whereSql = `
    where ${uniqueKeys
      .map((key) => {
        const { value } = set.find(({ column }) => column === key)!;
        return `
        "${update.table}"."${key}" = s."${value.table}_${value.column}"
      `;
      })
      .join(' and ')}
  `;

  return `
    ${updateSql}
    ${setSql}
    ${selectSql}
    ${whereSql}
  `;
};
