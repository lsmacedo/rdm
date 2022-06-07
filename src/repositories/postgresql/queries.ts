export const createTemporaryTablePostgreSql = (data: {
  tableName: string;
  columns: { name: string; type: string }[];
}) => {
  const { tableName, columns } = data;
  return `
    create temporary table
    "${tableName}"
    (${columns.map(({ name, type }) => `${name} ${type}`).join(', ')});
  `;
};

export const createCtesPostgreSql = (data: {
  ctes: { name: string; innerSql: string }[];
}) => {
  const { ctes } = data;
  return ctes.map((cte, index) => {
    if (index === 0) {
      return `with ${cte.name} as (${cte.innerSql} returning *)`;
    } else {
      return `, ${cte.name} as (${cte.innerSql} returning *)`;
    }
  });
};

export const insertRowPostgreSql = (data: {
  tableName: string;
  columns: { column: string; value: string }[];
}) => {
  const { tableName, columns } = data;
  // TODO: escape rows to prevent SQL injection
  return `
    insert into "${tableName}"
    (${columns.map(({ column }) => column).join(', ')})
    values
    (${columns.map(({ value }) => `'${value}'`).join(', ')})
  `;
};

export const insertMultipleRowsPostgreSql = (data: {
  tableName: string;
  columnNames: string[];
  rows: string[][];
}) => {
  const { tableName, columnNames, rows } = data;
  // TODO: escape rows to prevent SQL injection
  return `
    insert into "${tableName}"
    (${columnNames.join(', ')})
    values
    ${rows.map((row) => `(${row.map((r) => `'${r}'`).join(', ')})`).join(', ')}
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
    distinctOn?: { table: string; column: string }[];
  };
  joins?: {
    type: 'inner' | 'left';
    table: string;
    on: { column: string; value: { table: string; column: string } }[];
  }[];
  onConflict?: {
    on: string[];
    update: string[];
    action: 'nothing' | 'update';
  };
}) => {
  // Get input data
  const { insert, select, joins, onConflict } = data;
  const selectPrefix = select.tablePrefix ? select.tablePrefix : '';

  // insert into table1 (column1, column2)
  const insertSql = `
    insert into "${insert.table}" (${insert.columns.join(', ')})
  `;

  // select [distinct on (table2.column1)] table2.column1, table2.column2 from table2
  const distinct = select.distinctOn?.length
    ? `distinct on (${select.distinctOn
        .map(({ table, column }) => `${selectPrefix}${table}.${column}`)
        .join(', ')})`
    : '';
  const selectSql = `
    select ${distinct} ${select.columns
    .map(
      ({ template, table, column }) =>
        template ?? `${selectPrefix}${table}.${column}`
    )
    .join(', ')} from "${selectPrefix}${select.table}"
  `;

  // join table3 on table3.column1 = table1.column1 and table3.column2 = table2.column2
  const joinSql = joins
    ?.map((join) => {
      const { type, table, on } = join;
      return `
      ${type} join "${selectPrefix}${table}" on
      ${on
        .map(
          ({ column, value }) =>
            `${selectPrefix}${table}.${column} = ${selectPrefix}${value.table}.${value.column}`
        )
        .join(' and ')}`;
    })
    .join('\n');

  // on conflict (column1, column2) do [update set column1 = table1.column1][nothing]
  const onConflictSql = onConflict?.on?.length
    ? `on conflict (${onConflict.on.join(', ')}) do ${onConflict.action}`
    : '';
  const onConflictSetSql =
    onConflict?.action === 'update'
      ? `set ${onConflict.update
          .map((column) => `${column} = excluded.${column}`)
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
