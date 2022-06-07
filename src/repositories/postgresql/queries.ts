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
  insertTableName: string;
  insertColumns: string[];
  selectTableName: string;
  selectColumns: { table: string; column: string }[];
  selectDistinctOn?: { table: string; column: string }[];
  joins?: {
    type: 'left' | 'inner';
    tableName: string;
    on: { column: string; value: { table: string; column: string } }[];
  }[];
  onConflict?: {
    on: string[];
    action: 'update' | 'nothing';
    set: { column: string; value: { table: string; column: string } }[];
  };
}) => {
  const {
    insertTableName,
    insertColumns,
    selectTableName,
    selectColumns,
    selectDistinctOn,
    joins,
    onConflict,
  } = data;
  const insertSql = `
    insert into "${insertTableName}" (${insertColumns.join(', ')})
  `;
  const distinct = selectDistinctOn?.length
    ? `distinct on (${selectDistinctOn
        .map(({ table, column }) => `${table}.${column}`)
        .join(', ')})`
    : '';
  const selectSql = `
    select ${distinct} ${selectColumns
    .map(({ table, column }) => `${table}.${column}`)
    .join(', ')} from "${selectTableName}"
  `;
  const joinSql = joins
    ?.map((join) => {
      const { type, tableName, on } = join;
      return `
      ${type} join "${tableName}" on
      ${on
        .map(
          ({ column, value }) =>
            `${tableName}.${column} = ${value.table}.${value.column}`
        )
        .join(' and ')}
    `;
    })
    .join('\n');
  const set =
    onConflict?.action === 'update' && onConflict.set?.length ? 'set' : '';
  const onConflictSql = onConflict?.on?.length
    ? `
    on conflict (${onConflict.on.join(', ')}) do ${onConflict.action} ${set}
    ${onConflict.set
      .map(({ column, value }) => `${column} = ${value.table}.${value.column}`)
      .join(', ')}
  `
    : '';
  return `
    ${insertSql}
    ${selectSql}
    ${joinSql}
    ${onConflictSql}
  `;
};
