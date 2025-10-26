/**
 * Authentication and Authorization Types
 */

export interface SignupRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  email: string;
  // Add other user fields as needed
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}
