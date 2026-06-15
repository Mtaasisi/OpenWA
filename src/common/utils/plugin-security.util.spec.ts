import { BadRequestException } from '@nestjs/common';
import { assertValidPluginId, assertValidPluginStorageKey } from './plugin-security.util';

describe('plugin-security.util', () => {
  describe('assertValidPluginId', () => {
    it('accepts safe plugin ids', () => {
      expect(() => assertValidPluginId('whatsapp-web.js')).not.toThrow();
    });

    it('rejects path traversal in plugin id', () => {
      expect(() => assertValidPluginId('../evil')).toThrow(BadRequestException);
      expect(() => assertValidPluginId('foo/bar')).toThrow(BadRequestException);
    });
  });

  describe('assertValidPluginStorageKey', () => {
    it('accepts simple keys', () => {
      expect(() => assertValidPluginStorageKey('cache_state')).not.toThrow();
    });

    it('rejects directory separators and traversal', () => {
      expect(() => assertValidPluginStorageKey('../secrets')).toThrow(BadRequestException);
      expect(() => assertValidPluginStorageKey('a/b')).toThrow(BadRequestException);
      expect(() => assertValidPluginStorageKey('/etc/passwd')).toThrow(BadRequestException);
    });
  });
});
