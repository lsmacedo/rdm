export const createCtesPostgreSql = (data: {
  ctes: {
    name: string;
    operationType: string;
    innerSql: string;
  }[];
}) => {
  const { ctes } = data;

  // with "cte1" as (... returning *), "cte2" as (... [returning *]), ...
  return ctes.map((cte, index) => {
    const returning = cte.operationType === 'insert' ? 'returning *' : '';
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
      const { type, table, on } = join;
      return `
      ${type} join "${selectPrefix}${table}" on
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
    ? `on conflict (${onConflict.on.map((on) => `"${on}"`).join(', ')}) do ${
        onConflict.action
      }`
    : '';
  const onConflictSetSql =
    onConflict?.action === 'update'
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
