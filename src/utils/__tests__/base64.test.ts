import { base64ToBytes } from '@/utils/base64';

const ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe('base64ToBytes', () => {
  it.each([
    ['', ''],
    ['Zg==', 'f'],
    ['Zm8=', 'fo'],
    ['Zm9v', 'foo'],
    ['Zm9vYmFy', 'foobar'],
    ['Zm9v\nYmFy', 'foobar'],
  ])('decodes %p', (input, expected) => {
    expect(ascii(base64ToBytes(input))).toBe(expected);
  });

  it('accepts data URLs and decodes binary (JPEG magic bytes)', () => {
    expect(Array.from(base64ToBytes('data:image/jpeg;base64,/9j/4A==').slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it('rejects malformed input', () => {
    expect(() => base64ToBytes('abc$')).toThrow('Invalid base64');
    expect(() => base64ToBytes('a')).toThrow('Invalid base64');
  });
});
