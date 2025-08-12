import { Express } from 'express';
import { twiml } from "twilio";

export function setupRoutes(app: Express) {
  // Twilio webhook endpoint
  app.post('/incoming-call', (req, res) => {
    console.log('📞 Incoming call from Twilio');
    
    // const twiml = `
    //   <?xml version="1.0" encoding="UTF-8"?>
    //   <Response>
    //     <Say voice="alice">Please wait while we connect your call to our AI assistant.</Say>
    //     <Pause length="1"/>
    //     <Say voice="alice">You can begin speaking after the tone.</Say>
    //     <Connect>
    //       <Stream url="wss://49c3193f5979.ngrok-free.app/media-stream" />
    //     </Connect>
    //   </Response>
    // `;

    // console.log('Twiml response:', twiml);

    // res.type('text/xml');
    // res.send(twiml);

    const response = new twiml.VoiceResponse();

  response.say(
    { voice: "alice" },
    "Please wait while we connect your call to our AI assistant."
  );
  response.pause({ length: 1 });
  response.say({ voice: "alice" }, "You can begin speaking after the tone.");
  response.connect().stream({
    url: "wss://78ac3e5cd7c0.ngrok-free.app/media-stream",
  });

  res.type("text/xml");
  console.log(response,'Twiml response:', response.toString());
  res.send(response.toString());
  });

  // Status endpoint
  app.get('/', (req, res) => {
    // res.json({
    //   service: 'Patient Realtime Agent',
    //   status: 'running',
    //   version: '1.0.0'
    // });
    res.send(`<h1>Patient Realtime Agent</h1>`)
  });
}