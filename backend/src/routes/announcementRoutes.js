import express from 'express';
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getActiveAnnouncements,
  getAllAnnouncements,
} from '../controllers/announcementController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { createUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();
const announcementUpload = createUpload('announcements');

router.use(protect);

router.get('/admin', authorizeRoles('Admin'), getAllAnnouncements);
router.get('/', getActiveAnnouncements);
router.post('/', authorizeRoles('Admin'), announcementUpload.single('image'), createAnnouncement);
router.patch('/:id', authorizeRoles('Admin'), announcementUpload.single('image'), updateAnnouncement);
router.delete('/:id', authorizeRoles('Admin'), deleteAnnouncement);

export default router;
