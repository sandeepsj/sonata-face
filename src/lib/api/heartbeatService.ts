/**
 * Heartbeat Service
 * Keeps backend connection alive by periodically pinging health endpoint
 */

import { API_CONFIG } from './config';

export class HeartbeatService {
  /**
   * Send heartbeat ping to backend with timeout
   */
  static async ping(): Promise<boolean> {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEARTBEAT}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Failed due to timeout, network error, or other issues
      return false;
    }
  }
}
