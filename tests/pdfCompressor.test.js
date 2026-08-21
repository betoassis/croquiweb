const { PDFDocument, rgb } = require('pdf-lib');
const { compressPdfBuffer } = require('../middleware/pdfCompressor');

async function testPdfCompressor() {
  console.log('🧪 Testando Módulo de Compactação de PDF (pdfCompressor)...');

  // Criar um PDF básico em memória
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  page.drawText('Croqui Web Test Document', { x: 50, y: 700, size: 24, color: rgb(0, 0.5, 0.8) });
  
  const rawBytes = await pdfDoc.save();
  const rawBuffer = Buffer.from(rawBytes);

  console.log(`📄 Tamanho PDF original de teste: ${rawBuffer.length} bytes`);

  const result = await compressPdfBuffer(rawBuffer);

  console.assert(result.buffer && Buffer.isBuffer(result.buffer), 'Deve retornar um Buffer válido');
  console.assert(result.originalSize === rawBuffer.length, 'Original size deve corresponder ao buffer enviado');

  console.log(`✅ Teste pdfCompressor concluído com sucesso! Tamanho final: ${result.newSize} bytes.`);
}

testPdfCompressor().catch(err => {
  console.error('❌ Erro no teste do pdfCompressor:', err);
  process.exit(1);
});
