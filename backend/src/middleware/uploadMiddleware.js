import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// Ensure local upload storage exists before Multer tries to write a file.
fs.mkdirSync(uploadsDir, { recursive: true });

const normalizeUploadSubfolder = (subfolder = '') => {
  if (!subfolder) {
    return '';
  }

  const segments = String(subfolder)
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) {
    return '';
  }

  const hasUnsafeSegment = segments.some(
    (segment) => segment === '.' || segment === '..' || !/^[a-zA-Z0-9-_]+$/.test(segment)
  );

  if (hasUnsafeSegment) {
    throw new Error('Upload subfolder contains unsafe path characters.');
  }

  return path.join(...segments);
};

const resolveUploadDir = (subfolder = '') => {
  const normalizedSubfolder = normalizeUploadSubfolder(subfolder);
  const targetDir = normalizedSubfolder ? path.join(uploadsDir, normalizedSubfolder) : uploadsDir;
  const resolvedUploadsDir = path.resolve(uploadsDir);
  const resolvedTargetDir = path.resolve(targetDir);
  const relativePath = path.relative(resolvedUploadsDir, resolvedTargetDir);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Upload destination must stay inside the uploads directory.');
  }

  fs.mkdirSync(resolvedTargetDir, { recursive: true });
  return resolvedTargetDir;
};

const createUpload = (subfolder = '') => {
  const destinationDir = resolveUploadDir(subfolder);

  const storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, destinationDir);
    },
    filename(req, file, cb) {
      const safeBaseName = path
        .parse(file.originalname)
        .name.replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase();
      const extension = path.extname(file.originalname).toLowerCase();

      cb(null, `${Date.now()}-${safeBaseName}${extension}`);
    },
  });

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  });
};

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.webp'];
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
    return cb(null, true);
  }

  const error = new Error('Only jpeg, jpg, png, and webp image files are allowed.');
  error.statusCode = 400;
  return cb(error);
};

const upload = createUpload();

export { createUpload };
export default upload;
