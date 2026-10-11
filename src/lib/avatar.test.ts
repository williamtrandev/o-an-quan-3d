import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, sanitizeAvatar } from './avatar';

describe('sanitizeAvatar', () => {
  it('falls back to the default for garbage', () => {
    expect(sanitizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(sanitizeAvatar('x')).toEqual(DEFAULT_AVATAR);
  });

  it('keeps valid fields and repairs invalid ones', () => {
    const avatar = sanitizeAvatar({
      name: '  Minh  ',
      skin: '#AABBCC',
      hair: 'red',
      hairStyle: 'mohawk',
      build: 'broad',
      face: 'javascript:alert(1)',
      useFace: true,
    });
    expect(avatar.name).toBe('Minh');
    expect(avatar.skin).toBe('#AABBCC');
    expect(avatar.hair).toBe(DEFAULT_AVATAR.hair);
    expect(avatar.hairStyle).toBe(DEFAULT_AVATAR.hairStyle);
    expect(avatar.build).toBe('broad');
    expect(avatar.face).toBeNull();
    expect(avatar.useFace).toBe(false);
  });

  it('accepts an image face', () => {
    const avatar = sanitizeAvatar({ face: 'data:image/png;base64,AAAA', useFace: true });
    expect(avatar.useFace).toBe(true);
  });

  it('never lets a stored avatar become a robot', () => {
    expect(sanitizeAvatar({ kind: 'robot' }).kind).toBe('human');
  });
});
