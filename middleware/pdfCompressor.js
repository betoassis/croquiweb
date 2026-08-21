const { PDFDocument } = require('pdf-lib');

/**
 * Compacta um buffer de arquivo PDF otimizando fluxos de objetos e metadados desnecessários.
 * @param {Buffer} inputBuffer - Buffer original do arquivo PDF.
 * @returns {Promise<{ buffer: Buffer, compressed: boolean, originalSize: number, newSize: number }>}
 */
async function compressPdfBuffer(inputBuffer) {
  if (!inputBuffer || !Buffer.isBuffer(inputBuffer)) {
    return { buffer: inputBuffer, compressed: false, originalSize: 0, newSize: 0 };
  }

  const originalSize = inputBuffer.length;

  try {
    // Carrega o documento PDF
    const pdfDoc = await PDFDocument.load(inputBuffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });

    // Limpa metadados desnecessários mantendo título padrão se existir
    pdfDoc.setProducer('Croqui Web PDF Engine');

    // Salva o PDF ativando a compressão de fluxos de objetos (Object Streams - PDF 1.5+)
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });

    const compressedBuffer = Buffer.from(pdfBytes);
    const newSize = compressedBuffer.length;

    // Retorna o buffer compactado se for menor que o original
    if (newSize < originalSize) {
      console.log(`📦 PDF compactado no backend: ${(originalSize / 1024 / 1024).toFixed(2)}MB ➔ ${(newSize / 1024 / 1024).toFixed(2)}MB (${(((originalSize - newSize) / originalSize) * 100).toFixed(1)}% menor)`);
      return {
        buffer: compressedBuffer,
        compressed: true,
        originalSize,
        newSize
      };
    }

    // Se o tamanho não diminuiu (ex: PDF já super otimizado), mantém o original
    return {
      buffer: inputBuffer,
      compressed: false,
      originalSize,
      newSize: originalSize
    };
  } catch (err) {
    console.warn('⚠️ Não foi possível recompactar o PDF no backend, mantendo arquivo original:', err.message);
    return {
      buffer: inputBuffer,
      compressed: false,
      originalSize,
      newSize: originalSize
    };
  }
}

module.exports = {
  compressPdfBuffer
};
