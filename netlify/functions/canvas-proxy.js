const crypto = require('crypto');

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
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

function isValidHttpsUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:';
    } catch {
        return false;
    }
}

function verifyToken(token, secret) {
    if (!token || !token.includes('.')) return false;
    const [payloadB64, sig] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    if (sig !== expectedSig) return false;

    try {
        const json = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const payload = JSON.parse(json);
        const now = Math.floor(Date.now() / 1000);
        return payload.exp && payload.exp > now;
    } catch {
        return false;
    }
}

exports.handler = async function(event, context) {
    // CORS + security headers
    const headers = {
        'Access-Control-Allow-Origin': getCorsOrigin(event),
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

    if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
        const ip = getClientIp(event.headers || {});
        if (isRateLimited(ip)) {
            return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
        }

        if (!event.body || event.body.length > 100000) {
            return { statusCode: 413, headers, body: JSON.stringify({ error: 'Payload too large' }) };
        }

        const data = JSON.parse(event.body);
        const { action, canvasUrl, canvasToken, courseId, assignmentData, announcementData, assignmentGroupId } = data;

        const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const secret = process.env.PROXY_AUTH_SECRET || 'dev-secret';
        if (!verifyToken(token, secret)) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        if (!canvasUrl || !isValidHttpsUrl(canvasUrl)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid Canvas URL' }) };
        }

        if (!canvasToken || typeof canvasToken !== 'string') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing Canvas token' }) };
        }

    // Course list
    if (action === 'listCourses') {
        const response = await fetch(`${canvasUrl}/api/v1/courses?enrollment_state=active&per_page=100`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${canvasToken}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = { text: responseText };
        }

        if (!response.ok) {
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({
                    error: responseData || 'Canvas API Error',
                    status: response.status
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ courses: responseData })
        };
    }

    // Assignment groups list
    if (action === 'listGroups') {
        const response = await fetch(`${canvasUrl}/api/v1/courses/${courseId}/assignment_groups?per_page=100`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${canvasToken}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = { text: responseText };
        }

        if (!response.ok) {
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({
                    error: responseData || 'Canvas API Error',
                    status: response.status
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ groups: responseData })
        };
    }

    if (!courseId || !/^[0-9]+$/.test(String(courseId))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid course ID' }) };
    }

    // Determine endpoint content
    let endpoint = '';
    let payload = {};
    
    if (assignmentData) {
        endpoint = `/api/v1/courses/${courseId}/assignments`;
        payload = assignmentData;
        if (assignmentGroupId) {
            payload.assignment.assignment_group_id = Number(assignmentGroupId);
        }
    } else if (announcementData) {
        endpoint = `/api/v1/courses/${courseId}/discussion_topics`;
        payload = announcementData;
    } else {
        return { 
            statusCode: 400, 
            headers, 
            body: JSON.stringify({ error: 'Missing assignment or announcement data' }) 
        };
    }

    // Make request to Canvas
    const response = await fetch(`${canvasUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${canvasToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        responseData = { text: responseText };
    }

    if (!response.ok) {
        return {
            statusCode: response.status,
            headers,
            body: JSON.stringify({ 
                error: responseData || 'Canvas API Error', 
                status: response.status 
            })
        };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(responseData)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
