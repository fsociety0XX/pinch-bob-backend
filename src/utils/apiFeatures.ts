import { Document, Query } from 'mongoose';

export interface QueryString {
  [key: string]: string | string[] | undefined;
}
class APIFeatures<T extends Document> {
  query: Query<T[], T>;

  queryString: QueryString;

  constructor(query: Query<T[], T>, queryString: QueryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter(fieldName: string[]): this {
    const queryObj = { ...this.queryString };
    const paramsToExclude = ['page', 'sort', 'limit', 'fields'];
    paramsToExclude.forEach((el) => delete queryObj[el]);
    fieldName.forEach((field: string) => {
      if (queryObj[field]) {
        // PRODUCT CONTROLLER
        if (field === 'size') {
          // Special case to handle size filter in get all product API
          queryObj['sizeDetails.size'] = (queryObj[field] as string).split(',');
          delete queryObj.size;
        } else if (field === 'inventoryStatus') {
          // Special case to handle inventory status filter in get all product API for Admins
          queryObj['inventory.status'] = (queryObj[field] as string).split(',');
          delete queryObj.inventoryStatus;
        }
        // DELIVERY CONTROLLER
        else if (field === 'driverId') {
          // Special case to handle driver filter in get all delivery API
          queryObj['driverDetails.id'] = (queryObj[field] as string).split(',');
          delete queryObj.driverId;
        } else queryObj[field] = (queryObj[field] as string)?.split(',');
      }
    });
    // Advance Filtering
    let queryString = JSON.stringify(queryObj);
    // Replace operators like gte,get,lte,lt -> $gte...
    queryString = queryString.replace(
      /\b(gte|gt|lte|lt|in)\b/g,
      (match) => `$${match}`
    );
    this.query.find(JSON.parse(queryString));
    return this;
  }

  sort(): this {
    const sortBy =
      (this.queryString.sort as string)?.split(',')?.join(' ') ?? '-createdAt'; // For descending order -> add '-' symbol before field
    this.query = this.query.sort(sortBy);
    return this;
  }

  // it will send only requsted fields in response
  limit(): this {
    const showFields =
      (this.queryString.fields as string)?.split(',').join(' ') ?? '-__v'; // For removing a field from response just add '-'
    this.query = this.query.select(showFields);
    return this;
  }

  pagination(): this {
    const page = +this.queryString.page!;
    const limit = +this.queryString.limit!;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

export default APIFeatures;
