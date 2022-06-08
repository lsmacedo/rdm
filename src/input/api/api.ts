import axios from 'axios';
import { RdmObject } from 'src/types/rdmObject';

export async function getApiData(input: RdmObject['input']) {
  try {
    const response = await axios[input.method || 'get'](input.path);
    return response.data;
  } catch (err) {
    console.error(err);
    throw new Error('Error in API request');
  }
}
