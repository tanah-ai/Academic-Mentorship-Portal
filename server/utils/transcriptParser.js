const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');

const MAX_OCR_PAGES = 10;
const OCR_RENDER_SCALE = 1.25;
let ocrQueue = Promise.resolve();

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
    if (result.numpages > MAX_OCR_PAGES) {
      const error = new Error(
        `This scanned transcript has ${result.numpages} pages; scanned PDFs are limited to ${MAX_OCR_PAGES} pages. Upload a searchable PDF instead.`
      );
      error.statusCode = 422;
      throw error;
    }

    const ocrTask = ocrQueue.then(async () => {
      const { pdf } = await import('pdf-to-img');
      const worker = await createWorker('eng');
      let document;
      const pages = [];

      try {
        document = await pdf(filePath, { scale: OCR_RENDER_SCALE });
        for await (const page of document) {
          const ocrResult = await worker.recognize(page);
          pages.push(ocrResult.data.text);
        }
      } finally {
        await worker.terminate();
        if (document) document.destroy();
      }

      return pages.join('\n');
    });
    ocrQueue = ocrTask.catch(() => {});
    return ocrTask;
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

  for (const module of catalogue) {
    const moduleCode = module.module_code.toUpperCase();
    const codeIndex = text.indexOf(moduleCode);
    
    if (codeIndex === -1) continue;
    
    if (matchedModuleIds.has(module.id)) continue;

    // Transcript rows commonly place the result after the module code/name.
    const rowText = text.slice(codeIndex, codeIndex + 240);
    const gradeMatch = rowText.match(gradePattern);
    
    if (!gradeMatch) continue;

    const rawGrade = gradeMatch[1].toUpperCase().replace('.', '.');
    const grade = gradeMap.get(rawGrade) || gradeMap.get(rawGrade.replace('.', '.'));
    
    if (!grade) continue;

    // Check if this grade is eligible for teaching
    const canTeach = teachingEligibleGrades.has(grade);

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