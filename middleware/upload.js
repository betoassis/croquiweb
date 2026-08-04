const multer = require('multer');
const path = require('path');
const fs = require('fs');

function slugify(text) {
  if (!text) return 'geral';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const bairro = req.body.bairro ? slugify(req.body.bairro) : 'geral';
    const regiao = req.body.regiao ? slugify(req.body.regiao) : 'geral';

    const uploadDir = path.join(__dirname, '..', 'uploads', bairro, regiao);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    const sanitizedOriginalName = slugify(path.parse(file.originalname).name);
    cb(null, `${uniquePrefix}-${sanitizedOriginalName}.pdf`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos no formato PDF são permitidos.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max file size
  }
});

module.exports = {
  upload,
  slugify
};
