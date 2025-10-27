/**
 * Heartbeat Service
 * Keeps backend connection alive by periodically pinging health endpoint
 */

import { API_CONFIG } from './config';

export class HeartbeatService {
  /**
   * Send heartbeat ping to backend
   */
  static async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEARTBEAT}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
