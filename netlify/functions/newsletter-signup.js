const { getStore } = require('@netlify/blobs');
const nodemailer = require('nodemailer');

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

function getBlobStore(name) {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getMailer() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE
    ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
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

    const { email } = JSON.parse(event.body || '{}');
    if (!isValidEmail(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const store = getBlobStore('newsletter');
    const key = email.trim().toLowerCase();
    const payload = {
      email: key,
      source: 'cloud-sync',
      createdAt: Date.now()
    };

    await store.set(key, JSON.stringify(payload));

    const mailer = getMailer();
    if (mailer) {
      const to = process.env.SMTP_TO || process.env.SMTP_USER;
      const from = process.env.SMTP_FROM || process.env.SMTP_USER;
      const subject = 'New Foiled By Math sync signup';
      const baseUrl = process.env.URL || process.env.DEPLOY_URL || process.env.ALLOWED_ORIGIN || '';
      const exportToken = process.env.NEWSLETTER_EXPORT_TOKEN || '';
      const exportUrl = baseUrl && exportToken
        ? `${baseUrl}/.netlify/functions/newsletter-export?token=${encodeURIComponent(exportToken)}&format=csv`
        : '';
      const text = exportUrl
        ? `New email signup: ${key}\nExport list (CSV): ${exportUrl}`
        : `New email signup: ${key}`;
      try {
        await mailer.sendMail({ to, from, subject, text });
      } catch (e) {
        console.error('Email send failed:', e);
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Signup failed' }) };
  }
};
