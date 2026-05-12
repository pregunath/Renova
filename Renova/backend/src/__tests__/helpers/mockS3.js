/**
 * AWS S3 Mock Helper
 *
 * Provides mock implementations for AWS S3 operations.
 * Use this helper to test file upload and download functionality without actual S3 calls.
 */

/**
 * Mock successful S3 upload response
 */
const mockS3UploadResponse = {
  key: 'test-key-12345',
  location: 'https://test-bucket.s3.amazonaws.com/test-key-12345',
  url: 'https://test-bucket.s3.amazonaws.com/test-key-12345',
};

/**
 * Mock presigned URL
 */
const mockPresignedUrl = 'https://test-bucket.s3.amazonaws.com/test-key?signature=test-signature&expires=1234567890';

/**
 * Configure mock S3 uploadBuffer function
 * Call this in your test to set up the expected behavior
 *
 * @param {string} keyPrefix - The expected key prefix
 * @returns {object} Mock response object
 */
function mockS3Upload(keyPrefix = 'test') {
  const mockKey = `${keyPrefix}/${Date.now()}-test-file`;
  return {
    key: mockKey,
    location: `https://test-bucket.s3.amazonaws.com/${mockKey}`,
    url: `https://test-bucket.s3.amazonaws.com/${mockKey}`,
  };
}

/**
 * Configure mock S3 getPresignedDownloadUrl function
 *
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration time in seconds
 * @returns {string} Mock presigned URL
 */
function mockS3PresignedUrl(key, expiresIn = 600) {
  return `https://test-bucket.s3.amazonaws.com/${key}?signature=test-signature&expires=${expiresIn}`;
}

/**
 * Mock file buffer for testing
 */
const mockFileBuffer = Buffer.from('test file content');

/**
 * Mock file data for testing uploads
 */
const mockFileData = {
  fieldname: 'file',
  originalname: 'test-image.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  buffer: mockFileBuffer,
  size: mockFileBuffer.length,
};

/**
 * Reset all S3 mocks
 */
function resetS3Mocks() {
  jest.clearAllMocks();
}

module.exports = {
  mockS3UploadResponse,
  mockPresignedUrl,
  mockS3Upload,
  mockS3PresignedUrl,
  mockFileBuffer,
  mockFileData,
  resetS3Mocks,
};
