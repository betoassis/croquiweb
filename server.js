const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const croquisRoutes = require('./routes/croquis');
const statsRoutes = require('./routes/stats');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Serve PDF files from /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper to create sample minimal PDF files for demo entries if missing
function ensureDemoFilesExist() {
  const demoFiles = [
    {
      dir: path.join(__dirname, 'uploads', 'centro', 'regiao-central'),
      file: 'demo-croqui-centro-q01.pdf',
      title: 'Croqui Centro - Quarteirão 01'
    },
    {
      dir: path.join(__dirname, 'uploads', 'sao-jose', 'regiao-norte'),
      file: 'demo-croqui-sao-jose-q14.pdf',
      title: 'Croqui São José - Quarteirão 14'
    },
    {
      dir: path.join(__dirname, 'uploads', 'jardim-america', 'regiao-sul'),
      file: 'demo-croqui-jardim-america-q08.pdf',
      title: 'Croqui Jardim América - Quarteirão 08'
    }
  ];

  const createMinimalPdf = (title) => `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 110>> stream
BT
/F1 18 Tf
50 720 Td
(CROQUI WEB - ACE) Tj
0 -30 Td
/F1 14 Tf
(${title}) Tj
0 -25 Td
(Documento de Referencia de Campo) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000062 00000 n 
0000000117 00000 n 
0000000232 00000 n 
0000000299 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
459
%%EOF`;

  demoFiles.forEach(item => {
    try {
      if (!fs.existsSync(item.dir)) {
        fs.mkdirSync(item.dir, { recursive: true });
      }
      const filePath = path.join(item.dir, item.file);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, createMinimalPdf(item.title));
        console.log(`[SEED] Arquivo de demonstração criado: ${filePath}`);
      }
    } catch (err) {
      console.warn('⚠️ Aviso ao verificar arquivos locais no ambiente serverless Vercel:', err.message);
    }
  });
}

ensureDemoFilesExist();

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/croquis', croquisRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', usersRoutes);

// Fallback SPA route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server if launched directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 SERVIDOR CROQUI WEB EXECUTANDO NA PORTA ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔐 ADMIN LOGIN: admin / assis6259`);
    console.log(`====================================================`);
  });
}

module.exports = app;
