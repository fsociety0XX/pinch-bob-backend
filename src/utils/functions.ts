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

export function convertUTCToSGT(utcDateString: string): Date {
  // Create a Date object from the UTC string
  const utcDate = new Date(utcDateString);

  // Get the SGT time zone offset in minutes (UTC+08:00)
  const sgtOffsetMinutes = 8 * 60;

  // Create a new Date object adjusted for SGT
  const sgtDate = new Date(utcDate.getTime() + sgtOffsetMinutes * 60 * 1000);

  return sgtDate;
}

export function calculateBeforeAndAfterDateTime(
  dateString: string,
  timeString: string
): { beforeDateTime: Date; afterDateTime: Date } {
  // Parse the date string into a Date object
  const dateTime = convertUTCToSGT(dateString);

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
