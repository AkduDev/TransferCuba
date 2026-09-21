import { createHmac, createHash } from 'node:crypto';

/**
 * Cloudflare R2 helpers using S3-compatible API.
 * Zero external dependencies — uses Node.js native `crypto` for V4 signing.
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

let cachedConfig: R2Config | null = null;

export function getR2Config(): R2Config {
  if (cachedConfig) return cachedConfig;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error('R2 environment variables are not configured');
  }
  cachedConfig = { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
  return cachedConfig;
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacSha256Hex(key: string | Buffer, data: string): string {
  return hmacSha256(key, data).toString('hex');
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

/**
 * Generate a presigned PUT URL for uploading a file to R2.
 * The client can PUT directly to R2 without going through the server.
 */
export function presignPut(key: string, contentType: string, expiresIn = 3600): {
  uploadUrl: string;
  publicUrl: string;
} {
  const cfg = getR2Config();
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

  const host = `${cfg.bucketName}.${cfg.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${key}`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'content-type;host'
  };

  const sortedParams = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalQueryString = sortedParams;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signingKey = getSignatureKey(cfg.secretAccessKey, dateStamp, 'auto', 's3');
  const signature = hmacSha256Hex(signingKey, stringToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = new URL(`https://${host}${canonicalUri}`);
  url.search = sortedParams;

  return {
    uploadUrl: url.toString(),
    publicUrl: `${cfg.publicUrl}/${key}`
  };
}

/**
 * Generate a presigned GET URL for reading a file from R2.
 */
export function presignGet(key: string, expiresIn = 3600): string {
  const cfg = getR2Config();
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

  const host = `${cfg.bucketName}.${cfg.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${key}`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host'
  };

  const sortedParams = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalQueryString = sortedParams;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signingKey = getSignatureKey(cfg.secretAccessKey, dateStamp, 'auto', 's3');
  const signature = hmacSha256Hex(signingKey, stringToSign);

  const url = new URL(`https://${host}${canonicalUri}`);
  url.search = sortedParams;

  return url.toString();
}

/**
 * Delete an object from R2 via S3 API.
 */
export async function deleteObject(key: string): Promise<void> {
  const cfg = getR2Config();
  const url = presignGet(key, 60);
  // Use presigned GET and then a signed DELETE
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

  const host = `${cfg.bucketName}.${cfg.accountId}.r2.cloudflarestorage.com`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  // Build a presigned DELETE URL
  const canonicalUri = `/${key}`;
  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': '60',
    'X-Amz-SignedHeaders': 'host'
  };

  const sortedParams = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalQueryString = sortedParams;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';

  const canonicalRequest = [
    'DELETE',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signingKey = getSignatureKey(cfg.secretAccessKey, dateStamp, 'auto', 's3');
  const signature = hmacSha256Hex(signingKey, stringToSign);

  const deleteUrl = new URL(`https://${host}${canonicalUri}`);
  deleteUrl.search = sortedParams;

  const res = await fetch(deleteUrl.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status}`);
  }
}
