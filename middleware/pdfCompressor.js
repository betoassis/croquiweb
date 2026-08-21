const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFStream } = require('pdf-lib');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠️ Biblioteca sharp não disponível para reprocessamento de imagem PDF:', e.message);
}

/**
 * Compacta um buffer de arquivo PDF otimizando fluxos de objetos e recompactando imagens escaneadas.
 * @param {Buffer} inputBuffer - Buffer original do arquivo PDF.
 * @returns {Promise<{ buffer: Buffer, compressed: boolean, originalSize: number, newSize: number }>}
 */
async function compressPdfBuffer(inputBuffer) {
  if (!inputBuffer || !Buffer.isBuffer(inputBuffer)) {
    return { buffer: inputBuffer, compressed: false, originalSize: 0, newSize: 0 };
  }

  const originalSize = inputBuffer.length;

  try {
    const pdfDoc = await PDFDocument.load(inputBuffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });

    // Se a biblioteca sharp estiver disponível, reprocessamos imagens escaneadas de alta resolução
    if (sharp) {
      const indirectObjects = pdfDoc.context.enumerateIndirectObjects();

      for (const [ref, obj] of indirectObjects) {
        if (obj instanceof PDFRawStream || obj instanceof PDFStream || (obj && obj.dict && obj.getContents)) {
          const dict = obj.dict;
          if (!dict) continue;

          const subtype = dict.get(PDFName.of('Subtype'));
          if (subtype === PDFName.of('Image')) {
            try {
              const imageBytes = obj.getContents();
              if (!imageBytes || imageBytes.length < 5000) continue; // Pula ícones/imagens minúsculas

              const img = sharp(imageBytes);
              const meta = await img.metadata();

              if (!meta || !meta.width || !meta.height) continue;

              const maxDim = 1600; // Limite de 1600px garante leitura perfeita de texto e grade de croquis
              let pipeline = img;
              let targetW = meta.width;
              let targetH = meta.height;

              if (Math.max(meta.width, meta.height) > maxDim) {
                const scale = maxDim / Math.max(meta.width, meta.height);
                targetW = Math.round(meta.width * scale);
                targetH = Math.round(meta.height * scale);

                pipeline = pipeline.resize({
                  width: targetW,
                  height: targetH,
                  fit: 'inside',
                  withoutEnlargement: true
                });
              }

              // Converte para JPEG otimizado com qualidade 72%
              const compressedJpeg = await pipeline
                .jpeg({ quality: 72, progressive: true, force: true })
                .toBuffer();

              if (compressedJpeg.length < imageBytes.length) {
                // Atualiza o stream de imagem diretamente no objeto PDF sem criar lixo no documento
                obj.contents = compressedJpeg;
                dict.set(PDFName.of('Length'), PDFNumber.of(compressedJpeg.length));
                dict.set(PDFName.of('Width'), PDFNumber.of(targetW));
                dict.set(PDFName.of('Height'), PDFNumber.of(targetH));
                dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                // Remove filtro ColorSpace / DecodeParams se alterado para JPG padrão
                dict.delete(PDFName.of('DecodeParms'));
              }
            } catch (imgErr) {
              // Se falhar o reprocessamento de uma imagem individual, mantém a imagem original intacta
            }
          }
        }
      }
    }

    pdfDoc.setProducer('Croqui Web PDF Engine');

    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });

    const compressedBuffer = Buffer.from(pdfBytes);
    const newSize = compressedBuffer.length;

    if (newSize < originalSize) {
      console.log(`📦 PDF compactado no backend: ${(originalSize / 1024 / 1024).toFixed(2)}MB ➔ ${(newSize / 1024 / 1024).toFixed(2)}MB (${(((originalSize - newSize) / originalSize) * 100).toFixed(1)}% menor)`);
      return {
        buffer: compressedBuffer,
        compressed: true,
        originalSize,
        newSize
      };
    }

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
