import axios from 'axios';
import { HttpStep } from '../../types/rdmObject';
import { flattenObjectToArrayOfRows } from '../../utils/flattenObjectToArrayOfRows';
import { parseCsvString } from '../../utils/parseCsvString';

export async function getHttpData(http: HttpStep, expectedColumns: string[]) {
  const { method, headers, body, params, responseType } = http!;
  const urls = [http!.url].flat();

  // Validate params
  if (responseType !== 'csv' && responseType !== 'json') {
    throw new Error('Property "responseType" must be either csv or json');
  }
  if (urls.length === 0) {
    throw new Error('Property "url" is required for step of type http');
  }
  if (!method) {
    throw new Error('Property "method" is required for step of type http');
  }

  // Make HTTP request
  const responses = await Promise.all(
    urls.map((url) => {
      try {
        if (headers?.['Content-Type'] === 'application/x-www-form-urlencoded') {
          return axios[method](url!, new URLSearchParams(body), {
            headers,
            params,
          });
        } else {
          return axios[method](url!, { headers, params, body });
        }
      } catch (err) {
        throw new Error('Error in API request');
      }
    })
  );

  // Parse and return the response data
  switch (responseType) {
    case 'csv':
      return responses.flatMap((response) => parseCsvString(response.data));
    case 'json': {
      return responses.flatMap((response) =>
        flattenObjectToArrayOfRows(response.data, expectedColumns)
      );
    }
  }
}
