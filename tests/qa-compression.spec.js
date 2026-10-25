const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const zlib = require('node:zlib');

function requestRaw(path, encoding) {
  return new Promise((resolve, reject) => {
    const req = http.get('http://127.0.0.1:4173' + path, {
      headers: {'Accept-Encoding': encoding}
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
      response.on('error', reject);
    });
    req.on('error', reject);
  });
}

test('QA static assets support Brotli, gzip, and identity with identical decoded bytes', async () => {
  const expected = fs.readFileSync('app.js');
  for (const [accept, encoding] of [['br', 'br'], ['gzip', 'gzip'], ['identity', undefined]]) {
    const response = await requestRaw('/app.js', accept);
    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe(encoding);
    expect(response.headers['vary']).toBe('Accept-Encoding');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    const decoded = encoding === 'br'
      ? zlib.brotliDecompressSync(response.body)
      : encoding === 'gzip' ? zlib.gunzipSync(response.body) : response.body;
    expect(decoded.equals(expected)).toBe(true);
  }
  const font = await requestRaw('/fonts/login/ToolFlowUI.86.woff2', 'br');
  expect(font.status).toBe(200);
  expect(font.headers['content-encoding']).toBeUndefined();
});
