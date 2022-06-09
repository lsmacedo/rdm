import axios from 'axios';
import { RdmObject } from 'src/types/rdmObject';

export async function getApiData(input: RdmObject['input']) {
  try {
    const { headers, body } = input.api!;
    const url = Object.keys(input.api!.params || {}).reduce(
      (acc, key) => acc.replace(`:${key}`, input.api!.params![key]),
      input.api!.url
    );
    const response = await axios[input.api!.method](url, {
      headers,
      body,
    });
    return response.data;
  } catch (err) {
    console.error(err);
    throw new Error('Error in API request');
  }
}
