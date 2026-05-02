import PDFParser from 'pdf2json';
import { parentPort, workerData } from 'worker_threads';
import { normalizeBuffer } from '../node/buffer-utils';

process.env.PDF2JSON_DISABLE_LOGS = '1';

interface PageCountResponse {
  success: boolean;
  pageCount?: number;
  error?: string;
}

async function getPdfPageCount(buffer: Buffer): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const parser = new PDFParser(null, false);
    const timeout = setTimeout(() => reject(new Error('Timeout ao processar PDF')), 30000);

    parser.on('pdfParser_dataReady', (data: any) => {
      clearTimeout(timeout);
      const pages = data?.Pages || data?.formImage?.Pages;
      resolve(Array.isArray(pages) ? pages.length : 0);
    });

    parser.on('pdfParser_dataError', (err: any) => {
      clearTimeout(timeout);
      reject(new Error(err?.parserError || err?.message || 'Erro ao processar PDF'));
    });

    (parser as any).on('error', (err: any) => {
      clearTimeout(timeout);
      reject(new Error(err?.message || 'Erro interno do parser PDF'));
    });

    parser.parseBuffer(buffer);
  });
}

async function workerInit(): Promise<void> {
  if (!parentPort) throw new Error('parentPort is not defined');

  try {
    if (!workerData?.buffer) throw new Error('Buffer ausente no workerData');
    const buffer = normalizeBuffer(workerData.buffer);
    const pageCount = await getPdfPageCount(buffer);
    parentPort.postMessage({ success: true, pageCount } as PageCountResponse);
  } catch (error: any) {
    parentPort.postMessage({ success: false, error: error?.message || 'Erro desconhecido' } as PageCountResponse);
  }
}

workerInit().catch((error) => {
  if (parentPort) parentPort.postMessage({ success: false, error: error.message || 'Erro crítico no worker' });
  process.exit(1);
});
