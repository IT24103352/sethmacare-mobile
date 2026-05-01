import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  getAllUsers,
  getPendingUsers,
  confirmUser,
  deleteUser,
} from '../controllers/authController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);

router.get('/users', protect, authorizeRoles('Admin'), getAllUsers);
router.get('/users/pending', protect, authorizeRoles('Admin'), getPendingUsers);
router.get('/pending', protect, authorizeRoles('Admin'), getPendingUsers);
router.patch('/users/:id/confirm', protect, authorizeRoles('Admin'), confirmUser);
router.patch('/:id/confirm', protect, authorizeRoles('Admin'), confirmUser);
router.delete('/users/:id', protect, authorizeRoles('Admin'), deleteUser);
router.delete('/:id', protect, authorizeRoles('Admin'), deleteUser);

export default router;
