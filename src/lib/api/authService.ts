/**
 * Authentication Service
 * Handles user authentication operations: signup, login, and token refresh
 */

import { API_CONFIG } from './config';
import type { SignupRequest, LoginRequest, AuthResponse } from '$lib/types/auth';

export class AuthService {
  /**
   * Register a new user
   */
  static async signup(data: SignupRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Signup failed');
    }

    return response.json();
  }

  /**
   * Login user with email and password
   */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Login failed');
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  static async refresh(refreshToken: string): Promise<AuthResponse> {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return response.json();
  }
}
