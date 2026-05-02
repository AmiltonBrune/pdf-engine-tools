import { NodePdfEngine } from '../src/index';
import type { PdfProcessingConfig } from '../src/index';

const config: PdfProcessingConfig = {
  pageLimit: 10,
  maxChunkSize: 2000,
  timeout: 60000,
  debug: true,
};

async function basicExample() {
  console.log('🚀 Iniciando exemplo básico...\n');

  const engine = new NodePdfEngine();

  try {
    const mockPdfBuffer = Buffer.from('PDF simulado para exemplo');

    console.log('🔄 Processando PDF...');
    const result = await engine.process(mockPdfBuffer, config);

    console.log('\n✅ Processamento concluído!');
    console.log('📊 Resultados:');
    console.log(`   - Sucesso: ${result.success}`);
    console.log(`   - Páginas: ${result.pageCount}`);
    console.log(`   - Texto extraído: ${result.text.substring(0, 100)}...`);
    console.log(`   - Assinado: ${result.isSigned ? 'Sim' : 'Não'}`);
    console.log(`   - Corrompido: ${result.isCorrupted ? 'Sim' : 'Não'}`);

    console.log('\n📈 Estatísticas do Worker Pool:');
    const stats = engine.getStats();
    console.log(`   - Workers ativos: ${stats.activeWorkers}`);
    console.log(`   - Concorrência: ${stats.concurrency}`);
    console.log(`   - CPU médio: ${stats.cpuAvg}`);
    console.log(`   - Pode aceitar: ${stats.canAccept ? 'Sim' : 'Não'}`);
  } catch (error) {
    console.error('❌ Erro durante processamento:', error);
  } finally {
    await engine.shutdown();
  }
}

if (require.main === module) {
  basicExample()
    .then(() => { console.log('\n🎉 Exemplo concluído com sucesso!'); process.exit(0); })
    .catch((error) => { console.error('💥 Erro fatal:', error); process.exit(1); });
}

export { basicExample };
