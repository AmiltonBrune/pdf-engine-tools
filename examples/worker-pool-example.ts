import { NodeWorkerPool } from '../src/index';
import type { WorkerStats } from '../src/index';

const pool = new NodeWorkerPool({
  log: (msg) => console.log(`[LOG] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
});

function displayStats(stats: WorkerStats) {
  console.log(`   Concorrência: ${stats.concurrency} | Workers: ${stats.activeWorkers} | Fila: ${stats.queueLength} | CPU: ${stats.cpuAvg}`);
}

async function workerPoolExample() {
  console.log('🚀 Worker Pool Example\n');

  try {
    displayStats(pool.getStats());

    console.log('\n⚡ Processando 5 tarefas...');
    const start = Date.now();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        pool.run('parse-pdf.worker.js', { buffer: Buffer.from(`Task ${i}`) }, 30000)
          .then((r) => { console.log(`   ✅ Task ${i} ok`); return r; })
          .catch((e) => { console.log(`   ❌ Task ${i} fail`); throw e; })
      )
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`\n⏱️ ${ok}/5 em ${Date.now() - start}ms`);
    displayStats(pool.getStats());

    console.log('\n🔥 Stress: 50 tarefas...');
    const stressResults = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        pool.run('parse-pdf.worker.js', { buffer: Buffer.from(`Stress ${i}`) }, 10000).catch(() => null)
      )
    );
    console.log(`   ✅ ${stressResults.filter((r) => r.status === 'fulfilled').length}/50 concluídas`);
  } finally {
    await pool.shutdown();
    console.log('✅ Pool finalizado');
  }
}

if (require.main === module) {
  workerPoolExample()
    .then(() => { console.log('\n🎉 Concluído!'); process.exit(0); })
    .catch((e) => { console.error('💥 Fatal:', e); process.exit(1); });
}

export { workerPoolExample };
