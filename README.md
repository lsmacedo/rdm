# RDM Dataset Mapper

`RDM` is an open-source dataset mapper. It intends to help developers transferring data from external sources into their database.

> :warning: This is a work in progress. Do **NOT** use it in production unless you know what you're doing!

# Installation

The project is currently only available in GitHub. To install it, clone the repository and install its dependencies with the package manager of your choice (here I'm using `yarn`).

```shell
git clone https://github.com/lsmacedo/rdm
cd rdm
yarn install
```

# Usage

Although `RDM` is not yet available for general use, it's already possible to test it with dataset files and HTTP requests. The required steps are described below:

1. Go to the directory of one of the example `RDM` projects, `cd examples/<project name>`
2. Replace the database connection string in `output.database.url` with your database info.
3. Execute the data transfer with `yarn rdm`

# RDM File

The `RDM File` contains configurations about a data migration. It includes specification for the input (dataset) and the output (database).

There is still no documentation as the file specification keeps changing during the initial stages of the project. Check one of the examples for reference on how to configure a `RDM File`.
