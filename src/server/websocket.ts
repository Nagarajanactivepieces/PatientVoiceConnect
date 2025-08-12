import WebSocket from 'ws';
import { RealtimeSession } from '@openai/agents/realtime';
// import { TwilioRealtimeTransportLayer } from '@openai/agents/extensions/twilio';
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions';
// import { TwilioRealtimeTransportLayer } from '@openai/agents-twilio'; // Update to correct package if needed
// import { patientDetailsAgent } from '@agents/patientDetailsAgent';
import {patientDetailsAgent} from '../agents/patientDetailsAgent';
import { config } from '../config/environment';

export function handleWebSocketConnection(ws: WebSocket) {
  console.log('📞 New Twilio connection established');
  
  const twilioTransportLayer = new TwilioRealtimeTransportLayer({
    twilioWebSocket: ws,
  });

  const session = new RealtimeSession(patientDetailsAgent, {
    transport: twilioTransportLayer,
  });

  session.connect({
    apiKey: config.openai.apiKey,
  });

  ws.on('close', () => {
    console.log('📞 Twilio connection closed');
    // session.disconnect();
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}
