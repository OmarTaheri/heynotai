export type PocketRecord = {
  id: string;
  collectionId?: string;
  collectionName?: string;
  created?: string;
  updated?: string;
  expand?: Record<string, PocketRecord>;
  [key: string]: unknown;
};

export type StoreActor = {
  id: string;
  email?: string;
  systemRole?: string;
  system_role?: string;
  role?: string;
  [key: string]: unknown;
};

export type ListOptions = {
  filter?: string;
  sort?: string;
  expand?: string;
  fields?: string;
  requestKey?: string | null;
};

export type ListResult<T extends PocketRecord = PocketRecord> = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
};

export class StoreError extends Error {
  response: { code: string; message: string; data?: Record<string, unknown> };

  constructor(
    public status: number,
    public code: string,
    message: string,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "StoreError";
    this.response = { code, message, data };
  }
}

