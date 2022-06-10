import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { initRdmObject } from './init';
import { applyDataTransfer } from './apply';
import templates, { InputType } from './templates';

// Handle command line arguments
yargs(hideBin(process.argv))
  .command(
    'init',
    'Initializes a new RDM project',
    (yargs) => {
      return yargs
        .positional('name', {
          alias: 'n',
          describe: 'name of the project',
          default: 'rdm',
        })
        .positional('input-type', {
          alias: 'it',
          describe: 'input type',
          default: 'file',
          choices: Object.keys(templates),
        });
    },
    ({ _, name, inputType }) => {
      const cwd = _[1] as string;
      initRdmObject(name, inputType as InputType, cwd);
    }
  )
  .command(
    'apply',
    'Executes a data transfer',
    (yargs) => yargs,
    ({ _ }) => {
      const cwd = _[1] as string;
      return applyDataTransfer(cwd);
    }
  )
  .parseAsync();
