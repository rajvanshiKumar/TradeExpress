import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export { uploadDir };

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${cleanName}_${uniqueSuffix}${ext}`);
  },
});

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
export const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv']);
export const ALLOWED_DOC_EXTENSIONS = new Set(['.pdf', '.csv', '.xlsx', '.xls', '.doc', '.docx']);

export const ALLOWED_ALL_EXTENSIONS = new Set([
  ...ALLOWED_IMAGE_EXTENSIONS,
  ...ALLOWED_VIDEO_EXTENSIONS,
  ...ALLOWED_DOC_EXTENSIONS,
]);

export const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.js', '.mjs', '.php', '.py', '.pl', '.vbs', '.scr', '.msi', '.bin'
]);

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_DOC_SIZE = 15 * 1024 * 1024;   // 15 MB

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return cb(new Error(`Security Alert: Uploading executable or script files (${ext}) is strictly prohibited.`));
  }

  if (!ALLOWED_ALL_EXTENSIONS.has(ext)) {
    return cb(
      new Error(
        `File type "${ext}" is not supported. Allowed formats: Images (PNG, JPG, JPEG, WEBP, GIF), Videos (MP4, WEBM, MOV), or Documents (PDF, Excel, Word).`
      )
    );
  }

  // Validate MIME category against extension
  if (ALLOWED_IMAGE_EXTENSIONS.has(ext) && !file.mimetype.startsWith('image/')) {
    return cb(new Error(`Invalid image MIME type: ${file.mimetype}`));
  }
  if (ALLOWED_VIDEO_EXTENSIONS.has(ext) && !file.mimetype.startsWith('video/') && file.mimetype !== 'application/octet-stream') {
    return cb(new Error(`Invalid video MIME type: ${file.mimetype}`));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // 50 MB max ceiling
  },
});

export const uploadMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_DOC_SIZE,
  },
});
