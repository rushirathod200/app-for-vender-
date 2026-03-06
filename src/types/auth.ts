export type UserRole = 'admin' | 'vendor' | 'customer' | string;

export interface AuthUser {
  id: number;
  name: string | null;
  mobile: string;
  role: UserRole;
  is_active?: boolean;
}

export interface SendOtpResult {
  message: string;
  devOtp?: string;
}

export interface VerifyOtpResult {
  message: string;
  token: string | null;
  user: AuthUser | null;
}
