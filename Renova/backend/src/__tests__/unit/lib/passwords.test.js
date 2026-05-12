/**
 * Unit Tests for lib/passwords.js
 *
 * Tests password hashing and comparison functionality using bcrypt.
 */

const bcrypt = require('bcryptjs');
const { hashPassword, comparePassword } = require('../../../lib/passwords');

describe('Password Library', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'mySecurePassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate bcrypt hash with correct format', async () => {
      const password = 'testPassword';
      const hash = await hashPassword(password);

      // Bcrypt hashes start with $2a$ or $2b$
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'samePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Due to different salts, hashes should be different
      expect(hash1).not.toBe(hash2);
    });

    it('should hash different passwords to different hashes', async () => {
      const password1 = 'password123';
      const password2 = 'differentPassword456';

      const hash1 = await hashPassword(password1);
      const hash2 = await hashPassword(password2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle short passwords', async () => {
      const password = 'abc';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(100);
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    it('should handle passwords with special characters', async () => {
      const password = 'P@ssw0rd!#$%^&*()';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    it('should handle passwords with unicode characters', async () => {
      const password = 'パスワード123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    it('should handle passwords with spaces', async () => {
      const password = 'my password with spaces';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    it('should handle empty string password', async () => {
      const password = '';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should use bcrypt salt rounds of 10', async () => {
      const password = 'testPassword';
      const hash = await hashPassword(password);

      // Bcrypt hashes with 10 rounds have $10$ in the hash
      expect(hash).toContain('$10$');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'correctPassword123';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const correctPassword = 'correctPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(correctPassword);

      const result = await comparePassword(wrongPassword, hash);

      expect(result).toBe(false);
    });

    it('should return true when password matches hash with special characters', async () => {
      const password = 'P@ssw0rd!#$%';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false when password case differs', async () => {
      const password = 'Password123';
      const hash = await hashPassword(password);

      const result = await comparePassword('password123', hash);

      expect(result).toBe(false);
    });

    it('should handle comparison with empty password', async () => {
      const password = '';
      const hash = await hashPassword(password);

      const resultCorrect = await comparePassword('', hash);
      const resultWrong = await comparePassword('notEmpty', hash);

      expect(resultCorrect).toBe(true);
      expect(resultWrong).toBe(false);
    });

    it('should handle comparison with unicode passwords', async () => {
      const password = 'パスワード123';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should handle comparison with passwords containing spaces', async () => {
      const password = 'password with spaces';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false when comparing with invalid hash', async () => {
      const password = 'testPassword';
      const invalidHash = 'not-a-valid-bcrypt-hash';

      // bcrypt returns false for invalid hashes instead of throwing
      const result = await comparePassword(password, invalidHash);
      expect(result).toBe(false);
    });

    it('should work with bcrypt hashes generated externally', async () => {
      const password = 'testPassword';
      // Pre-generated bcrypt hash for 'testPassword' with 10 rounds
      const externalHash = await bcrypt.hash(password, 10);

      const result = await comparePassword(password, externalHash);

      expect(result).toBe(true);
    });

    it('should return false when password is close but not exact', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      const result1 = await comparePassword('password124', hash);
      const result2 = await comparePassword('password12', hash);
      const result3 = await comparePassword('password1234', hash);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('Integration: Hash and Compare', () => {
    it('should hash and verify the same password multiple times', async () => {
      const password = 'consistentPassword';

      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Different hashes due to different salts
      expect(hash1).not.toBe(hash2);

      // But both should verify successfully
      expect(await comparePassword(password, hash1)).toBe(true);
      expect(await comparePassword(password, hash2)).toBe(true);
    });

    it('should handle complete password change workflow', async () => {
      const oldPassword = 'oldPassword123';
      const newPassword = 'newPassword456';

      // Hash old password
      const oldHash = await hashPassword(oldPassword);

      // Verify old password works
      expect(await comparePassword(oldPassword, oldHash)).toBe(true);

      // Hash new password
      const newHash = await hashPassword(newPassword);

      // Old password should not work with new hash
      expect(await comparePassword(oldPassword, newHash)).toBe(false);

      // New password should work with new hash
      expect(await comparePassword(newPassword, newHash)).toBe(true);

      // New password should not work with old hash
      expect(await comparePassword(newPassword, oldHash)).toBe(false);
    });

    it('should handle multiple users with same password', async () => {
      const sharedPassword = 'commonPassword123';

      const user1Hash = await hashPassword(sharedPassword);
      const user2Hash = await hashPassword(sharedPassword);
      const user3Hash = await hashPassword(sharedPassword);

      // All hashes should be different (different salts)
      expect(user1Hash).not.toBe(user2Hash);
      expect(user2Hash).not.toBe(user3Hash);
      expect(user1Hash).not.toBe(user3Hash);

      // But all should verify with the same password
      expect(await comparePassword(sharedPassword, user1Hash)).toBe(true);
      expect(await comparePassword(sharedPassword, user2Hash)).toBe(true);
      expect(await comparePassword(sharedPassword, user3Hash)).toBe(true);
    });

    it('should maintain security with repeated hash/verify operations', async () => {
      const passwords = [
        'user1Password',
        'user2Password',
        'user3Password',
        'user4Password',
        'user5Password',
      ];

      const hashes = await Promise.all(passwords.map((pwd) => hashPassword(pwd)));

      // Verify each password only matches its own hash
      for (let i = 0; i < passwords.length; i++) {
        for (let j = 0; j < hashes.length; j++) {
          const result = await comparePassword(passwords[i], hashes[j]);
          if (i === j) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      }
    });
  });
});
