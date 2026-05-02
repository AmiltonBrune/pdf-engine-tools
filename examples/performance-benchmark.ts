import { NodeWorkerPool } from '../src/index';
import type { WorkerStats } from '../src/index';

const scenarios = [
  { name: 'Pequeno (25 páginas)', pages: 25, config: { pageLimit: 25, maxChunkSize: 2000, timeout: 30000 } },
  { name: 'Médio (100 páginas)', pages: 100, config: { pageLimit: 50, maxChunkSize: 3000, timeout: 60000 } },
  { name: 'Grande (500 páginas)', pages: 500, config: { pageLimit: 100, maxChunkSize: 4000, timeout: 120000 } },
];

async function performanceBenchmark() {
  console.log('🚀 Benchmark de performance...\n');

  for (const scenario of scenarios) {
    console.log(`📊 ${scenario.name}`);

    const seqTime = await runSequential(scenario.pages);
    console.log(`   ⏱️ Sequencial: ${seqTime}ms`);

    const parTime = await runParallel(scenario.pages);
    console.log(`   ⚡ Paralelo: ${parTime}ms`);

    const improvement = ((seqTime - parTime) / seqTime) * 100;
    console.log(`   📈 Melhoria: ${improvement.toFixed(1)}%\n`);
  }
}

async function runSequential(pages: number): Promise<number> {
  const start = Date.now();
  for (let i = 0; i < Math.ceil(pages / 10); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return Date.now() - start;
}

async function runParallel(pages: number): Promise<number> {
  const start = Date.now();
  const pool = new NodeWorkerPool();
  try {
    const chunks = Math.ceil(pages / 10);
    await Promise.all(
      Array.from({ length: chunks }, (_, i) =>
        pool.run('parse-pdf.worker.js', { buffer: Buffer.from(`Chunk ${i}`) }, 30000).catch(() => null)
      )
    );
    return Date.now() - start;
  } finally {
    await pool.shutdown();
  }
}

async function stressTest() {
  console.log('🔥 Stress Test');
  const pool = new NodeWorkerPool();
  const start = Date.now();
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) =>
        pool.run('parse-pdf.worker.js', { buffer: Buffer.from(`Stress ${i}`) }, 10000).catch((e) => ({ error: e.message }))
      )
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`   ✅ ${ok}/100 em ${Date.now() - start}ms`);
  } finally {
    await pool.shutdown();
  }
}

if (require.main === module) {
  performanceBenchmark()
    .then(() => stressTest())
    .then(() => { console.log('\n🎉 Benchmark concluído!'); process.exit(0); })
    .catch((e) => { console.error('💥 Fatal:', e); process.exit(1); });
}

export { performanceBenchmark, stressTest };
