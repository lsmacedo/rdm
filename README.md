# RDM Dataset Mapper

`RDM` is an open-source dataset mapper. It intends to help developers mapping data from external sources into their database.

# Quick Start

> :warning: This is a work in progress. **Do not use it in production unless you know what you're doing!**

Although `RDM` is not yet available for general use, it's still possible to test it with files and HTTP requests. The required steps are described below:

1. First of all, clone the repository and install its dependencies.

```shell
git clone https://github.com/lsmacedo/rdm
cd rdm
yarn install
```

2. Create a `.env` file based on the `.env.example` and set your database url in `DATABASE_URL`
3. Run `yarn dev json-example` (Replace `json-example` with the name of the configuration you want to test from the `maps/` directory)

# RDM File

The `RDM File` maps a dataset into a database. It contains configurations about the input (dataset) and the output (database).

There is still no documentation as it may change a lot during the initial stages of the project. Check one of the examples in the `maps/` directory for reference on how `RDM File` configuration works.
