import { detectsWakeWord, extractCommandPortion } from '../wakeWordService';

describe('detectsWakeWord', () => {
  it('detects "bahmni" in transcript', () => {
    expect(detectsWakeWord('hey bahmni')).toBe(true);
  });

  it('detects "bahmni" case-insensitively', () => {
    expect(detectsWakeWord('Hey BAHMNI')).toBe(true);
  });

  it('detects phonetic variant "bahm"', () => {
    expect(detectsWakeWord('hey bahm')).toBe(true);
  });

  it('detects phonetic variant "bami"', () => {
    expect(detectsWakeWord('hey bami add patient')).toBe(true);
  });

  it('detects phonetic variant "bahumi"', () => {
    expect(detectsWakeWord('bahumi')).toBe(true);
  });

  it('returns false for unrelated words', () => {
    expect(detectsWakeWord('add blood pressure 120 over 80')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(detectsWakeWord('')).toBe(false);
  });

  it('detects wake word mid-sentence', () => {
    expect(detectsWakeWord('ok so bahmni register patient')).toBe(true);
  });
});

describe('extractCommandPortion', () => {
  it('extracts command after "hey bahmni"', () => {
    expect(extractCommandPortion('hey bahmni add blood pressure 120 over 80 for ramesh')).toBe(
      'add blood pressure 120 over 80 for ramesh',
    );
  });

  it('extracts command after "bahmni" alone (no "hey")', () => {
    expect(extractCommandPortion('bahmni register patient Sita')).toBe('register patient Sita');
  });

  it('returns empty string when only wake word is present', () => {
    expect(extractCommandPortion('hey bahmni')).toBe('');
  });

  it('strips trailing comma/punctuation after wake word', () => {
    expect(extractCommandPortion('hey bahmni, add fever for ravi')).toBe('add fever for ravi');
  });

  it('handles "bahm" variant and extracts command', () => {
    expect(extractCommandPortion('hey bahm search patient ramesh')).toBe('search patient ramesh');
  });

  it('is case-insensitive', () => {
    expect(extractCommandPortion('HEY BAHMNI add patient')).toBe('add patient');
  });

  it('returns the full string unchanged when no wake word prefix', () => {
    // If the wake word isn't at the start, nothing is stripped.
    const input = 'add blood pressure for ramesh';
    expect(extractCommandPortion(input)).toBe(input);
  });
});
