import axios from 'axios';
import { RdmObject } from '../../types/rdmObject';
import { flattenObjectToArrayOfRows } from '../../utils/flattenObjectToArrayOfRows';
import { parseCsvString } from '../../utils/parseCsvString';

export async function getApiData(
  http: RdmObject['input']['http'],
  rdmObject: RdmObject
) {
  const { url, method, headers, body, params, responseType } = http!;

  // Validate response type
  if (responseType !== 'csv' && responseType !== 'json') {
    throw new Error('Response type must be either csv or json');
  }

  // Replace params from url
  const formattedUrl = Object.keys(params || {}).reduce(
    (acc, key) => acc.replace(`:${key}`, params![key]),
    url
  );

  // Make HTTP request
  let response;
  try {
    response = await axios[method](formattedUrl, { headers, body });
  } catch (err) {
    throw new Error('Error in API request');
  }

  // Parse and return the response data
  switch (responseType) {
    case 'csv':
      return parseCsvString(response.data);
    case 'json':
      return flattenObjectToArrayOfRows(response.data, '.', rdmObject);
  }
}
