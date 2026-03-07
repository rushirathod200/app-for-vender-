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
}

export interface LoginResult {
  message: string;
  token: string | null;
  user: AuthUser | null;
}
