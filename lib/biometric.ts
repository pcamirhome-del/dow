function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(b64: string): ArrayBuffer {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function isPlatformBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerTouchIdCredential(): Promise<{
  ok: boolean;
  credentialId?: string;
  method: 'webauthn' | 'pin';
}> {
  if (typeof navigator !== 'undefined' && navigator.credentials?.create && window.PublicKeyCredential) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'SaveBox Local Vault',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: 'local-owner@savebox',
            displayName: 'SaveBox Owner',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 45000,
        },
      })) as PublicKeyCredential | null;

      if (cred?.rawId) {
        return {
          ok: true,
          credentialId: bufferToBase64Url(cred.rawId),
          method: 'webauthn',
        };
      }
    } catch {
      // Fall through to PIN lock if WebAuthn is blocked by iframe Permissions-Policy or cancelled
    }
  }
  return { ok: false, method: 'pin' };
}

export async function verifyTouchIdCredential(credentialId: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.credentials?.get || !window.PublicKeyCredential) {
    return false;
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64UrlToBuffer(credentialId),
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 45000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`savebox-salt:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64Url(digest);
}
