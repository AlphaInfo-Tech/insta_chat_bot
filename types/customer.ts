export interface Customer {
  id: string;
  instagramId: string;
  username: string | null;
  createdAt: string;
}

export interface CreateCustomerInput {
  instagramId: string;
  username?: string | null;
}
