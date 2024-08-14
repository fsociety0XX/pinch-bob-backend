/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable import/prefer-default-export */
import { customAlphabet } from 'nanoid';

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

// Function to convert UTC to SGT
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
  // Convert the date string from UTC to SGT
  const sgtDateTime = convertUTCToSGT(dateString);

  // Extract start and end times from the time string
  const [startTime, endTime] = timeString.split(' - ');

  // Function to convert 12-hour time format to 24-hour format
  function convertTo24Hour(time: string): [number, number] {
    const [timePart, modifier] = time.split(/(am|pm)/i);
    // eslint-disable-next-line prefer-const
    let [hours, minutes] = timePart.split(':').map(Number);

    if (modifier.toLowerCase() === 'pm' && hours < 12) {
      hours += 12;
    }
    if (modifier.toLowerCase() === 'am' && hours === 12) {
      hours = 0;
    }

    return [hours, minutes || 0];
  }

  // Parse the start time and set it in SGT
  const [startHours, startMinutes] = convertTo24Hour(startTime.trim());
  const afterDateTime = new Date(sgtDateTime);
  afterDateTime.setHours(startHours, startMinutes, 0, 0);

  // Parse the end time and set it in SGT
  const [endHours, endMinutes] = convertTo24Hour(endTime.trim());
  const beforeDateTime = new Date(sgtDateTime);
  beforeDateTime.setHours(endHours, endMinutes, 0, 0);

  return { beforeDateTime, afterDateTime };
}

export const generateOrderId = (): string => {
  const alphabet = '0123456789';
  const nanoid = customAlphabet(alphabet, 6);
  return nanoid();
};
