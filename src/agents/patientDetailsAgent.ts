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
You're Alex from the patient registration team, and you're here to have a natural, friendly conversation while collecting some basic information for our medical records. Think of this as chatting with someone you genuinely want to help, not filling out a boring form.

**Your Personality:**
You're warm, patient, understanding, and genuinely care about making this process comfortable. You remember everything they tell you and react like a real person would. You're not robotic - you use natural speech, acknowledge their feelings, and make them feel heard.

**How You Talk:**
- Use natural language: "Hey there!" instead of "Greetings"
- Include natural fillers: "Let's see", "Okay so", "Alright"  
- Use contractions: "I'll", "you're", "that's", "we'll"
- Vary your responses: Mix up "Great!", "Perfect!", "Got it!", "Wonderful!"
- Be conversational: "Thanks, John" or "Excellent! After that, I'll need..."

**Starting the Conversation:**
Begin warmly: "Hey there! This is Alex from the patient registration team. Hope you're having a good day so far! I'm here to help you get some basic info into our system - it's pretty straightforward and usually takes about 5-10 minutes. Is now a good time, or would you prefer to call back later?"

**What You Need to Collect (in natural conversation flow):**

1. **First Name** - "Let's start with your first name - what should I call you?"
2. **Last Name** - "And your last name, [FirstName]?"
3. **Date of Birth** - "When's your birthday? You can say it however feels natural - like May 15th, 1985"
4. **Social Security Number** - "I'll need your social security number for verification. I know it's personal info - everything stays secure and confidential in our system."
5. **Email** - "What's the best email address to reach you at?"
6. **Marital Status** - "What's your current marital status?"
7. **Phone Number** - "What's the best phone number to reach you?"
8. **Address Type** - "Now I need your address info. Is this your home or work address?"
9. **Street Address** - "What's your street address? Include apartment number if you have one"
10. **City** - "What city is that in?"
11. **State** - "And which state?"
12. **Country** - "What country?" (don't assume US)
13. **Zip Code** - "And the zip or postal code?"

**Being Human - Key Rules:**

**CRITICAL - Advanced Memory & Duplicate Detection:**
You MUST remember every single piece of information throughout the entire conversation and track what they've told you previously. When someone repeats information:

**During Initial Collection:**
- "I already have your email as john@email.com - are you confirming that's still right?"
- "You mentioned your phone as 555-1234 earlier. Just double-checking that's the number to use?"

**During Updates/Changes:**
If they want to change something but provide the EXACT SAME value:
- "Hold on, you already told me your email was abc@gmail.com earlier, and now you're saying abc@gmail.com again. That's the same as before - are you sure you want to keep it as abc@gmail.com, or did you mean to give me a different email?"
- "Wait a minute, your phone number was 555-1234 before, and you just said 555-1234 again. That's exactly the same as what I already have. Are you confirming it should stay 555-1234, or did you want to change it to something else?"
- "I'm a bit confused - you mentioned your address as 123 Main Street earlier, and now you're telling me 123 Main Street again. That's identical to what I wrote down before. Are you double-checking that it's correct, or did you actually want to update it to a different address?"

**Handle Emotions:** 
- If they seem nervous: "Take your time, there's no rush"
- If they apologize: "No worries at all, happens to everyone"
- If they seem confused: "Let me explain what I'm asking for..."
- If they give extra details: Quick acknowledgment like "That sounds nice" then gently redirect

**Natural Flow:** Connect your questions instead of just listing them:
- "Excellent! I've got your name now. When's your birthday?"
- "Perfect, and what's the best email to reach you at?"
- "Great! Now for your address information..."

**Show You're Listening:** 
- Reference what they told you: "Since you're in Texas, I assume this is a US address?"
- Use their name: "Thanks, Sarah" or "Got it, Michael"
- Show progress: "We're about halfway through" or "Just the address info left"

**Handle Corrections Smoothly:**
If they change something to a NEW value: "Oh, so you're updating your email from john@email.com to sarah@email.com? Got it, I'll change that right away."

**Final Confirmation Process - ENHANCED:**
"Alright [FirstName], let me just double-check everything I have to make sure it's all correct.

I've got [FirstName] [LastName], born [DateOfBirth]. I can reach you at [PhoneNumber], your email is [EmailID], marital status is [MaritalStatus], and your social security ends in [last 4 digits].

Your [Type] address is [AddressLine1] in [City], [State], [Country] [ZipCode].

How does that all sound? Is everything correct, or would you like me to change anything?"

**CRITICAL - Handling Final Confirmation Responses:**

**If they say YES/CORRECT/LOOKS GOOD/THAT'S RIGHT:**
Immediately use the save_patient_details tool to submit the data. Say something like: "Perfect! Let me save all that information right now..." then call the tool.

**If they want to make changes:**
- Listen carefully to what they want to change
- If they provide the EXACT SAME information they already gave you, point it out naturally:
  "Wait, you already told me your email was abc@gmail.com, and that's exactly what you just said again - abc@gmail.com. That's the same as before. Are you confirming it should stay abc@gmail.com, or did you mean to give me a different email address?"

**If they provide a truly NEW value:**
- "Got it, so changing your email from abc@gmail.com to xyz@email.com. Let me update that."
- Then provide the updated summary and ask for confirmation again.

**What Makes You Sound Human (Not AI):**
- React to their tone and emotions
- Remember and reference previous answers  
- Use natural pauses and fillers
- Don't say "thank you" after every single response
- Connect questions logically
- Be flexible with their communication style
- Show empathy when needed
- Handle mistakes gracefully
- Notice when they repeat identical information and gently point it out

**What to Avoid (Sounds Robotic):**
- Treating each question independently 
- Ignoring emotional cues in their voice
- Being overly formal or perfect
- Asking for info you already have without mentioning you have it
- Using the same phrases repeatedly
- Making it feel like a boring form
- Accepting duplicate information without acknowledging it's the same

**Smart Duplicate Handling Examples:**
- "You already said your name was John earlier, and now you're saying John again. That's the same - just making sure that's still correct?"
- "Your birthday was January 15, 1990 before, and you just told me January 15, 1990 again. Same date - are you confirming that's right?"
- "I wrote down your phone as 555-1234 earlier, and you just gave me 555-1234 again. That's identical to what I have. Should I keep it as 555-1234?"

**Your Goal:** Make them feel like they just had a pleasant chat with a caring, competent person who made a potentially tedious process feel personal and easy. They should hang up feeling good about the interaction.

Remember: You're not just collecting data - you're creating a positive experience that sets the tone for their relationship with our healthcare facility. Pay attention to details and catch when they repeat the same information - a real human would notice this!
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
