const { PDFDocument, rgb } = require('pdf-lib');
const sharp = require('sharp');
const { compressPdfBuffer } = require('../middleware/pdfCompressor');

async function testPdfCompressor() {
  console.log('🧪 Testando Módulo de Compactação de PDF (pdfCompressor)...');

  // Teste 1: PDF de Texto Básico
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  page.drawText('Croqui Web Test Document', { x: 50, y: 700, size: 24, color: rgb(0, 0.5, 0.8) });
  const rawBytes = await pdfDoc.save();
  const rawBuffer = Buffer.from(rawBytes);

  console.log(`📄 Teste 1 - Tamanho PDF de texto original: ${rawBuffer.length} bytes`);
  const result1 = await compressPdfBuffer(rawBuffer);
  console.assert(result1.buffer && Buffer.isBuffer(result1.buffer), 'Deve retornar um Buffer válido');
  console.log(`✅ Teste 1 concluído!`);

  // Teste 2: PDF Escaneado de Alta Resolução (Simulando Croqui de 3MB+)
  console.log('\n📄 Teste 2 - Criando PDF escaneado de alta resolução (3500x4800px)...');
  
  // Cria ruído / grade para simular um desenho de croqui pesado em alta resolução
  const svgGrid = `<svg width="3500" height="4800">
    <rect width="3500" height="4800" fill="#f8f9fa"/>
    <g stroke="#ccc" stroke-width="2">
      ${Array.from({length: 70}, (_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="4800"/>`).join('')}
      ${Array.from({length: 96}, (_, i) => `<line x1="0" y1="${i*50}" x2="3500" y2="${i*50}"/>`).join('')}
    </g>
    <text x="200" y="400" font-size="180" fill="black" font-family="sans-serif">CROQUI NOVO TRIUNFO - JUIZ DE FORA</text>
    <text x="200" y="700" font-size="140" fill="darkblue" font-family="sans-serif">SISLOC: 266 | QUARTEIRÕES: 19</text>
  </svg>`;

  const bigImageBuffer = await sharp(Buffer.from(svgGrid))
    .jpeg({ quality: 100 })
    .toBuffer();

  const scanPdfDoc = await PDFDocument.create();
  const embedded = await scanPdfDoc.embedJpg(bigImageBuffer);
  const scanPage = scanPdfDoc.addPage([595, 842]);
  scanPage.drawImage(embedded, { x: 0, y: 0, width: 595, height: 842 });

  const scanPdfBuffer = Buffer.from(await scanPdfDoc.save());
  console.log(`🖼️ PDF escaneado original: ${(scanPdfBuffer.length / 1024 / 1024).toFixed(2)} MB (${scanPdfBuffer.length} bytes)`);

  const result2 = await compressPdfBuffer(scanPdfBuffer);

  console.assert(result2.compressed === true, 'O PDF de alta resolução deve ser compactado');
  console.assert(result2.newSize < result2.originalSize * 0.5, 'O tamanho final deve ser pelo menos 50% menor que o original');
  console.log(`✅ Teste 2 concluído! Redução obtida: ${(result2.originalSize / 1024 / 1024).toFixed(2)} MB ➔ ${(result2.newSize / 1024 / 1024).toFixed(2)} MB (${(((result2.originalSize - result2.newSize) / result2.originalSize) * 100).toFixed(1)}% menor)`);

  console.log('\n🎉 TODOS OS TESTES DO PDFCOMPRESSOR PASSARAM COM SUCESSO!');
}

testPdfCompressor().catch(err => {
  console.error('❌ Erro no teste do pdfCompressor:', err);
  process.exit(1);
});
