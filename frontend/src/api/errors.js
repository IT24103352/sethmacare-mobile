import axios from 'axios';

const TIMEOUT_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

const getConfiguredHost = (error) =>
  error?.config?.baseURL || error?.config?.url || 'the configured API server';

const getApiErrorMessage = (
  error,
  fallbackMessage = 'Something went wrong. Please try again.'
) => {
  const responseMessage = error?.response?.data?.message;

  if (responseMessage) {
    return responseMessage;
  }

  if (axios.isAxiosError(error)) {
    const message = error.message || '';

    if (TIMEOUT_ERROR_CODES.has(error.code) || message.toLowerCase().includes('timeout')) {
      return 'Timeout: the API server did not respond in time. It may be asleep or unreachable.';
    }

    if (!error.response) {
      return `Network Error: unable to reach ${getConfiguredHost(error)}.`;
    }

    if (message) {
      return message;
    }
  }

  return error?.message || fallbackMessage;
};

export default getApiErrorMessage;
