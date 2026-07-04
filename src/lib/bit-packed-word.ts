// Generic helpers for PLC signals that are bit-packed into one or more
// 16-bit Modbus words (uint16) before reaching the gateway/MQTT payload.
// Bit mapping itself is NOT hardcoded here — callers supply a channel map
// (word index + bit index) so the mapping can be swapped once engineering
// confirms the final PLC bit layout, without touching this module.
//
// Each word MUST be treated as uint16 (0..65535), not signed int16
// (-32768..32767). A PLC/Modbus register is naturally unsigned — bit15 is
// just another flag, not a sign bit. If a word ever arrives already
// interpreted as signed int16 (e.g. bit15 set makes the whole value
// negative), `toUint16` below reinterprets its raw bits back to unsigned
// before any bit-shift, so the flags decode correctly either way.

export const WORD_BIT_LENGTH = 16;
const WORD_MASK = 0xffff;

export type BitChannelMap<TKey extends string> = Record<
  TKey,
  {
    /** Index into the `words` array (0 = first word, 1 = second word, ...). */
    wordIndex: number;
    /** Bit position within that word, 0 = LSB. */
    bitIndex: number;
  }
>;

/**
 * Reinterprets a word's raw 16 bits as unsigned (0..65535), regardless of
 * whether it arrived as a signed int16 (-32768..32767) or already unsigned.
 * JS bitwise ops operate on 32-bit signed ints internally, so this must run
 * before any `>>`/`&`/`|` on a word to avoid sign-extension bugs on bit15.
 */
function toUint16(word: number) {
  return word & WORD_MASK;
}

export function getChannelBit<TKey extends string>(
  words: readonly number[],
  map: BitChannelMap<TKey>,
  key: TKey
): boolean {
  const { wordIndex, bitIndex } = map[key];
  const word = toUint16(words[wordIndex] ?? 0);

  return ((word >> bitIndex) & 1) === 1;
}

export function setChannelBit<TKey extends string>(
  words: readonly number[],
  map: BitChannelMap<TKey>,
  key: TKey,
  value: boolean
): number[] {
  const { wordIndex, bitIndex } = map[key];
  const nextWords = [...words];
  const currentWord = toUint16(nextWords[wordIndex] ?? 0);

  nextWords[wordIndex] = toUint16(
    value ? currentWord | (1 << bitIndex) : currentWord & ~(1 << bitIndex)
  );

  return nextWords;
}

export function unpackChannels<TKey extends string>(
  words: readonly number[],
  map: BitChannelMap<TKey>
): Record<TKey, boolean> {
  const keys = Object.keys(map) as TKey[];

  return keys.reduce(
    (result, key) => {
      result[key] = getChannelBit(words, map, key);
      return result;
    },
    {} as Record<TKey, boolean>
  );
}
