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
  const path = `${cwd}/${name}`;
  if (!dirExists(path)) {
    makeDir(path);
  }
  if (!(await isDirEmpty(path))) {
    throw new Error(
      `Destination '${name}' already exists and it is not an empty directory`
    );
  }
  await copyDirContents(templates[inputType], path);
  replaceStringInFile(`${path}/rdm.json`, '$name', name);
  console.log(`RDM project '${name}' created`);
}
