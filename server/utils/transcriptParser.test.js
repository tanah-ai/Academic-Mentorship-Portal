const { parseTranscriptText } = require('./transcriptParser');

describe('parseTranscriptText', () => {
  const catalogue = [
    { id: 'module-1', module_code: 'ACC107' },
    { id: 'module-2', module_code: 'BM105' },
    { id: 'module-3', module_code: 'BM131' },
    { id: 'module-4', module_code: 'CS131' }
  ];

  test('matches module codes separated by spaces and recognizes spaced decimal grades', () => {
    const result = parseTranscriptText(
      'ACC 107 Accounting Concepts 2 . 1\nBM-105 Principles of Management A',
      catalogue
    );

    expect(result.moduleCodesFound).toBe(2);
    expect(result.matches).toEqual([
      expect.objectContaining({ module_id: 'module-1', grade: '2.1', can_teach: true }),
      expect.objectContaining({ module_id: 'module-2', grade: 'A', can_teach: true })
    ]);
  });

  test('does not match a module code embedded in a longer code', () => {
    const result = parseTranscriptText('ACC1070 Accounting Concepts 2.1', catalogue);

    expect(result.moduleCodesFound).toBe(0);
    expect(result.matches).toHaveLength(0);
  });

  test('matches OCR confusions between zero and O and between one, I, and L', () => {
    const result = parseTranscriptText(
      'BM13I Principles of Management 2.I\nCSI3I Basic Communication Skills 2.1',
      catalogue
    );

    expect(result.moduleCodesFound).toBe(2);
    expect(result.matches).toEqual([
      expect.objectContaining({ module_id: 'module-3', grade: '2.1', can_teach: true }),
      expect.objectContaining({ module_id: 'module-4', grade: '2.1', can_teach: true })
    ]);
  });
});
