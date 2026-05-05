import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createUpload = (folder = 'general') => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `sethmacare/${folder}`, // Images stored in sethmacare/announcements, etc.
      resource_type: 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  });

  return multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const error = new Error('Only jpeg, jpg, png, and webp image files are allowed.');
        error.statusCode = 400;
        cb(error);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });
};

export { createUpload };
export default createUpload('general');