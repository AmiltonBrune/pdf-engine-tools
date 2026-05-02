import { parentPort, workerData } from 'worker_threads';
import { Pdf2JsonExtractor } from '../adapters/pdf2json/pdf2json-extractor';
import { normalizeBuffer } from '../node/buffer-utils';
import { ExtractResult } from '../core/types';

process.env.PDF2JSON_DISABLE_LOGS = '1';

interface ExtractTextResponse {
  success: boolean;
  result?: ExtractResult;
  error?: string;
}

async function workerInit(): Promise<void> {
  if (!parentPort) throw new Error('parentPort is not defined');

  try {
    if (!workerData?.buffer) throw new Error('Buffer ausente no workerData');
    const buffer = normalizeBuffer(workerData.buffer);
    const pageLimit = workerData.pageLimit;

    const extractor = new Pdf2JsonExtractor();
    const result = await extractor.extract(buffer, { pageLimit });

    parentPort.postMessage({ success: true, result } as ExtractTextResponse);
  } catch (error: any) {
    parentPort.postMessage({ success: false, error: error?.message || 'Erro desconhecido' } as ExtractTextResponse);
  }
}

workerInit().catch((error) => {
  if (parentPort) parentPort.postMessage({ success: false, error: error.message || 'Erro crítico' });
  process.exit(1);
});
