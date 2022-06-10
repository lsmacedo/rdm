import fs from 'fs';
import fs_Extra from 'fs-extra';

export function dirExists(path: string): boolean {
  return fs.existsSync(path);
}

export function makeDir(path: string): void {
  fs.mkdirSync(path);
}

export async function isDirEmpty(path: string): Promise<boolean> {
  try {
    const files = await fs.promises.readdir(path);
    return files.length === 0;
  } catch (err) {
    if ((err as any).code === 'ENOENT') {
      return true;
    } else throw err;
  }
}

export async function copyDirContents(
  source: string,
  target: string
): Promise<void> {
  return fs_Extra.copy(source, target);
}

export function replaceStringInFile(
  filePath: string,
  str: string,
  replacement: string
): void {
  const data = fs.readFileSync(filePath, 'utf8');
  const result = data.replace(str, replacement);

  fs.writeFileSync(filePath, result, 'utf8');
}
