import templates, { InputType } from './templates';
import {
  copyDirContents,
  dirExists,
  isDirEmpty,
  makeDir,
  replaceStringInFile,
} from './utils/fsUtils';

export async function initRdmObject(
  name: string,
  inputType: InputType,
  cwd: string
): Promise<void> {
  if (!dirExists(name)) {
    makeDir(name);
  }
  if (!(await isDirEmpty(name))) {
    throw new Error(
      `Destination '${name}' already exists and it is not an empty directory`
    );
  }
  await copyDirContents(templates[inputType], `${cwd}/${name}`);
  replaceStringInFile(`${cwd}/${name}/rdm.json`, '$name', name);
  console.log(`RDM project '${name}' created`);
}
