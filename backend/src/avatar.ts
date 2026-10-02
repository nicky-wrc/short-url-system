import sharp from 'sharp';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const formats: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };

// Decode and re-encode pixels; never serve the user's original bytes or filename.
export async function normalizeAvatar(data: Buffer, contentType: string): Promise<Buffer> {
  if (!formats[contentType] || !data.length || data.length > AVATAR_MAX_BYTES) throw new Error('Invalid avatar');
  const signatureMatches = contentType === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : contentType === 'image/jpeg' ? data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    : data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!signatureMatches) throw new Error('Invalid avatar');
  const image = sharp(data, { limitInputPixels: 16_777_216, failOn: 'warning' });
  const metadata = await image.metadata();
  if (metadata.format !== formats[contentType] || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) throw new Error('Invalid avatar');
  const output = await image.rotate().resize(256, 256, { fit: 'cover', position: 'centre' }).webp({ quality: 82 }).timeout({ seconds: 3 }).toBuffer();
  if (output.length > 262144) throw new Error('Invalid avatar');
  return output;
}
