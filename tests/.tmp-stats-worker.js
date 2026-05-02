
      const { parentPort } = require('worker_threads');
      setTimeout(() => parentPort.postMessage({ done: true }), 200);
    