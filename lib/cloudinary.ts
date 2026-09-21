import { createHmac } from 'node:crypto';

/**
 * Cloudinary helpers — subida unsigned (cliente) y borrado firmado (servidor).
 * Sin dependencias externas: usa REST API + crypto nativo para firmar.
 */

interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey: string;
  apiSecret: string;
}

let cachedConfig: CloudinaryConfig | null = null;

export function getCloudinaryConfig(): CloudinaryConfig {
  if (cachedConfig) return cachedConfig;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const apiKey = process.env.CLOUDINARY_API_KEY ?? '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? '';
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables are not configured');
  }
  cachedConfig = { cloudName, uploadPreset, apiKey, apiSecret };
  return cachedConfig;
}

/** URL del endpoint de subida unsigned (para el cliente). */
export function getUploadUrl(): string {
  const cfg = getCloudinaryConfig();
  return `https://api.cloudinary.com/v1_1/${cfg.cloudName}/upload`;
}

/** Genera la firma HMAC-SHA1 para el API Admin de Cloudinary. */
function signApiRequest(params: Record<string, string>, apiSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHmac('sha1', apiSecret).update(sorted).digest('hex');
}

/**
 * Borra un asset de Cloudinary por public_id.
 * Requiere CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el entorno.
 */
export async function deleteAsset(publicId: string): Promise<void> {
  const cfg = getCloudinaryConfig();
  if (!cfg.apiKey || !cfg.apiSecret) {
    throw new Error('CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET son necesarios para borrar');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { public_id: publicId, timestamp };
  const signature = signApiRequest(params, cfg.apiSecret);

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp);
  formData.append('api_key', cfg.apiKey);
  formData.append('signature', signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Cloudinary delete failed: ${res.status}`);
  }
}

/**
 * Extrae el public_id de una URL de Cloudinary.
 * URL formato: https://res.cloudinary.com/{cloud}/image/upload/v123/{folder}/{file}.{ext}
 */
export function publicIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    // Buscar "upload" y tomar todo lo que viene después
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    const afterUpload = parts.slice(uploadIdx + 1);
    // Saltar versión si existe (v1234567890)
    const start = afterUpload[0]?.startsWith('v') && /^\d+$/.test(afterUpload[0].slice(1))
      ? 1
      : 0;
    const id = afterUpload.slice(start).join('/');
    // Quitar extensión
    const lastDot = id.lastIndexOf('.');
    return lastDot > 0 ? id.slice(0, lastDot) : id;
  } catch {
    return null;
  }
}
