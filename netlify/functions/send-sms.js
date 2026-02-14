// ============================================================
// MMT Financial & Insurance — Twilio SMS Serverless Function
// Deploy on Netlify Functions (free tier supports this)
// ============================================================
//
// SETUP:
// 1. Create a Netlify account at https://netlify.com
// 2. Create a new site from a Git repo (your GitHub repo)
// 3. In your repo, place this file at: netlify/functions/send-sms.js
// 4. Add a package.json in the repo root with: { "dependencies": { "twilio": "^5.0.0" } }
// 5. In Netlify dashboard → Site Settings → Environment Variables, add:
//    - TWILIO_ACCOUNT_SID   (from your Twilio console)
//    - TWILIO_AUTH_TOKEN     (from your Twilio console)
//    - TWILIO_PHONE_NUMBER   (your Twilio phone number, e.g. +15551234567)
//    - ALLOWED_ORIGIN        (your GitHub Pages URL, e.g. https://yourusername.github.io)
// 6. Deploy! Netlify will auto-install dependencies and host the function.
// 7. Your endpoint will be: https://your-site.netlify.app/.netlify/functions/send-sms
// 8. Update CONFIG.twilio.serverEndpoint in the HTML form with this URL.
//
// ============================================================

const twilio = require('twilio');

exports.handler = async (event, context) => {
  // CORS headers
  const origin = process.env.ALLOWED_ORIGIN || '*';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Validate environment
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Twilio credentials not configured on server.' })
    };
  }

  // Parse request
  let messages;
  try {
    const body = JSON.parse(event.body);
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('No messages provided');
    }
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body. Expected { messages: [{ to, body }] }' })
    };
  }

  // Rate limit: max 10 messages per request
  if (messages.length > 10) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Maximum 10 messages per request.' })
    };
  }

  // Send via Twilio
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const results = [];
  const errors = [];

  for (const msg of messages) {
    if (!msg.to || !msg.body) {
      errors.push({ to: msg.to, error: 'Missing "to" or "body"' });
      continue;
    }

    try {
      const result = await client.messages.create({
        body: msg.body,
        from: TWILIO_PHONE_NUMBER,
        to: msg.to
      });
      results.push({ to: msg.to, sid: result.sid, status: result.status });
    } catch (err) {
      errors.push({ to: msg.to, error: err.message });
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: errors.length === 0,
      sent: results,
      errors: errors.length > 0 ? errors : undefined
    })
  };
};

