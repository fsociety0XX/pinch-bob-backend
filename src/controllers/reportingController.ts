// /* eslint-disable  */
// // controllers/reportingController.ts
// import { Request, Response } from 'express';
// import mongoose from 'mongoose';
// import Order from '../models/orderModel'; // adjust path
// import { parse } from 'csv-parse/sync';

// const {
//   Types: { ObjectId },
// } = mongoose;

// // Helper: pull a value from a CSV row by trying multiple header names
// const pick = (row: Record<string, any>, names: string[]) => {
//   for (const n of names) {
//     if (n in row && row[n] != null && row[n] !== '') return row[n];
//     const lc = n.toLowerCase();
//     for (const key of Object.keys(row)) {
//       if (key.toLowerCase() === lc && row[key] != null && row[key] !== '') {
//         return row[key];
//       }
//     }
//   }
//   return undefined;
// };

// // Normalize textual statuses to a compact form
// const normalizeStatus = (s?: string) => {
//   const v = (s || '').toLowerCase().trim();
//   if (!v) return undefined;
//   if (['paid', 'completed', 'succeeded', 'success'].includes(v))
//     return 'completed';
//   if (['refunded', 'partially refunded'].includes(v)) return 'refunded';
//   if (['failed', 'declined'].includes(v)) return 'failed';
//   if (['pending', 'authorized', 'authorised'].includes(v)) return 'pending';
//   return v;
// };

// /**
//  * Parse HitPay "Completed" timestamp as Singapore time (+08:00) and return a UTC Date.
//  * Accepts:
//  *  - separate "Completed Date" + "Completed Time"
//  *  - "YYYY-MM-DD HH:mm[:ss]"
//  *  - "DD/MM/YYYY HH:mm[:ss]"
//  *  - already-ISO strings
//  */
// const parseHitpayCompletedDate = (
//   dateRaw?: any,
//   timeRaw?: any
// ): Date | undefined => {
//   const clean = (v: any) => (v == null ? '' : String(v).trim());
//   const dStr = clean(dateRaw);
//   const tStr = clean(timeRaw);

//   if (dStr && tStr) {
//     let m = dStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
//     if (m) {
//       const dd = m[1].padStart(2, '0');
//       const mm = m[2].padStart(2, '0');
//       const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
//       const iso = `${yyyy}-${mm}-${dd}T${tStr.padStart(5, '0')}${
//         tStr.length === 5 ? ':00' : ''
//       }+08:00`;
//       const d = new Date(iso);
//       return isNaN(d.getTime()) ? undefined : d;
//     }
//     m = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
//     if (m) {
//       const iso = `${dStr}T${tStr.padStart(5, '0')}${
//         tStr.length === 5 ? ':00' : ''
//       }+08:00`;
//       const d = new Date(iso);
//       return isNaN(d.getTime()) ? undefined : d;
//     }
//   }

//   const one = dStr || tStr;
//   if (!one) return undefined;

//   let m = one.match(
//     /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
//   );
//   if (m) {
//     const [_, yyyy, mm, dd, hh, mi, ss] = m;
//     const iso = `${yyyy}-${mm}-${dd}T${hh.padStart(2, '0')}:${mi}:${
//       ss ? ss : '00'
//     }+08:00`;
//     const d = new Date(iso);
//     return isNaN(d.getTime()) ? undefined : d;
//   }

//   m = one.match(
//     /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
//   );
//   if (m) {
//     const dd = m[1].padStart(2, '0');
//     const mm = m[2].padStart(2, '0');
//     const yyyy = (m[3].length === 2 ? '20' + m[3] : m[3]).padStart(4, '0');
//     const hh = m[4].padStart(2, '0');
//     const mi = m[5];
//     const ss = m[6] ? m[6] : '00';
//     const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`;
//     const d = new Date(iso);
//     return isNaN(d.getTime()) ? undefined : d;
//   }

//   const d = new Date(one);
//   return isNaN(d.getTime()) ? undefined : d;
// };

// /**
//  * POST /admin/hitpay/backfill-payment-dates
//  * Body: multipart/form-data with a single file field "file" (CSV exported from HitPay)
//  */
// export const backfillHitpayPaymentDates = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     if (!req.file?.buffer) {
//       return res
//         .status(400)
//         .json({ ok: false, message: "Upload a CSV in 'file' field." });
//     }

//     const rows: Record<string, any>[] = parse(req.file.buffer, {
//       columns: true,
//       skip_empty_lines: true,
//       relax_column_count: true,
//       bom: true,
//       trim: true,
//     });

//     let considered = 0;
//     const ops: any[] = [];
//     const missing: any[] = [];
//     const badDates: any[] = [];

//     for (const row of rows) {
//       considered++;

//       // Identifiers from CSV
//       const paymentRequestId = pick(row, [
//         'Payment Request ID',
//         'Payment Request',
//         'payment_request_id',
//         'Request ID',
//         'ID',
//       ]);
//       const transactionId = pick(row, [
//         'Transaction ID',
//         'Charge ID',
//         'Payment ID',
//         'payment_id',
//         'charge_id',
//         'Additional Reference',
//       ]);
//       const referenceNumber = pick(row, [
//         'Reference Number',
//         'reference_number',
//         'Reference',
//         'Order Number',
//         'orderNumber',
//       ]);

//       // NEW: HitPay "Order ID" column that may be either your orderNumber or your MongoDB _id
//       const orderIdCsv = pick(row, ['Order ID', 'order_id', 'OrderId']);

//       // Completed/Paid timestamps
//       const completedDate = pick(row, ['Completed Date', 'Paid Date', 'Date']);
//       const completedTime = pick(row, ['Completed Time', 'Paid Time', 'Time']);
//       const singleCompleted = pick(row, [
//         'Completed At',
//         'Completed Datetime',
//         'Paid At',
//         'Paid at',
//         'paid_at',
//         'Payment Date',
//         'created_at',
//       ]);

//       const statusRaw = pick(row, ['Status', 'Payment Status', 'status']);

//       const paymentDate =
//         parseHitpayCompletedDate(completedDate, completedTime) ||
//         parseHitpayCompletedDate(singleCompleted);

//       if (!paymentDate) {
//         badDates.push({
//           paymentRequestId,
//           transactionId,
//           referenceNumber,
//           orderIdCsv,
//           completedDate,
//           completedTime,
//           singleCompleted,
//         });
//       }

//       const status = normalizeStatus(statusRaw);

//       const set: Record<string, any> = {};
//       if (paymentDate) set['hitpayDetails.paymentDate'] = paymentDate;
//       if (status) set['hitpayDetails.status'] = status;
//       if (status === 'completed') set['paid'] = true;

//       if (Object.keys(set).length === 0) {
//         continue; // nothing to write for this row
//       }

//       // Build robust OR filters
//       const filters: any[] = [];

//       // Primary: HitPay webhook/payment id you've stored
//       if (paymentRequestId) {
//         const pr = String(paymentRequestId);
//         filters.push({ 'hitpayDetails.paymentRequestId': pr });
//         // (Optional legacy) sometimes saved as `hitpayDetails.id`
//         filters.push({ 'hitpayDetails.id': pr });
//       }

//       // Secondary: Stripe/processor charge id you've stored
//       if (transactionId) {
//         filters.push({ 'hitpayDetails.transactionId': String(transactionId) });
//       }

//       // Your own order number if present in CSV as “Reference Number” or similar
//       if (referenceNumber) {
//         filters.push({ orderNumber: String(referenceNumber) });
//       }

//       // NEW: “Order ID” in CSV can be either orderNumber or MongoDB _id
//       if (orderIdCsv) {
//         const oidStr = String(orderIdCsv).trim();
//         // Try as your orderNumber
//         filters.push({ orderNumber: oidStr });
//         // Try as Mongo ObjectId
//         if (ObjectId.isValid(oidStr)) {
//           filters.push({ _id: new ObjectId(oidStr) });
//         }
//       }

//       if (!filters.length) {
//         missing.push({
//           reason: 'no-identifiers',
//           sample: {
//             paymentRequestId,
//             transactionId,
//             referenceNumber,
//             orderIdCsv,
//           },
//         });
//         continue;
//       }

//       ops.push({
//         updateOne: {
//           filter: { $or: filters },
//           update: { $set: set },
//           upsert: false,
//         },
//       });
//     }

//     let matched = 0,
//       modified = 0;

//     if (ops.length) {
//       const r = await Order.bulkWrite(ops, { ordered: false });
//       // @ts-ignore
//       matched = r.matchedCount ?? r.result?.nMatched ?? 0;
//       // @ts-ignore
//       modified = r.modifiedCount ?? r.result?.nModified ?? 0;
//     }

//     return res.json({
//       ok: true,
//       considered,
//       attemptedUpdates: ops.length,
//       matched,
//       modified,
//       missingCount: missing.length,
//       missingSamples: missing.slice(0, 10),
//       badDateCount: badDates.length,
//       badDateSamples: badDates.slice(0, 10),
//       note: 'Matched by (paymentRequestId | legacy hitpayDetails.id) → transactionId → orderNumber → CSV Order ID as orderNumber/_id. Parsed Completed Date/Time as SG (+08:00), wrote hitpayDetails.paymentDate (UTC), normalized status/paid.',
//     });
//   } catch (err: any) {
//     console.error('Backfill error:', err);
//     return res
//       .status(500)
//       .json({ ok: false, message: err?.message || 'Internal error' });
//   }
// };

/* eslint-disable  */
// controllers/reportingController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import Order from '../models/orderModel';
import CustomiseCake from '../models/customiseCakeModel';

const {
  Types: { ObjectId },
} = mongoose;

/* ----------------------------- helpers ------------------------------ */

const pick = (row: Record<string, any>, names: string[]) => {
  for (const n of names) {
    if (n in row && row[n] != null && row[n] !== '') return row[n];
    const lc = n.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lc && row[key] != null && row[key] !== '') {
        return row[key];
      }
    }
  }
  return undefined;
};

const normalizeStatus = (s?: string) => {
  const v = (s || '').toLowerCase().trim();
  if (!v) return undefined;
  if (['paid', 'completed', 'succeeded', 'success'].includes(v))
    return 'completed';
  if (['refunded', 'partially refunded'].includes(v)) return 'refunded';
  if (['failed', 'declined'].includes(v)) return 'failed';
  if (['pending', 'authorized', 'authorised'].includes(v)) return 'pending';
  return v;
};

/**
 * Parse HitPay "Completed" timestamp as Singapore time (+08:00) and return a UTC Date.
 * Accepts:
 *  - separate "Completed Date" + "Completed Time"
 *  - "YYYY-MM-DD HH:mm[:ss]"
 *  - "DD/MM/YYYY HH:mm[:ss]"
 *  - already-ISO strings
 */
const parseHitpayCompletedDate = (
  dateRaw?: any,
  timeRaw?: any
): Date | undefined => {
  const clean = (v: any) => (v == null ? '' : String(v).trim());
  const dStr = clean(dateRaw);
  const tStr = clean(timeRaw);

  if (dStr && tStr) {
    // DD/MM/YYYY
    let m = dStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
      const iso = `${yyyy}-${mm}-${dd}T${tStr.padStart(5, '0')}${
        tStr.length === 5 ? ':00' : ''
      }+08:00`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? undefined : d;
    }
    // YYYY-MM-DD
    m = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const iso = `${dStr}T${tStr.padStart(5, '0')}${
        tStr.length === 5 ? ':00' : ''
      }+08:00`;
      const d = new Date(iso);
      return isNaN(d.getTime()) ? undefined : d;
    }
  }

  const one = dStr || tStr;
  if (!one) return undefined;

  // YYYY-MM-DD HH:mm[:ss]
  let m = one.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    const [_, yyyy, mm, dd, hh, mi, ss] = m;
    const iso = `${yyyy}-${mm}-${dd}T${hh.padStart(2, '0')}:${mi}:${
      ss ? ss : '00'
    }+08:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? undefined : d;
  }

  // DD/MM/YYYY HH:mm[:ss]
  m = one.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = (m[3].length === 2 ? '20' + m[3] : m[3]).padStart(4, '0');
    const hh = m[4].padStart(2, '0');
    const mi = m[5];
    const ss = m[6] ? m[6] : '00';
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? undefined : d;
  }

  const d = new Date(one);
  return isNaN(d.getTime()) ? undefined : d;
};

/* ----------------------------- controller ---------------------------- */

export const backfillHitpayPaymentDates = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.file?.buffer) {
      return res
        .status(400)
        .json({ ok: false, message: "Upload a CSV in 'file' field." });
    }

    const rows: Record<string, any>[] = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true,
    });

    type PendingResolve = {
      filtersForOrder: any[];
      setDoc: Record<string, any>;
      // purely for debug visibility:
      dbg?: {
        paymentRequestId?: any;
        transactionId?: any;
        referenceNumber?: any;
        orderIdCsv?: any;
      };
    };

    let considered = 0;

    const orderOps: any[] = [];
    const customiseOps: any[] = [];
    const missing: any[] = [];
    const badDates: any[] = [];

    // entries where we couldn't directly determine orderNumber but still want to update CustomiseCake/Order by the shared orderNumber
    const pendingForOrderNumber: PendingResolve[] = [];

    for (const row of rows) {
      considered++;

      // Identifiers from CSV
      const paymentRequestId = pick(row, [
        'Payment Request ID',
        'Payment Request',
        'payment_request_id',
        'Request ID',
        'ID',
      ]);
      const transactionId = pick(row, [
        'Transaction ID',
        'Charge ID',
        'Payment ID',
        'payment_id',
        'charge_id',
        'Additional Reference',
      ]);
      const referenceNumber = pick(row, [
        'Reference Number',
        'reference_number',
        'Reference',
        'Order Number',
        'orderNumber',
      ]);
      const orderIdCsv = pick(row, ['Order ID', 'order_id', 'OrderId']); // could be orderNumber OR Mongo _id

      // Completed/Paid time (prefer the split date/time if present)
      const completedDate = pick(row, ['Completed Date', 'Paid Date', 'Date']);
      const completedTime = pick(row, ['Completed Time', 'Paid Time', 'Time']);
      const singleCompleted = pick(row, [
        'Completed At',
        'Completed Datetime',
        'Paid At',
        'Paid at',
        'paid_at',
        'Payment Date',
        'created_at',
      ]);
      const statusRaw = pick(row, ['Status', 'Payment Status', 'status']);

      const paymentDate =
        parseHitpayCompletedDate(completedDate, completedTime) ||
        parseHitpayCompletedDate(singleCompleted);

      if (!paymentDate) {
        badDates.push({
          paymentRequestId,
          transactionId,
          referenceNumber,
          orderIdCsv,
          completedDate,
          completedTime,
          singleCompleted,
        });
      }

      const status = normalizeStatus(statusRaw);

      const setDoc: Record<string, any> = {};
      if (paymentDate) setDoc['hitpayDetails.paymentDate'] = paymentDate;
      if (status) setDoc['hitpayDetails.status'] = status;
      if (status === 'completed') setDoc['paid'] = true;

      if (Object.keys(setDoc).length === 0) {
        // nothing to update for this row
        continue;
      }

      // -------- Build robust OR filters for Order (and also used for resolution later) --------
      const filtersForOrder: any[] = [];

      if (paymentRequestId) {
        const pr = String(paymentRequestId);
        filtersForOrder.push({ 'hitpayDetails.paymentRequestId': pr });
        // legacy key, just in case:
        filtersForOrder.push({ 'hitpayDetails.id': pr });
      }
      if (transactionId) {
        filtersForOrder.push({
          'hitpayDetails.transactionId': String(transactionId),
        });
      }
      if (referenceNumber) {
        filtersForOrder.push({ orderNumber: String(referenceNumber) });
      }
      if (orderIdCsv) {
        const oidStr = String(orderIdCsv).trim();
        // try as orderNumber
        filtersForOrder.push({ orderNumber: oidStr });
        // try as Mongo _id
        if (ObjectId.isValid(oidStr)) {
          filtersForOrder.push({ _id: new ObjectId(oidStr) });
        }
      }

      // ---- Phase 1: direct updates when we already know where to write ----
      // 1) Update Order when any filter is available
      if (filtersForOrder.length) {
        orderOps.push({
          updateOne: {
            filter: { $or: filtersForOrder },
            update: { $set: setDoc },
            upsert: false,
          },
        });
      } else {
        // keep debug of truly missing identifiers
        missing.push({
          reason: 'no-identifiers',
          sample: {
            paymentRequestId,
            transactionId,
            referenceNumber,
            orderIdCsv,
          },
        });
      }

      // 2) If we already have an explicit orderNumber (e.g., "Reference Number" present),
      //    we can directly update CustomiseCake by orderNumber too.
      if (referenceNumber) {
        customiseOps.push({
          updateOne: {
            filter: { orderNumber: String(referenceNumber) },
            update: { $set: setDoc },
            upsert: false,
          },
        });
      } else {
        // We don't know orderNumber yet, but we still want to update CustomiseCake.
        // Defer: we will try to resolve orderNumber from Order or CustomiseCake by the same filters.
        if (filtersForOrder.length) {
          pendingForOrderNumber.push({
            filtersForOrder,
            setDoc,
            dbg: {
              paymentRequestId,
              transactionId,
              referenceNumber,
              orderIdCsv,
            },
          });
        }
      }
    }

    /* ---------------- Phase 2: resolve orderNumber when it wasn't provided ---------------- */

    // De-duplicate identical filter-sets to avoid repeated queries
    const serialized = new Map<string, PendingResolve[]>();
    for (const p of pendingForOrderNumber) {
      const key = JSON.stringify(p.filtersForOrder);
      if (!serialized.has(key)) serialized.set(key, []);
      serialized.get(key)!.push(p);
    }

    if (serialized.size) {
      for (const [key, entries] of serialized.entries()) {
        const filtersForOrder = JSON.parse(key);

        // 1) Try to resolve orderNumber from Orders (preferred)
        let orderNumberResolved: string | undefined;

        const ord = await Order.findOne(
          { $or: filtersForOrder },
          { orderNumber: 1 }
        ).lean();
        if (ord?.orderNumber) {
          orderNumberResolved = ord.orderNumber;
        }

        // 2) If not found in Orders, try CustomiseCake with the SAME keys
        if (!orderNumberResolved) {
          const cust = await CustomiseCake.findOne(
            { $or: filtersForOrder },
            { orderNumber: 1 }
          ).lean();
          if (cust?.orderNumber) {
            orderNumberResolved = cust.orderNumber;
          }
        }

        if (!orderNumberResolved) {
          // nothing else we can do for this group
          continue;
        }

        // 3) With the resolved shared orderNumber, update BOTH collections
        for (const entry of entries) {
          customiseOps.push({
            updateOne: {
              filter: { orderNumber: orderNumberResolved },
              update: { $set: entry.setDoc },
              upsert: false,
            },
          });

          orderOps.push({
            updateOne: {
              filter: { orderNumber: orderNumberResolved },
              update: { $set: entry.setDoc },
              upsert: false,
            },
          });
        }
      }
    }

    /* ------------------------- bulk writes & response ------------------------- */

    let orderMatched = 0,
      orderModified = 0,
      customiseMatched = 0,
      customiseModified = 0;

    if (orderOps.length) {
      const r = await Order.bulkWrite(orderOps, { ordered: false });
      // @ts-ignore
      orderMatched = r.matchedCount ?? r.result?.nMatched ?? 0;
      // @ts-ignore
      orderModified = r.modifiedCount ?? r.result?.nModified ?? 0;
    }

    if (customiseOps.length) {
      const r = await CustomiseCake.bulkWrite(customiseOps, { ordered: false });
      // @ts-ignore
      customiseMatched = r.matchedCount ?? r.result?.nMatched ?? 0;
      // @ts-ignore
      customiseModified = r.modifiedCount ?? r.result?.nModified ?? 0;
    }

    return res.json({
      ok: true,
      considered,
      attemptedUpdates: orderOps.length + customiseOps.length,
      order: { matched: orderMatched, modified: orderModified },
      customiseCake: { matched: customiseMatched, modified: customiseModified },
      missingCount: missing.length,
      missingSamples: missing.slice(0, 10),
      badDateCount: badDates.length,
      badDateSamples: badDates.slice(0, 10),
      note: 'Matched by (paymentRequestId | legacy hitpayDetails.id) → transactionId → orderNumber → CSV Order ID (orderNumber/_id). Parsed Completed Date/Time as SG (+08:00), wrote hitpayDetails.paymentDate (UTC), normalized status/paid. When only CustomiseCake had the match, orderNumber was resolved and both collections were updated.',
    });
  } catch (err: any) {
    console.error('Backfill error:', err);
    return res
      .status(500)
      .json({ ok: false, message: err?.message || 'Internal error' });
  }
};
