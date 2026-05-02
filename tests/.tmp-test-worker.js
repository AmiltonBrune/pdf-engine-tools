
      const { parentPort } = require('worker_threads');
      parentPort.postMessage({ success: true, value: 42 });
    