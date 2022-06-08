# rdm - RDM Dataset Mapper

RDM is an open-source dataset mapper. It intends to help developers mapping data from external sources into their database.

# Quick Start

> :warning: This is a work in progress. **Do not use it in production unless you know what you're doing!**

RDM is not yet available for general use. Although a Command Line Interface isn't implemented at the moment, it's still possible to test it with simple CSV or JSON files. The required steps are described below:

1. First of all, clone the repository and cd to it's directory.

```shell
git clone https://github.com/lsmacedo/rdm
cd rdm
```

2. Create a `.env` file based on the `.env.example` and set your database url in DATABASE_URL
3. Install dependencies with yarn or npm, and then run `prisma generate`
4. Add a dataset in the `/datasets` directory
5. Create a RDM file in the `/maps` directory based in one of the example files, depending on your dataset
6. Run `yarn dev json-example` (replacing json-example with your RDM file name)

# RDM File

The RDM file maps a dataset into a database. It contains configurations about the input (dataset) and the output (database).

There is still no documentation as it may change a lot during the initial stages of the project. Check one of the examples in the `maps/` directory for reference on how RDM file configuration works.
