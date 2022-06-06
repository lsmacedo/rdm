# rdm - RDM Dataset Mapper

RDM is an open-source dataset mapper. It intends to help developers mapping data from external sources into their database.

# Quick Start

> :warning: This is a work in progress. **Do not use it in production unless you know what you're doing!**

RDM is not yet ready for general use. Although a Command Line Interface isn't implemented at the moment, it's still possible to test it with simple CSV files. The required steps are described below:

1. First of all, clone the repository and cd to it's directory.

```shell
git clone https://github.com/lsmacedo/rdm
cd rdm
```

2. Create a `.env` file based on the `.env.example` and set your database url in DATABASE_URL
3. Install dependencies and then run `prisma generate`
4. Add a dataset in the `/datasets` directory (only .csv extension is supported right now),
5. Create a RDM file in the `/maps` directory. For that, copy the `local.example.json` example and update it according to your dataset columns and your database's data model.
6. Run `yarn dev` (or `npm run dev`) in the root directory.

# RDM File

The RDM file maps a dataset into a database. It holds configurations about the entities (tables) to update, the value to assign to each column and also the merge strategy.

Check out the description below for each supported properties of the RDM file.

## name

**Type**: `string`

**Content**: Fill this with a name to help you identify the dataset. This metadata is not used by RDM.

**Example**: `Country Capitals`

## description

**Type**: `string`

**Content**: Fill this with a better description of the dataset. This metadata is not used by RDM.

**Example**: `List of countries and their capitals`

## source

**Type**: `string`

**Content**: Fill this with information or a URL from where you got the dataset. This metadata is not used by RDM.

**Example**: `https://github.com/icyrockcom/country-capitals/blob/master/data/country-list.csv`

## type

**Type**: `string`

**Content**: Fill this the type of dataset to be mapped. This is used by RDM to understand how to search for the dataset.

**Possible values**: `local` (for dataset files stored locally in your machine)

**Example**: `local`

## path

**Type**: `string`

**Content**: Fill this with the relative path of the dataset to be mapped.

**Example**: `example.csv`

> Note: Local datasets are always stored inside the `/datasets` directory, so there's no need to include it in the path.

## entities

**Type**: `string[]`

**Content**: Fill this array with the names of the entities from your database that are going to get data from this dataset.

**Example**: `["country", "city"]`

## fields

**Type**: `Record<string, string>`

**Content**: Fill this object with a list of assignments to your entities listed in the `entities` property, assuming each row from the dataset as `_`. For example, if you want the property `country` from the dataset to be mapped to your `name` column from the `country` table, use: `"country.name": "_.country"`. It is also possible to make assignments to values from your database as in the following example: `"country.capital": "city.id"`.

**Example**:

```json
{
  "country.name": "_.country",
  "country.capital": "city.id",
  "city.name": "_.capital"
}
```

> Note: There's no need to declare the entities or fields in a specified order, just be careful not to include any cyclic dependency on entities from your database.

## merge

**Type**: `object`

**Content**: Fill this object with information on how to merge data for each entity from your database. The keys from this property should be the entity names, and the value should include `strategy` and `on` properties. The `on` property refers to a list of columns from the table that should be used as unique identifiers during the upsert. It is important to make sure that there should be a unique constraint in the database for those columns.

**Example**:

```json
{
  "country": {
    "strategy": "upsert",
    "on": ["name"]
  },
  "city": {
    "strategy": "upsert",
    "on": ["name"]
  }
}
```
