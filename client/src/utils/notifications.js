import toast from 'react-hot-toast';

export const getErrorMessage = (error, context = 'Something went wrong') => {
  if (typeof error === 'string' && error.trim()) {
    return `${context}: ${error}`;
  }

  const responseData = error?.response?.data;
  const validationErrors = responseData?.errors;

  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    const messages = validationErrors
      .map((item) => item?.msg || item?.message)
      .filter(Boolean);
    if (messages.length > 0) return messages.slice(0, 3).join(' ');
  }

  const serverMessage = responseData?.error || responseData?.message;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage;
  }

  if (!error?.response && (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error')) {
    return 'Unable to connect to the server. Check your connection and try again.';
  }

  const status = error?.response?.status;
  if (status) {
    const statusMessages = {
      400: 'The request contains invalid information.',
      401: 'You are not authenticated. Please sign in and try again.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested information or resource could not be found.',
      413: 'The submitted file or request is too large.',
      429: 'Too many requests. Please wait and try again.',
      500: 'The server encountered an error while processing your request.',
      502: 'The server is temporarily unavailable.',
      503: 'The service is temporarily unavailable.'
    };
    return `${context}: ${statusMessages[status] || `Request failed (HTTP ${status}).`}`;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return `${context}: ${error.message}`;
  }

  return context;
};

export const notifyError = (error, context) => {
  toast.error(getErrorMessage(error, context));
};
