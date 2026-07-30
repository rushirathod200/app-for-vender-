export type UserRole = 'admin' | 'vendor' | 'delivery' | 'customer' | string;

export interface AuthUser {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string;
  role: UserRole;
  is_active?: boolean;
  store_open?: boolean;
  delivery_charge?: number;
  below_minimum_order_mode?: 'charge_delivery' | 'block_order' | 'free_delivery';
  minimum_order_value?: number;
  office_wallet_credit_enabled?: boolean;
}

export interface LoginResult {
  message: string;
  token: string | null;
  user: AuthUser | null;
}
