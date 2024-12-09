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

  filter(): this {
    const queryObj = { ...this.queryString };
    const paramsToExclude = ['page', 'sort', 'limit', 'fields'];
    paramsToExclude.forEach((el) => delete queryObj[el]);
    let queryString = JSON.stringify(queryObj);
    // Replace operators like gte,get,lte,lt -> $gte...
    queryString = queryString.replace(
      /\b(gte|gt|lte|lt)\b/g,
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
