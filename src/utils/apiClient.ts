import { FullPatientData } from '@/types/patient';
//import { config } from '@config/environment';
import { config } from '../config/environment';



/**
 * Utility to check if an error is network-related
 */
function isNetworkError(error: Error): boolean {
  const networkErrorMessages = [
    'Failed to fetch',
    'Network Error',
    'NetworkError when attempting to fetch resource',
    'Load failed',
    'network error',
    'Connection failed',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET'
  ];

  return networkErrorMessages.some(msg =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * Fetch with retries and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 sec timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      console.warn(`Attempt ${attempt} failed: ${err.message}`);

      if (attempt === maxRetries || !isNetworkError(err)) {
        throw err; // not retryable or retries exhausted
      }

      // exponential backoff delay
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(res => setTimeout(res, waitTime));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Submit collected patient data to the Pega API.
 */
export async function submitPatientData(data: FullPatientData): Promise<any> {
  try {
    console.log('Submitting patient data to Pega API:', JSON.stringify(data, null, 2));

    const response = await fetchWithRetry(
      config.patientApi.url,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      3, // max retries
      1000 // initial backoff delay
    );

    if (!response.ok) {
      let errMsg = `API responded with status ${response.status}`;
      try {
        const errText = await response.text();
        if (errText) errMsg += `: ${errText}`;
      } catch {
        /* ignore */
      }
      throw new Error(errMsg);
    }

    // Handle JSON / non-JSON / empty body responses gracefully
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const rawText = await response.text();
      return rawText.trim() ? JSON.parse(rawText) : { success: true, message: 'Patient created successfully' };
    } else {
      return { success: true, message: 'Patient created successfully' };
    }
  } catch (error) {
    console.error('Error submitting patient data:', error);
    throw error;
  }
}
