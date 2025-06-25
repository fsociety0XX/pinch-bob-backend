/* eslint-disable @typescript-eslint/ban-types */
import { format } from 'date-fns';
import { customAlphabet } from 'nanoid';
import { IAddress } from '@src/models/addressModel';
import { brandEnum } from '@src/types/customTypes';

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
  if (method === 'POST' || method === 'PUT') {
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
  const [startHours, startMinutes] = convertTo24Hour(startTime?.trim());
  const afterDateTime = new Date(sgtDateTime);
  afterDateTime.setHours(startHours, startMinutes, 0, 0);

  // Parse the end time and set it in SGT
  const [endHours, endMinutes] = convertTo24Hour(endTime?.trim());
  const beforeDateTime = new Date(sgtDateTime);
  beforeDateTime.setHours(endHours, endMinutes, 0, 0);

  return { beforeDateTime, afterDateTime };
}

export const generateUniqueIds = (): string => {
  const alphabet = '0123456789';
  const nanoid = customAlphabet(alphabet, 6);
  return nanoid();
};

// This ensures you’re matching any Date stored in MongoDB that falls between 00:00:00Z of tomorrow and just before 00:00:00Z the day after—regardless of your server’s local timezone.
export const getTomorrowUtcRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  const start = new Date(Date.UTC(year, month, day + 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, day + 2, 0, 0, 0));

  return { start, end };
};

// Returns UTC 00:00:00–00:00:00 window for “yesterday.”
export const getYesterdayUtcRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  return {
    start: new Date(Date.UTC(year, month, date - 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, date, 0, 0, 0)),
  };
};

export const getOneYearAgoWindow = (): { start: Date; end: Date } => {
  const now = new Date();
  const year = now.getUTCFullYear() - 1;
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  const start = new Date(Date.UTC(year, month, date, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, date + 1, 0, 0, 0));

  return { start, end };
};

export function formatPhoneNumber(phone: string): string {
  const trimmed = phone?.trim();
  if (trimmed.startsWith('+')) {
    return trimmed;
  }
  return `+65${trimmed}`;
}

export const formatShortDate = (d: Date): string => format(d, 'dd MMM yy');

export const formatAddress = (addr: IAddress): string => {
  const parts = [addr.address1, addr.address2, addr.city].filter(Boolean);
  return parts.join(', ');
};

export const makeStatusUrl = (brand: string, orderId: string): string => {
  const baseUrl = brand === brandEnum[0] ? 'pinchbakehouse' : 'bobthebakerboy';
  return `https://${baseUrl}.com/order/${orderId}`;
};

/**
 * Take any Date or date-string (MM/DD/YYYY, ISO, etc.)
 * and return a Date for 00:00:00 UTC of that same calendar day.
 */
export function toUtcDateOnly(input: Date | string): Date {
  // 1) Turn strings into Dates
  const tmp = typeof input === 'string' ? new Date(input) : input;

  // 2) Grab the local calendar year/month/day
  const year = tmp.getFullYear();
  const month = tmp.getMonth(); // 0-based
  const day = tmp.getDate();

  // 3) Build a UTC-midnight timestamp for that calendar day
  return new Date(Date.UTC(year, month, day, 0, 0, 0));
}
