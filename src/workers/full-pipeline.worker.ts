import { parentPort, workerData } from 'worker_threads';
import { Pdf2JsonExtractor } from '../adapters/pdf2json/pdf2json-extractor';
import { normalizeBuffer } from '../node/buffer-utils';

process.env.PDF2JSON_DISABLE_LOGS = '1';

interface FullPipelineResponse {
  success: boolean;
  text?: string;
  pdfData?: any;
  pageCount?: number;
  isSigned?: boolean;
  isSignedWithin2Days?: boolean;
  signatureDates?: string[];
  error?: string;
  originalPageCount?: number;
  truncated?: boolean;
  isCorrupted?: boolean;
}

const FAILURE: Omit<FullPipelineResponse, 'error'> = {
  success: false, text: '', pdfData: {}, pageCount: 0,
  isSigned: false, isSignedWithin2Days: false, signatureDates: [], isCorrupted: true,
};

async function workerInit(): Promise<void> {
  if (!parentPort) throw new Error('parentPort is not defined');

  try {
    if (!workerData?.buffer) throw new Error('Buffer ausente no workerData');
    const buffer = normalizeBuffer(workerData.buffer);
    const pageLimit = workerData.pageLimit;

    const extractor = new Pdf2JsonExtractor();
    const result = await extractor.extract(buffer, { pageLimit });

    parentPort.postMessage({
      success: true,
      text: result.text,
      pdfData: result.rawData,
      pageCount: result.pageCount,
      isSigned: result.isSigned,
      isSignedWithin2Days: result.isSignedWithin2Days,
      signatureDates: result.signatureDates,
      originalPageCount: result.originalPageCount,
      truncated: result.truncated,
      isCorrupted: result.isCorrupted,
    } as FullPipelineResponse);
  } catch (error: any) {
    parentPort.postMessage({ ...FAILURE, error: error?.message || 'Erro desconhecido' });
  }
}

workerInit().catch((err) => {
  if (parentPort) parentPort.postMessage({ ...FAILURE, error: err.message || 'Erro crítico' });
});
