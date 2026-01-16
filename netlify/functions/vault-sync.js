const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
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

/**
 * DATABASE ABSTRACTION
 * 
 * To "make it happen" securely in the cloud without managing a database server,
 * we use Netlify Blobs if available.
 * 
 * IF (Local Dev): Uses a local JSON file.
 * IF (Cloud): Uses Netlify Blobs (Key-Value Store).
 */

const DB_FILE = path.join(__dirname, '.local_sync_db.json');
const IS_LOCAL = process.env.NETLIFY_DEV === 'true' || process.env.NETLIFY_DEV === '1';

function hashUserId(userId) {
    return crypto.createHash('sha256').update(String(userId || '')).digest('hex').slice(0, 12);
}

function getStorageMode() {
    if (IS_LOCAL) return 'local-file';
    const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN;
    return siteID && token ? 'blobs-pat' : 'blobs-native';
}

function getBlobStore(name) {
    const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN;
    if (siteID && token) {
        return getStore({ name, siteID, token });
    }
    return getStore(name);
}

async function getStoreData(userId) {
    if (IS_LOCAL) {
        // --- Local File Strategy ---
        try {
            if (fs.existsSync(DB_FILE)) {
                const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                return db[userId];
            }
        } catch (e) {
            console.error('Local DB Read Error:', e);
        }
        return null;
    } else {
        // --- Cloud Blob Strategy ---
        // Requires 'Netlify Blobs' addon to be enabled on the site
        try {
            const store = getBlobStore('vaults');
            const data = await store.get(userId, { type: 'json' });
            return data;
        } catch (e) {
            console.error('Cloud Blob Read Error:', e);
            // Fallback for when Blobs aren't enabled yet
            return null;
        }
    }
}

async function saveStoreData(userId, data) {
    if (IS_LOCAL) {
        // --- Local File Strategy ---
        let db = {};
        try {
            if (fs.existsSync(DB_FILE)) {
                db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            }
        } catch (e) { console.error('Local DB Read Error:', e); }
        
        db[userId] = data;
        
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        } catch (e) { console.error('Local DB Write Error:', e); }
    } else {
        // --- Cloud Blob Strategy ---
        try {
            const store = getBlobStore('vaults');
            await store.set(userId, JSON.stringify(data));
        } catch (e) {
            console.error('Cloud Blob Write Error:', e);
            // This will fail if Blobs aren't enabled, which is the correct "fail secure" behavior
            throw new Error(`Cloud storage not configured. Please enable Netlify Blobs. ${e.message || ''}`.trim());
        }
    }
}

async function deleteStoreData(userId) {
    if (IS_LOCAL) {
        let db = {};
        try {
            if (fs.existsSync(DB_FILE)) {
                db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            }
        } catch (e) { console.error('Local DB Read Error:', e); }

        if (db[userId]) {
            delete db[userId];
            try {
                fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
            } catch (e) { console.error('Local DB Write Error:', e); }
        }
    } else {
        try {
            const store = getBlobStore('vaults');
            await store.delete(userId);
        } catch (e) {
            console.error('Cloud Blob Delete Error:', e);
            throw new Error('Cloud storage not configured. Please enable Netlify Blobs.');
        }
    }
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

exports.handler = async function(event, context) {
    const requestId = crypto.randomBytes(8).toString('hex');
    const debugEnabled = event.queryStringParameters?.debug === '1';
    const debugInfo = debugEnabled ? {
        requestId,
        storage: getStorageMode(),
        isLocal: IS_LOCAL,
        time: new Date().toISOString()
    } : undefined;

    const headers = {
        'Access-Control-Allow-Origin': getCorsOrigin(event),
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        // Security Headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    };


  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

    const ip = getClientIp(event.headers || {});
    if (isRateLimited(ip)) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
    }

    if (event.body && event.body.length > 100000) {
        return { statusCode: 413, headers, body: JSON.stringify({ error: 'Payload too large' }) };
    }

    const { deviceId, userId, action, vaultBlob } = JSON.parse(event.body || '{}');
    const userHash = hashUserId(userId);
    console.info('vault-sync request', { requestId, action, userHash, storage: getStorageMode() });

  if (!userId) {
    return { 
        statusCode: 400, 
        headers, 
                body: JSON.stringify({ error: 'Missing userId', requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) 
    };
  }

  // SYNC: PULL
  if (event.httpMethod === 'GET' || action === 'pull') {
    try {
        const data = await getStoreData(userId);
        if (!data) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'No data found', requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) };
        }
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ...data, requestId, ...(debugInfo ? { debug: debugInfo } : {}) })
        };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Storage error', requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) };
    }
  }

    // SYNC: DELETE
    if (action === 'delete') {
        try {
                await deleteStoreData(userId);
                return {
                        statusCode: 200,
                        headers,
                body: JSON.stringify({ success: true, requestId, ...(debugInfo ? { debug: debugInfo } : {}) })
                };
        } catch (e) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Delete failed', requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) };
        }
    }

  // SYNC: PUSH
  if (event.httpMethod === 'POST' || action === 'push') {
    if (!vaultBlob) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing vaultBlob', requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) };
    }
    
    // Security: Limit payload size approx 50KB to prevent abuse
    if (vaultBlob.length > 50000) {
        return { statusCode: 413, headers, body: JSON.stringify({ error: 'Payload too large', requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) };
    }

    try {
        const data = {
            vaultBlob,
            updatedAt: Date.now(),
            deviceId
        };
        
        await saveStoreData(userId, data);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, timestamp: Date.now(), requestId, ...(debugInfo ? { debug: debugInfo } : {}) })
        };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Storage error: ' + e.message, requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed', requestId, ...(debugInfo ? { debug: debugInfo } : {}) }) };
};
