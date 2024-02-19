import { Document, Query } from 'mongoose';

class APIFeatures<T extends Document> {
  query: Query<T[], T>;

  queryString: string;

  constructor(query: Query<T[], T>, queryString: string) {
    this.query = query;
    this.queryString = queryString;
  }
}

export default APIFeatures;
