const crypto = require('crypto');

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitStore = new Map();

function getClientIp(headers = {}) {
  const raw = headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '';
  return raw.split(',')[0].trim() || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  rateLimitStore.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX;
}

function getCorsOrigin(event) {
  const origin = event.headers?.origin || '';
  const allowList = [process.env.ALLOWED_ORIGIN, process.env.URL].filter(Boolean);
  const isProd = process.env.CONTEXT === 'production';

  if (!isProd) {
    return origin || '*';
  }

  if (allowList.includes(origin)) {
    return origin;
  }

  return allowList[0] || '';
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload, secret) {
  const body = base64Url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${body}.${sig}`;
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': getCorsOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const ip = getClientIp(event.headers || {});
    if (isRateLimited(ip)) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
    }

    if (!event.body || event.body.length > 5000) {
      return { statusCode: 413, headers, body: JSON.stringify({ error: 'Payload too large' }) };
    }

    const { accessCode } = JSON.parse(event.body);
    const userCode = (accessCode || '').trim().toUpperCase();

    const validCodes = [
      'FOILED-BY-MATH',
      'FBM-2025-LAUNCH',
      'TEACHER-VIP'
    ];

    if (!validCodes.includes(userCode)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid Access Code' }) };
    }

    const secret = process.env.PROXY_AUTH_SECRET || 'dev-secret';
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now,
      exp: now + (60 * 60 * 24 * 14), // 14 days
      v: 1
    };

    const token = signToken(payload, secret);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, expiresAt: payload.exp })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Auth error' }) };
  }
};
