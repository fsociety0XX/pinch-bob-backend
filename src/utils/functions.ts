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

export function calculateBeforeAndAfterDateTime(
  dateString: string,
  timeString: string
): { beforeDateTime: Date; afterDateTime: Date } {
  // Parse the date string into a Date object
  const dateTime = new Date(dateString);

  // Extract start time from the time string
  const [startTime] = timeString.split(' - ');

  // Parse the start time
  const [startHours, startMinutes] = startTime.match(/\d+/g)!.map(Number);
  const afterDateTime = new Date(dateTime);
  afterDateTime.setUTCHours(startHours, startMinutes, 0, 0);

  // Set beforeDateTime to the end of the event
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, endTime] = timeString.split(' - ');
  const [endHours, endMinutes] = endTime.match(/\d+/g)!.map(Number);
  const beforeDateTime = new Date(dateTime);
  beforeDateTime.setUTCHours(endHours, endMinutes, 0, 0);

  return { beforeDateTime, afterDateTime };
}
