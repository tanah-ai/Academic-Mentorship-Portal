const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');

// Teaching eligibility grades - mentors can only teach modules with these grades
const teachingEligibleGrades = new Set(['A', '2.1', '2.2']);

// Grade mapping for normalization
const gradeMap = new Map([
  ['DISTINCTION', 'A'],
  ['DIST', 'A'],
  ['1', 'A'],
  ['A', 'A'],
  ['2.1', '2.1'],
  ['21', '2.1'],
  ['FIRST CLASS', '2.1'],
  ['2.2', '2.2'],
  ['22', '2.2'],
  ['SECOND CLASS', '2.2'],
  ['3', '3'],
  ['PASS', 'PASS'],
  ['P', 'PASS'],
  ['FAIL', 'FAIL'],
  ['F', 'FAIL']
]);

const normalizeText = (text) => text
  .toUpperCase()
  .replace(/\u00A0/g, ' ')
  .replace(/[|]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Expanded pattern to catch all grades including 3, Pass, Fail
const gradePattern = /(DISTINCTION|DIST\.?|FIRST\s+CLASS|SECOND\s+CLASS|2\.1|2\.2|\b21\b|\b22\b|\b1\b|\bA\b|\b3\b|PASS|FAIL|P|F)/i;

const extractText = async (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (extension === '.pdf') {
    const result = await pdfParse(buffer);
    if (result.text?.trim()) return result.text;

    // Scanned PDFs have no text layer, so render each page and OCR it.
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(filePath, { scale: 2 });
    const worker = await createWorker('eng');
    const pages = [];

    try {
      for await (const page of document) {
        const ocrResult = await worker.recognize(page);
        pages.push(ocrResult.data.text);
      }
    } finally {
      await worker.terminate();
      document.destroy();
    }

    return pages.join('\n');
  }

  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
};

const parseTranscript = async (filePath, catalogue) => {
  const rawText = await extractText(filePath);
  const text = normalizeText(rawText);
  const matches = [];
  const matchedModuleIds = new Set();

  console.log('Transcript text length:', text.length);
  console.log('Number of modules in catalogue:', catalogue.length);
  console.log('First 1000 characters of transcript text:', text.substring(0, 1000));
  
  // Save full transcript text to a file for inspection
  const fs = require('fs');
  const path = require('path');
  const debugPath = path.join(__dirname, '../../transcript_debug.txt');
  fs.writeFileSync(debugPath, text, 'utf8');
  console.log('Full transcript text saved to:', debugPath);

  for (const module of catalogue) {
    const moduleCode = module.module_code.toUpperCase();
    const codeIndex = text.indexOf(moduleCode);
    
    if (codeIndex === -1) {
      console.log('Module code NOT found in transcript:', moduleCode);
      continue;
    }
    
    console.log('Module code found:', moduleCode, 'at index:', codeIndex);
    
    if (matchedModuleIds.has(module.id)) continue;

    // Transcript rows commonly place the result after the module code/name.
    const rowText = text.slice(codeIndex, codeIndex + 240);
    const gradeMatch = rowText.match(gradePattern);
    
    if (!gradeMatch) {
      console.log('No grade match found for module:', moduleCode, 'rowText:', rowText.substring(0, 100));
      continue;
    }

    const rawGrade = gradeMatch[1].toUpperCase().replace('.', '.');
    const grade = gradeMap.get(rawGrade) || gradeMap.get(rawGrade.replace('.', '.'));
    
    if (!grade) {
      console.log('Grade not in map:', rawGrade);
      continue;
    }

    // Check if this grade is eligible for teaching
    const canTeach = teachingEligibleGrades.has(grade);

    console.log('Module matched:', moduleCode, 'Grade:', grade, 'Can teach:', canTeach);

    matches.push({
      module_id: module.id,
      module_code: module.module_code,
      grade,
      can_teach: canTeach,
      semester_completed: null,
      year_completed: null
    });
    matchedModuleIds.add(module.id);
  }

  return { textFound: text.length > 0, matches };
};

module.exports = { parseTranscript };