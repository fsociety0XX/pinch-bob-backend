/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable import/prefer-default-export */
interface FetchOptions {
  method: string;
  headers?: { [key: string]: string };
  body?: string | FormData;
}

export const fetchAPI = (
  url: string,
  method: string,
  body?: object | []
): Promise<Response> => {
  const options: FetchOptions = {
    method,
    headers: {
      Authorization: process.env.WOODELIVERY_API_KEY!,
      'Content-Type': 'application/json',
    },
  };
  if (method === 'POST') {
    options.body = JSON.stringify(body);
  }
  return fetch(url, options);
};
