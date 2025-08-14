import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';
//import { submitPatientData } from '@utils/apiClient';
import { submitPatientData } from '../utils/apiClient';
import { FullPatientData } from '@/types/patient';


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
    'ETIMEDOUT'
  ];
  
  return networkErrorMessages.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}


async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries: number = 3,
  delay: number = 1000
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
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
      
    } catch (error: any) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries || !isNetworkError(error)) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error('Max retries exceeded');
}


const patientDetailsAgent = new RealtimeAgent({
  name: 'patientDetailsCollector',
voice: 'alloy',
handoffDescription:
    'Compassionate healthcare assistant who conducts natural, empathetic patient registration conversations with human-like understanding and emotional intelligence.',

  instructions: `
You are a warm, patient, and genuinely helpful patient registration assistant.
Your goal is to collect basic patient details conversationally, never sounding like you’re reading a form.

**Tone:** Friendly, empathetic, conversational.
**Flow:** Follow these numbered steps:

1. **Start the Conversation**  
   - Greet warmly: "Hey there! This is Alex from the patient registration team..."  
   - Check if it's a good time to talk.

2. **Collect Information in a Natural Flow**  
   - Ask for each field in this order: FirstName, LastName, DOB, SSN, Email, Marital Status, Phone, AddressType, Street, City, State, Country, Zip.
   - Connect your questions naturally, referencing earlier answers.

3. **Be Human – Key Tips**  
   - Reference what they’ve said: "Since you’re in Texas, I assume this is a US address?"
   - Use their name: "Thanks, Sarah."
   - Show progress: "Just the address info left!"
   - Handle emotions:
     - Nervous → "Take your time, no rush."
     - Apologetic → "No worries at all, happens to everyone."
     - Confused → "Let me explain what I mean…"

4. **Smart Duplicate Handling**  
   - If they repeat info → confirm it’s the same.  
   - If they give the same value when trying to change it → clarify.  
   - If they update → confirm change.

5. **Final Confirmation**  
   - Summarize all collected info.  
   - Confirm if correct or if changes are needed.

6. **Your Goal**  
   - Make them feel comfortable, listened to, and confident in the process.  
   - End positively: "Perfect! I’ll save all that information right now."

Always adapt based on what’s already collected in memory.
If patient asks why info is needed → explain simply and reassure confidentiality.
`,

tools: [
    tool({
      name: "save_patient_details",
      description:
        "Save the collected patient details to the medical records system with human-like success messaging and robust error handling.",
      parameters: {
        type: "object",
        properties: {
          PatientInformation: {
            type: "object",
            properties: {
              FirstName: { type: "string" },
              LastName: { type: "string" },
              DateOfBirth: { type: "string" },
              SSN: { type: "string" },
              EmailID: { type: "string" },
              MaritalStatus: { type: "string" },
              PhoneNumber: { type: "string" },
            },
            required: [
              "FirstName",
              "LastName",
              "DateOfBirth",
              "SSN",
              "EmailID",
              "MaritalStatus",
              "PhoneNumber",
            ],
            additionalProperties: false,
          },
          Address: {
            type: "object",
            properties: {
              Type: { type: "string" },
              AddressLine1: { type: "string" },
              City: { type: "string" },
              State: { type: "string" },
              Country: { type: "string" },
              ZipCode: { type: "string" },
            },
            required: [
              "Type",
              "AddressLine1",
              "City",
              "State",
              "Country",
              "ZipCode",
            ],
            additionalProperties: false,
          },
        },
        required: ["PatientInformation", "Address"],
        additionalProperties: false,
      },
      execute: async (input: unknown) => {
        const data = input as FullPatientData;

        try {
          console.log("Saving patient data to Pega API:", JSON.stringify(data, null, 2));

          // API submission via centralized client util
          const result = await submitPatientData(data);

          console.log("Pega API response:", result);

          return {
            success: true,
            response: result,
            disconnect: true,
            message: `Wonderful! Thank you so much for your patience, ${data.PatientInformation.FirstName}. I've got everything saved in our system now. You're all set for registration. It was really nice talking with you today, and we'll see you soon. Have a great rest of your day!`
          };
        } catch (error: any) {
          console.error("Error saving patient data:", error);

          const isNetwork = isNetworkError(error);

          let humanMessage: string;
          if (isNetwork) {
            humanMessage = `I'm really sorry, ${data.PatientInformation?.FirstName || 'there'}, but I'm having trouble connecting to our system right now. This might be a temporary network issue. Let me try again in just a moment, or if this keeps happening, I can have someone from our technical team call you back to complete the registration. I apologize for the inconvenience.`;
          } else {
            humanMessage = `I'm really sorry, ${data.PatientInformation?.FirstName || 'there'}, but I'm having a technical issue saving your information right now. Let me try that again, or if this keeps happening, I can have someone from our technical team call you back to complete the registration. I apologize for the inconvenience.`;
          }

          return {
            success: false,
            error: error.message ?? "Unknown error occurred",
            disconnect: false,
            isNetworkError: isNetwork,
            message: humanMessage
          };
        }
      },
    }),
  ],

  handoffs: [],
});

export { patientDetailsAgent };
