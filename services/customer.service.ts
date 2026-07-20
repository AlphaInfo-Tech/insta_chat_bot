import type { CustomerRepository } from '@/repositories/customer.repository';
import type { Customer } from '@/types/customer';

export class CustomerService {
  constructor(private readonly customerRepo: CustomerRepository) {}

  async getOrCreateCustomer(instagramId: string, username?: string | null): Promise<Customer> {
    return this.customerRepo.findOrCreate({ instagramId, username });
  }
}
