# pdf-engine-tools

[![npm version](https://badge.fury.io/js/pdf-engine-tools.svg)](https://www.npmjs.com/package/pdf-engine-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Processamento otimizado de PDFs com workers paralelos, extração de texto, detecção de assinaturas e split inteligente.

## Características

- **Workers paralelos** com ajuste automático de concorrência baseado em CPU
- **Clean Architecture** — core puro sem dependências externas
- **Extração de texto** otimizada via pdf2json
- **Split de PDFs** grandes em chunks via pdf-lib
- **Detecção de assinaturas** digitais
- **Facade `PdfEngine`** para API simplificada
- **TypeScript** com tipos completos

## Instalação

```bash
npm install pdf-engine-tools
```

## Uso rápido

```typescript
import { NodePdfEngine } from 'pdf-engine-tools';
import { readFileSync } from 'fs';

const engine = new NodePdfEngine();

const buffer = readFileSync('documento.pdf');
const result = await engine.process(buffer, {
  pageLimit: 12,
  maxChunkSize: 3000,
  timeout: 120000,
});

console.log(result.text);
console.log(result.pageCount);
console.log(result.isSigned);

await engine.shutdown();
```

## Fluxos de Funcionamento

### Processamento Principal (Sequência)

```mermaid
sequenceDiagram
    participant Cliente
    participant NodePdfEngine
    participant WorkerPool
    participant WorkerThread
    participant PdfPipeline

    Cliente->>NodePdfEngine: process(buffer, config)
    NodePdfEngine->>WorkerPool: run('full-pipeline.worker', data)
    WorkerPool->>WorkerThread: postMessage(data)
    activate WorkerThread
    WorkerThread->>PdfPipeline: execute(buffer)
    activate PdfPipeline
    PdfPipeline-->>WorkerThread: PipelineResult (text, chunks, etc)
    deactivate PdfPipeline
    WorkerThread-->>WorkerPool: postMessage(result)
    deactivate WorkerThread
    WorkerPool-->>NodePdfEngine: resolve(result)
    NodePdfEngine-->>Cliente: ProcessResult
```

### Pipeline de Extração (Fluxo Interno)

```mermaid
flowchart TD
    A[Buffer PDF] --> B(ParsePdfTask)
    B --> C{Páginas > pageLimit?}
    C -- Sim --> D(Truncar PDF)
    C -- Não --> E(Manter Intacto)
    D --> F(ExtractTextTask)
    E --> F
    F --> G(ChunkTextTask)
    G --> H(SplitPdfTask)
    H --> I[Resultado Final]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#bbf,stroke:#333,stroke-width:2px
```

## API

### `NodePdfEngine`

Facade principal — instancia adapters e worker pool internamente.

```typescript
const engine = new NodePdfEngine(logger?);

// Processar um PDF
const result = await engine.process(buffer, config);

// Combinar múltiplos resultados
const combined = await engine.processMultiple(results);

// Dividir PDF em partes
const split = await engine.split(buffer, 'upload-id', { chunkSize: 10 });

// Contar páginas (via worker)
const pages = await engine.getPageCount(buffer);

// Estatísticas do worker pool
const stats = engine.getStats();

// Shutdown
await engine.shutdown();
```

### Workers diretos

```typescript
import { NodeWorkerPool } from 'pdf-engine-tools';

const pool = new NodeWorkerPool();
const result = await pool.run('parse-pdf.worker.js', { buffer }, 60000);
await pool.shutdown();
```

### Split de PDF

```typescript
import { PdfLibSplitter } from 'pdf-engine-tools';

const splitter = new PdfLibSplitter();
const { chunks, totalParts } = await splitter.split(buffer, { chunkSize: 10 });
```

### Extração de texto

```typescript
import { Pdf2JsonExtractor } from 'pdf-engine-tools';

const extractor = new Pdf2JsonExtractor();
const result = await extractor.extract(buffer, { pageLimit: 20 });
console.log(result.text, result.isSigned, result.signatureDates);
```

## Configuração

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PDF_CPU_USAGE_LIMIT` | `80` | Limite de CPU (%) |
| `PDF_MAX_WORKERS` | CPUs | Máximo de workers |
| `PDF_MAX_CONCURRENCY` | `min(CPUs-1, 4)` | Concorrência inicial |
| `PDF_QUEUE_MAX` | `100` | Tamanho da fila |

### `PdfProcessingConfig`

```typescript
{
  pageLimit?: number;        // Limite de páginas (default: 12)
  enablePageLimit?: boolean; // Ativar limite (default: true)
  maxChunkSize?: number;     // Tamanho do chunk de texto (default: 3000)
  timeout?: number;          // Timeout em ms (default: 120000)
  debug?: boolean;           // Logs de debug (default: false)
}
```

## Arquitetura (Clean Architecture)

```mermaid
graph TD
    subgraph Node[Node.js Environment]
        Facade[NodePdfEngine]
        Pool[NodeWorkerPool]
        Workers[Worker Threads]
    end

    subgraph Adapters[Adapters / Infra]
        P2J[Pdf2JsonExtractor]
        PLib[PdfLibSplitter]
    end

    subgraph Core[Core / Regras Puras]
        Pipeline[PdfPipeline]
        Tasks[Tasks: Parse, Extract, Split]
        Contracts[Interfaces]
    end

    Facade -->|usa| Pool
    Pool -->|spawna| Workers
    Workers -->|injeta adapters| Adapters
    Workers -->|executa| Pipeline
    Pipeline -->|orquestra| Tasks
    Tasks -->|dependem de| Contracts
    Adapters -.->|implementam| Contracts

    classDef core fill:#d4edda,stroke:#28a745,color:#333,stroke-width:2px;
    classDef adapter fill:#fff3cd,stroke:#ffc107,color:#333,stroke-width:2px;
    classDef node fill:#cce5ff,stroke:#007bff,color:#333,stroke-width:2px;

    class Pipeline,Tasks,Contracts core;
    class P2J,PLib adapter;
    class Facade,Pool,Workers node;
```

Estrutura de diretórios:
```
src/
├── core/           # Regras puras — sem deps externas
│   ├── contracts/  # Interfaces: PdfParser, PdfSplitter, PdfTextExtractor, PdfChunker
│   ├── errors/     # PdfEngineError, PdfParseError, PdfWorkerError
│   ├── pipeline/   # PdfPipeline, PipelineExecutor
│   ├── tasks/      # ParsePdfTask, ExtractTextTask, SplitPdfTask, ChunkTextTask
│   └── types.ts
├── adapters/       # Implementações concretas
│   ├── pdf-lib/    # PdfLibSplitter (usa pdf-lib)
│   └── pdf2json/   # Pdf2JsonExtractor (usa pdf2json)
├── node/           # Node.js specific
│   ├── NodePdfEngine, NodeWorkerPool, NodeFsAdapter
│   └── buffer-utils
├── workers/        # Worker threads
│   ├── parse-pdf.worker.ts
│   ├── extract-text.worker.ts
│   └── full-pipeline.worker.ts
├── pdf-engine.ts   # Interface PdfEngine
└── index.ts
```

**Regra:** `core/` não conhece pdf-lib, pdf2json, worker_threads nem fs.

## Tratamento de erros

```typescript
import { PdfEngineError, PdfParseError, PdfWorkerError } from 'pdf-engine-tools';

try {
  await engine.process(buffer);
} catch (error) {
  if (error instanceof PdfParseError) {
    console.error(`Parse error [${error.code}]:`, error.message);
  } else if (error instanceof PdfWorkerError) {
    console.error('Worker error:', error.message);
  }
}
```

## Performance

| PDF | Páginas | Sequencial | Paralelo | Melhoria |
|---|---|---|---|---|
| 5MB | 50 | 2.5s | 0.8s | 3.1x |
| 20MB | 200 | 12.3s | 3.2s | 3.8x |
| 100MB | 1000 | 45.7s | 8.9s | 5.1x |

## Licença

MIT — [LICENSE](LICENSE)

## Autor

**Amilton Brune** — [@amiltonbrune](https://github.com/amiltonbrune)