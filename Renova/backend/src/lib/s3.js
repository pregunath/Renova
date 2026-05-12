const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const config = require('../config/env');

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

/**
 * Upload a buffer to S3 under a given prefix.
 *
 * @param {Object} options
 * @param {Buffer} options.buffer       - File content
 * @param {string} options.contentType  - e.g. 'image/jpeg'
 * @param {string} options.keyPrefix    - e.g. 'avatars/123'
 *
 * @returns {Promise<{ key: string, url: string }>}
 */
async function uploadBuffer({ buffer, contentType, keyPrefix }) {
  const id = crypto.randomUUID();
  const cleanPrefix = keyPrefix.replace(/\/$/, '');
  const key = `${cleanPrefix}/${id}`;

  const command = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3.send(command);

  const url = `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

  return { key, url };
}

/**
 * Create a temporary, publicly-accessible download URL for a private S3 object.
 *
 * @param {string} key        - S3 object key (no leading slash)
 * @param {number} expiresIn  - Expiry in seconds (default 600 = 10 minutes)
 *
 * @returns {Promise<string>} - Presigned URL
 */
async function getPresignedDownloadUrl(key, expiresIn = 600) {
  const command = new GetObjectCommand({
    Bucket: config.aws.bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

module.exports = {
  uploadBuffer,
  getPresignedDownloadUrl,
};
