import { NodePdfEngine, PdfEngineError } from '../src/index';
import type { PdfProcessingConfig, PdfProcessingResult } from '../src/index';

const config: PdfProcessingConfig = {
  pageLimit: 15,
  maxChunkSize: 3000,
  timeout: 120000,
  debug: true,
};

const mockPdfs = [
  { name: 'documento1.pdf', pages: 25, size: '5MB' },
  { name: 'documento2.pdf', pages: 50, size: '10MB' },
  { name: 'documento3.pdf', pages: 100, size: '20MB' },
];

async function advancedExample() {
  console.log('🚀 Iniciando exemplo avançado...\n');

  const engine = new NodePdfEngine();

  try {
    console.log('📦 Processando múltiplos PDFs...');
    const results: PdfProcessingResult[] = [];

    for (const pdf of mockPdfs) {
      console.log(`\n📄 Processando ${pdf.name} (${pdf.pages} páginas, ${pdf.size})`);

      try {
        const mockBuffer = Buffer.from(`PDF simulado: ${pdf.name}`);
        const result = await engine.process(mockBuffer, { ...config, pageLimit: Math.min(20, pdf.pages) });
        results.push(result);
        console.log(`   ✅ Sucesso: ${result.pageCount} páginas processadas`);
        if (result.truncated) console.log(`   ⚠️ PDF truncado (original: ${result.originalPageCount} páginas)`);
        if (result.isSigned) console.log(`   🔐 PDF assinado digitalmente`);
      } catch (error) {
        console.error(`   ❌ Erro ao processar ${pdf.name}:`, error);
      }
    }

    console.log('\n🔄 Combinando resultados...');
    const combined = await engine.processMultiple(results);
    console.log(`📊 Resultado combinado: ${combined.pageCount} páginas, assinado: ${combined.isSigned ? 'Sim' : 'Não'}`);

    console.log('\n✂️ Demonstração de split...');
    const splitResult = await engine.split(Buffer.from('PDF grande'), `upload-${Date.now()}`, { chunkSize: 10 });
    console.log(`   ✅ PDF dividido em ${splitResult.totalParts} partes`);

    console.log('\n📈 Stats:');
    const stats = engine.getStats();
    console.log(`   - Workers: ${stats.activeWorkers}, Concorrência: ${stats.concurrency}, CPU: ${stats.cpuAvg}`);
  } catch (error) {
    console.error('❌ Erro:', error);
    if (error instanceof PdfEngineError) {
      console.error(`   Código: ${error.code}`);
    }
  } finally {
    await engine.shutdown();
  }
}

if (require.main === module) {
  advancedExample()
    .then(() => { console.log('\n🎉 Concluído!'); process.exit(0); })
    .catch((e) => { console.error('💥 Fatal:', e); process.exit(1); });
}

export { advancedExample };
