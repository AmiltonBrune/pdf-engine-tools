import { readFileSync } from 'fs';
import { join } from 'path';
import { Pdf2JsonExtractor } from '../../src/adapters/pdf2json/pdf2json-extractor';

const PDF_DIR = join(__dirname, '..', 'pdfs');

describe('Pdf2JsonExtractor', () => {
  const extractor = new Pdf2JsonExtractor();

  describe('extract com PDFs reais', () => {
    it('deve extrair texto de documento1.pdf (25 páginas)', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await extractor.extract(buffer);

      expect(result.pageCount).toBe(25);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.isCorrupted).toBe(false);
      expect(typeof result.isSigned).toBe('boolean');
      expect(Array.isArray(result.signatureDates)).toBe(true);
      expect(result.rawData).toBeDefined();
      expect(result.originalPageCount).toBe(25);
    });

    it('deve extrair texto de documento2.pdf', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento2.pdf'));
      const result = await extractor.extract(buffer);

      expect(result.pageCount).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.isCorrupted).toBe(false);
    });
  });

  describe('truncamento com pageLimit', () => {
    it('deve truncar quando pageLimit < totalPages', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await extractor.extract(buffer, { pageLimit: 5 });

      expect(result.pageCount).toBe(5);
      expect(result.originalPageCount).toBe(25);
      expect(result.truncated).toBe(true);
    });

    it('deve não truncar quando pageLimit >= totalPages', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await extractor.extract(buffer, { pageLimit: 100 });

      expect(result.pageCount).toBe(25);
      expect(result.truncated).toBe(false);
    });

    it('deve ignorar pageLimit=0 (falsy)', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await extractor.extract(buffer, { pageLimit: 0 });
      expect(result.truncated).toBe(false);
    });

    it('deve ignorar pageLimit negativo (falsy via &&)', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await extractor.extract(buffer, { pageLimit: -1 });
      expect(result.pageCount).toBe(25);
    });

    it('deve funcionar sem options', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await extractor.extract(buffer);
      expect(result.truncated).toBe(false);
      expect(result.originalPageCount).toBe(result.pageCount);
    });
  });

  describe('inputs inválidos', () => {
    it('deve retornar corrupted para buffer vazio (linha 10-11)', async () => {
      const result = await extractor.extract(new Uint8Array([]));
      expect(result.isCorrupted).toBe(true);
      expect(result.pageCount).toBe(0);
      expect(result.text).toBe('');
    });

    it('deve retornar corrupted para buffer não-PDF (linha 15-16)', async () => {
      const result = await extractor.extract(Buffer.from('isto não é um PDF'));
      expect(result.isCorrupted).toBe(true);
      expect(result.pageCount).toBe(0);
    });

    it('deve retornar corrupted para dados binários com header PDF falso (cobre linhas 87, 97-98)', async () => {
      const fakeBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4'),
        Buffer.alloc(100, 0xFF),
      ]);
      const result = await extractor.extract(fakeBuffer);
      expect(result.isCorrupted).toBe(true);
    });
  });

  describe('extractPageByPage fallback', () => {
    it('deve extrair página a página quando o documento principal falhar no pdf2json mas puder ser lido pelo pdf-lib', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const ext = new Pdf2JsonExtractor();
      const parseSpy = jest.spyOn(ext as any, 'parseWithPdf2Json');

      // 1st call: full doc fails
      parseSpy.mockImplementationOnce(() => Promise.resolve({ text: '', pageCount: 0, isCorrupted: true }));
      // subsequent calls: real implementation for single pages
      
      const result = await ext.extract(buffer);
      
      expect(parseSpy).toHaveBeenCalled();
      expect(result.pageCount).toBe(25);
      expect(result.isCorrupted).toBe(false);
      expect(result.errorPages).toEqual([]);
      expect(result.text.length).toBeGreaterThan(0);
      
      parseSpy.mockRestore();
    });

    it('deve registrar as páginas com erro no array errorPages caso alguma página individual falhe', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento2.pdf'));
      const ext = new Pdf2JsonExtractor();
      const parseSpy = jest.spyOn(ext as any, 'parseWithPdf2Json');
      
      // 1ª chamada: principal falha
      parseSpy.mockImplementationOnce(() => Promise.resolve({ text: '', pageCount: 0, isCorrupted: true }));
      // 2ª chamada: página 1 falha
      parseSpy.mockImplementationOnce(() => Promise.resolve({ text: '', pageCount: 0, isCorrupted: true }));
      // 3ª e demais chamadas: sucesso mockado
      parseSpy.mockImplementation(() => Promise.resolve({ text: 'texto da pagina extra', pageCount: 1, isCorrupted: false, isSigned: true, signatureDates: ['2024-01-01'] }));
      
      const result = await ext.extract(buffer);
      
      expect(result.errorPages).toContain(1);
      expect(result.text).toContain('texto da pagina extra');
      expect(result.isSigned).toBe(true);
      expect(result.signatureDates).toContain('2024-01-01');
      expect(result.isCorrupted).toBe(false);
      
      parseSpy.mockRestore();
    });

    it('deve marcar o documento como isCorrupted=true se TODAS as páginas falharem', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento2.pdf'));
      const ext = new Pdf2JsonExtractor();
      const parseSpy = jest.spyOn(ext as any, 'parseWithPdf2Json');
      
      parseSpy.mockImplementation(() => Promise.resolve({ text: '', pageCount: 0, isCorrupted: true }));
      
      const result = await ext.extract(buffer);
      expect(result.isCorrupted).toBe(true);
      expect(result.errorPages?.length).toBeGreaterThan(0);
      
      parseSpy.mockRestore();
    });

    it('deve lidar com falhas ao isolar páginas com pdf-lib (cobre try/catch interno do loop)', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento2.pdf'));
      const ext = new Pdf2JsonExtractor();
      const parseSpy = jest.spyOn(ext as any, 'parseWithPdf2Json');
      
      parseSpy.mockImplementationOnce(() => Promise.resolve({ text: '', pageCount: 0, isCorrupted: true }));
      
      const { PDFDocument } = require('pdf-lib');
      const originalCreate = PDFDocument.create;
      
      // Força exceção ao tentar criar um PDFDocument para a página isolada
      PDFDocument.create = jest.fn().mockRejectedValue(new Error('Mock create error'));
      
      const result = await ext.extract(buffer);
      
      expect(result.isCorrupted).toBe(true);
      expect(result.errorPages?.length).toBeGreaterThan(0);
      
      PDFDocument.create = originalCreate;
      parseSpy.mockRestore();
    });

    it('deve lidar com erros durante a estruturacao de dados apos o parsing do pdf2json (linha 144)', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento2.pdf'));
      const ext = new Pdf2JsonExtractor();
      const extractTextSpy = jest.spyOn(ext as any, 'extractText');
      
      // Força a extração de texto a quebrar
      extractTextSpy.mockImplementationOnce(() => { throw new Error('Crash extracting text'); });
      
      // Isso fará com que o parse principal falhe e o fallback aconteça
      const result = await ext.extract(buffer);
      
      // Vai tentar o fallback e extrair normalmente (já que mockamos só Once)
      expect(result.isCorrupted).toBe(false);
      
      extractTextSpy.mockRestore();
    });
  });

  describe('extractText fallback (linhas 103-142)', () => {
    it('deve exercitar o fallback de extractText quando getRawTextContent retorna vazio', async () => {
      const buffer = readFileSync(join(PDF_DIR, 'documento1.pdf'));
      const result = await extractor.extract(buffer);
      expect(typeof result.text).toBe('string');
    });
  });

  describe('extractSignatureDates (linhas 145-161)', () => {
    it('deve exercitar extractSignatureDates com campo de assinatura D: format', async () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [
        {
          Fields: [
            {
              T: { Name: 'signature' },
              Sig: { M: 'D:20240115120000+00\'00\'' },
            },
          ],
        },
      ];

      const dates = ext.extractSignatureDates(pages);
      expect(dates).toContain('2024-01-15');
      expect(dates.length).toBeGreaterThanOrEqual(2);
    });

    it('deve exercitar extractSignatureDates com sigDate sem D: prefix', async () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [
        {
          Fields: [
            {
              T: { Name: 'signature' },
              Sig: { M: '2024-03-20T10:00:00Z' },
            },
          ],
        },
      ];

      const dates = ext.extractSignatureDates(pages);
      expect(dates).toContain('2024-03-20');
    });

    it('deve retornar vazio quando não há campos de assinatura', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [{ Fields: [] }, {}];
      const dates = ext.extractSignatureDates(pages);
      expect(dates).toEqual([]);
    });

    it('deve ignorar campos que não são signature', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [
        {
          Fields: [
            { T: { Name: 'textfield' }, Sig: { M: '2024-01-01' } },
            { T: { Name: 'checkbox' } },
          ],
        },
      ];
      const dates = ext.extractSignatureDates(pages);
      expect(dates).toEqual([]);
    });

    it('deve ignorar signature sem Sig.M', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [
        { Fields: [{ T: { Name: 'signature' } }] },
      ];
      const dates = ext.extractSignatureDates(pages);
      expect(dates).toEqual([]);
    });

    it('deve lidar com D: curto (< 8 chars)', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [
        { Fields: [{ T: { Name: 'signature' }, Sig: { M: 'D:2024' } }] },
      ];
      const dates = ext.extractSignatureDates(pages);
      expect(dates).toContain('D:2024');
      expect(dates.length).toBe(1);
    });
  });

  describe('hasSignature (linhas 164-177)', () => {
    it('deve detectar signature pelo campo T.Name === "signature"', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [{ Fields: [{ T: { Name: 'signature' } }] }];
      expect(ext.hasSignature(pages, '')).toBe(true);
    });

    it('deve detectar signature pelo campo Sig.M', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [{ Fields: [{ Sig: { M: '2024-01-01' } }] }];
      expect(ext.hasSignature(pages, '')).toBe(true);
    });

    it('deve detectar signature pelo T.Name contendo "sign"', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const pages = [{ Fields: [{ T: { Name: 'digital_signature_field' } }] }];
      expect(ext.hasSignature(pages, '')).toBe(true);
    });

    it('deve detectar assinatura digital no texto', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      expect(ext.hasSignature([{ Fields: [] }], 'Documento com Assinatura Digital válida')).toBe(true);
    });

    it('deve detectar "digitally signed" no texto', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      expect(ext.hasSignature([{ Fields: [] }], 'This document is Digitally Signed')).toBe(true);
    });

    it('deve detectar "signature" no texto', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      expect(ext.hasSignature([{ Fields: [] }], 'Contains a valid signature')).toBe(true);
    });

    it('deve retornar false quando não há indicação de assinatura', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      expect(ext.hasSignature([{ Fields: [] }], 'Texto sem indicação')).toBe(false);
    });

    it('deve retornar false para páginas sem Fields', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      expect(ext.hasSignature([{}], 'nada aqui')).toBe(false);
    });

    it('deve lidar com texto vazio/null', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      expect(ext.hasSignature([{ Fields: [] }], '')).toBe(false);
      expect(ext.hasSignature([{ Fields: [] }], null)).toBe(false);
    });
  });

  describe('isSignedWithinNDays (linhas 179-185)', () => {
    it('deve retornar false para lista vazia', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      expect(ext.isSignedWithinNDays([], 2)).toBe(false);
    });

    it('deve retornar true para data de hoje', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const today = new Date().toISOString().split('T')[0];
      expect(ext.isSignedWithinNDays([today], 2)).toBe(true);
    });

    it('deve retornar true para data de ontem', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      expect(ext.isSignedWithinNDays([yesterday], 2)).toBe(true);
    });

    it('deve retornar false para data antiga (30 dias atrás)', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const oldDate = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      expect(ext.isSignedWithinNDays([oldDate], 2)).toBe(false);
    });

    it('deve retornar true se qualquer data estiver no range', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const today = new Date().toISOString().split('T')[0];
      const oldDate = '2020-01-01';
      expect(ext.isSignedWithinNDays([oldDate, today], 2)).toBe(true);
    });

    it('deve retornar false para data futura', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      expect(ext.isSignedWithinNDays([futureDate], 2)).toBe(false);
    });
  });

  describe('extractText fallback com dados mockados (linhas 129-130)', () => {
    it('deve decodificar tokens com %', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const mockParser = { getRawTextContent: () => '' };
      const data = {
        Pages: [
          {
            Texts: [
              { R: [{ T: 'Hello%20World' }] },
            ],
          },
        ],
      };

      const text = ext.extractText(mockParser, data);
      expect(text).toContain('Hello World');
    });

    it('deve usar token original quando decodeURIComponent falha (linha 130)', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const mockParser = { getRawTextContent: () => '' };
      const data = {
        Pages: [
          {
            Texts: [
              { R: [{ T: '%ZZinvalid%percent' }] },
            ],
          },
        ],
      };

      const text = ext.extractText(mockParser, data);
      expect(text).toContain('%ZZinvalid%percent');
    });

    it('deve usar getRawTextContent quando disponível', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const mockParser = { getRawTextContent: () => 'texto raw' };
      const data = { Pages: [] };

      const text = ext.extractText(mockParser, data);
      expect(text).toBe('texto raw');
    });

    it('deve retornar vazio quando Pages é null', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const mockParser = { getRawTextContent: () => '' };
      const text = ext.extractText(mockParser, { Pages: null });
      expect(text).toBe('');
    });

    it('deve ignorar textos vazios e tokens não-string', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const mockParser = { getRawTextContent: () => '' };
      const data = {
        Pages: [
          {
            Texts: [
              { R: [{ T: '' }, { T: null }, { T: 123 }] },
            ],
          },
          { Texts: [] },
        ],
      };

      const text = ext.extractText(mockParser, data);
      expect(text).toBe('');
    });

    it('deve processar múltiplas páginas em chunks de 4', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const mockParser = { getRawTextContent: () => '' };
      const pages = Array.from({ length: 8 }, (_, i) => ({
        Texts: [{ R: [{ T: `Pagina${i}` }] }],
      }));

      const text = ext.extractText(mockParser, { Pages: pages });
      for (let i = 0; i < 8; i++) {
        expect(text).toContain(`Pagina${i}`);
      }
    });

    it('deve lidar com T.R ausente', () => {
      const ext = new (Pdf2JsonExtractor as any)();
      const mockParser = { getRawTextContent: () => '' };
      const data = {
        Pages: [{ Texts: [{ R: undefined }, {}] }],
      };

      const text = ext.extractText(mockParser, data);
      expect(text).toBe('');
    });
  });

  describe('parseWithPdf2Json error paths (linhas 87, 97-98)', () => {
    it('deve retornar corrupted quando parseBuffer lança exceção síncrona (linhas 97-98)', async () => {
      const ext = new (Pdf2JsonExtractor as any)();

      const PDFParserModule = require('pdf2json');
      const PDFParserClass = PDFParserModule.default || PDFParserModule;
      const originalParseBuffer = PDFParserClass.prototype.parseBuffer;
      PDFParserClass.prototype.parseBuffer = function () {
        throw new Error('parseBuffer crash');
      };

      try {
        const validPdf = readFileSync(join(PDF_DIR, 'documento1.pdf'));
        const result = await ext.parseWithPdf2Json(validPdf);
        expect(result.isCorrupted).toBe(true);
        expect(result.text).toBe('');
        expect(result.pageCount).toBe(0);
      } finally {
        PDFParserClass.prototype.parseBuffer = originalParseBuffer;
      }
    });

    it('deve retornar corrupted quando fail é chamado com settled=true (linha 55)', async () => {
      const ext = new (Pdf2JsonExtractor as any)();

      const PDFParserModule = require('pdf2json');
      const PDFParserClass = PDFParserModule.default || PDFParserModule;
      const originalParseBuffer = PDFParserClass.prototype.parseBuffer;

      PDFParserClass.prototype.parseBuffer = function (this: any) {
        this.emit('pdfParser_dataError', { parserError: 'erro forçado' });
        this.emit('pdfParser_dataError', { parserError: 'segundo erro' });
      };

      try {
        const validPdf = readFileSync(join(PDF_DIR, 'documento1.pdf'));
        const result = await ext.parseWithPdf2Json(validPdf);
        expect(result.isCorrupted).toBe(true);
      } finally {
        PDFParserClass.prototype.parseBuffer = originalParseBuffer;
      }
    });
  });
});
