import cron from 'node-cron';
import dotenv from 'dotenv';
import { RdmObject } from './types/rdmObject';
import { executeSteps } from './steps/executeSteps';

dotenv.config();

const PRINT_ERROR_STACK_TRACE = process.env.PRINT_ERROR_STACK_TRACE === 'true';

export async function applyDataTransfer(rdmFilePath: string): Promise<void> {
  try {
    const rdmObject = getRdmObject(rdmFilePath);

    if (rdmObject.cron) {
      cron.schedule(rdmObject.cron, () => {
        executeSteps(rdmObject.steps, rdmFilePath).then(() =>
          console.info(new Date(), 'The data has been migrated successfully!')
        );
      });
      console.info(new Date(), 'Task scheduled');
    } else {
      await executeSteps(rdmObject.steps, rdmFilePath);
      console.info(new Date(), 'The data has been migrated successfully!');
    }
  } catch (err) {
    if (PRINT_ERROR_STACK_TRACE) {
      console.error(err);
    } else {
      console.error(`Error: ${(err as Error).message}`);
    }
  }
}

/**
 * Gets the RDM Object from the current directory
 */
function getRdmObject(rdmFilePath: string): RdmObject {
  try {
    return require(`${rdmFilePath}/rdm.json`) as RdmObject;
  } catch (err) {
    throw new Error('rdm.json not found in the current working directory');
  }
}
