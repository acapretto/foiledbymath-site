/**
 * Secure Vault Implementation for Canvas Token Storage
 * Uses Web Crypto API (PBKDF2 + AES-GCM)
 */

const Vault = {
    // Configuration
    algo: {
        name: 'AES-GCM',
        length: 256
    },
    kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 250000
    },

    // Utilities for ArrayBuffer <-> Base64
    buffToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },

    base64ToBuff(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    // Derive a key from a password and salt
    async deriveKey(password, salt, params = null) {
        const kdfParams = params || this.kdf;
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return window.crypto.subtle.deriveKey(
            {
                ...kdfParams,
                salt: salt
            },
            keyMaterial,
            this.algo,
            false,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Encrypts a plaintext string with a password
     * Returns object: { ciphertext, iv, salt } (all base64 strings)
     */
    async encrypt(plaintext, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(password, salt, this.kdf);
        const enc = new TextEncoder();

        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: this.algo.name,
                iv: iv
            },
            key,
            enc.encode(plaintext)
        );

        return {
            ciphertext: this.buffToBase64(ciphertext),
            iv: this.buffToBase64(iv),
            salt: this.buffToBase64(salt),
            version: 2,
            kdf: {
                name: this.kdf.name,
                hash: this.kdf.hash,
                iterations: this.kdf.iterations
            },
            createdAt: Date.now()
        };
    },

    /**
     * Decrypts a vault object with a password
     * Returns plaintext string or throws error
     */
    async decrypt(vaultObj, password) {
        try {
            const salt = this.base64ToBuff(vaultObj.salt);
            const iv = this.base64ToBuff(vaultObj.iv);
            const ciphertext = this.base64ToBuff(vaultObj.ciphertext);
            
            const legacyKdf = {
                name: 'PBKDF2',
                hash: 'SHA-256',
                iterations: 100000
            };
            const kdfParams = vaultObj.kdf || legacyKdf;
            const key = await this.deriveKey(password, salt, kdfParams);
            
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: this.algo.name,
                    iv: iv
                },
                key,
                ciphertext
            );

            const dec = new TextDecoder();
            return dec.decode(decrypted);
        } catch (e) {
            console.error('Decryption failed:', e);
            throw new Error('Incorrect password or corrupted vault');
        }
    }
};
