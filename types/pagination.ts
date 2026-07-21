export interface ListOptions {
  page: number;
  pageSize: number;
  search?: string;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
