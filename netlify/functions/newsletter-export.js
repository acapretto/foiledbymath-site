const { getStore } = require('@netlify/blobs');

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

function toCsv(rows) {
  const header = ['email', 'createdAt', 'source'];
  const escape = (value) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [header.join(',')];
  rows.forEach((row) => {
    lines.push([row.email, row.createdAt, row.source].map(escape).join(','));
  });
  return lines.join('\n');
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': getCorsOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  const token = event.queryStringParameters?.token || '';
  const requiredToken = process.env.NEWSLETTER_EXPORT_TOKEN || '';
  if (!requiredToken || token !== requiredToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getBlobStore('newsletter');
    const listed = await store.list();
    const rawKeys = Array.isArray(listed)
      ? listed
      : (listed?.blobs || listed?.keys || listed?.items || []);
    const keys = rawKeys.map((item) => (typeof item === 'string' ? item : item.key)).filter(Boolean);

    const rows = [];
    for (const key of keys) {
      try {
        const value = await store.get(key, { type: 'json' });
        const payload = value && typeof value === 'object'
          ? value
          : JSON.parse(String(value || '{}'));
        if (payload?.email) {
          rows.push({
            email: payload.email,
            createdAt: payload.createdAt ? new Date(payload.createdAt).toISOString() : '',
            source: payload.source || ''
          });
        }
      } catch (e) {
        continue;
      }
    }

    const format = (event.queryStringParameters?.format || 'json').toLowerCase();
    if (format === 'csv') {
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/csv; charset=utf-8'
        },
        body: toCsv(rows)
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({ count: rows.length, rows })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Export failed' }) };
  }
};
