import axios from 'axios';

import { Config } from '@/constants/Config';

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: 15000,
});

export function setApiToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Token ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
}

export function extractApiError(error: unknown, fallbackMessage: string) {
  if (!axios.isAxiosError(error)) {
    return fallbackMessage;
  }

  const responseData = error.response?.data;
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    const message = (responseData as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    const firstValue = Object.values(responseData)[0];
    if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
      return firstValue[0];
    }
    if (typeof firstValue === 'string' && firstValue.trim()) {
      return firstValue;
    }
  }

  if (error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export default api;
