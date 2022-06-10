import path from 'path';

const templates: Record<string, string> = {
  file: path.join(__dirname, './file'),
  http: path.join(__dirname, './http'),
};

const inputTypes = Object.keys(templates);

export type InputType = typeof inputTypes[number];

export default templates;
