import fs from 'fs/promises';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import Announcement from '../models/Announcement.js';
import asyncHandler from '../utils/asyncHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const announcementUploadSubfolder = 'announcements';
const announcementUploadUrlPrefix = `/uploads/${announcementUploadSubfolder}`;
const announcementUploadDir = path.resolve(
  __dirname,
  '..',
  '..',
  'uploads',
  announcementUploadSubfolder
);

const allowedTargetAudiences = ['All', 'Patients', 'Doctors', 'Staff'];
const allowedStatuses = ['Active', 'Expired'];

const buildAnnouncementImageUrl = (file) => `${announcementUploadUrlPrefix}/${file.filename}`;

const getPathname = (imageUrl) => {
  try {
    return new URL(imageUrl, 'http://sethmacare.local').pathname;
  } catch {
    return String(imageUrl || '').split('?')[0];
  }
};

const isInsideDirectory = (childPath, parentPath) => {
  const relativePath = path.relative(parentPath, childPath);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const safeDeleteAnnouncementImage = async (imageUrl) => {
  if (!imageUrl) {
    return;
  }

  const pathname = getPathname(imageUrl);
  const expectedPrefix = `${announcementUploadUrlPrefix}/`;

  if (!pathname.startsWith(expectedPrefix)) {
    console.warn(`Skipped announcement image deletion outside expected URL prefix: ${imageUrl}`);
    return;
  }

  let relativeFilename;
  try {
    relativeFilename = decodeURIComponent(pathname.slice(expectedPrefix.length));
  } catch {
    console.warn(`Skipped announcement image deletion for malformed URL: ${imageUrl}`);
    return;
  }

  const filePath = path.resolve(announcementUploadDir, relativeFilename);

  if (!isInsideDirectory(filePath, announcementUploadDir)) {
    console.warn(`Skipped unsafe announcement image deletion path: ${imageUrl}`);
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Announcement image already missing: ${filePath}`);
      return;
    }

    console.warn(`Failed to delete announcement image ${filePath}: ${error.message}`);
  }
};

const getStringValue = (value) => (typeof value === 'string' ? value.trim() : '');

const cleanupUploadedFile = async (file) => {
  if (file) {
    await safeDeleteAnnouncementImage(buildAnnouncementImageUrl(file));
  }
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const getSingleQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const createAnnouncement = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(createValidationError('Announcement image file is required.'));
  }

  const title = getStringValue(req.body.title);
  const description = getStringValue(req.body.description);
  const targetAudience = getStringValue(req.body.targetAudience) || 'All';
  const status = getStringValue(req.body.status) || 'Active';
  const imageUrl = buildAnnouncementImageUrl(req.file);

  if (!title || !description) {
    await cleanupUploadedFile(req.file);
    return next(createValidationError('Announcement title and description are required.'));
  }

  if (!allowedTargetAudiences.includes(targetAudience)) {
    await cleanupUploadedFile(req.file);
    return next(createValidationError('targetAudience must be All, Patients, Doctors, or Staff.'));
  }

  if (!allowedStatuses.includes(status)) {
    await cleanupUploadedFile(req.file);
    return next(createValidationError('status must be Active or Expired.'));
  }

  try {
    const announcement = await Announcement.create({
      title,
      description,
      imageUrl,
      targetAudience,
      status,
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully.',
      announcement,
    });
  } catch (error) {
    await safeDeleteAnnouncementImage(imageUrl);
    throw error;
  }
});

const updateAnnouncement = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    await cleanupUploadedFile(req.file);
    const error = new Error('Invalid announcement id.');
    error.statusCode = 400;
    return next(error);
  }

  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    await cleanupUploadedFile(req.file);
    const error = new Error('Announcement not found.');
    error.statusCode = 404;
    return next(error);
  }

  const updates = {};

  if (req.body.title !== undefined) {
    const title = getStringValue(req.body.title);
    if (!title) {
      await cleanupUploadedFile(req.file);
      return next(createValidationError('Announcement title cannot be empty.'));
    }
    updates.title = title;
  }

  if (req.body.description !== undefined) {
    const description = getStringValue(req.body.description);
    if (!description) {
      await cleanupUploadedFile(req.file);
      return next(createValidationError('Announcement description cannot be empty.'));
    }
    updates.description = description;
  }

  if (req.body.targetAudience !== undefined) {
    const targetAudience = getStringValue(req.body.targetAudience);
    if (!allowedTargetAudiences.includes(targetAudience)) {
      await cleanupUploadedFile(req.file);
      return next(createValidationError('targetAudience must be All, Patients, Doctors, or Staff.'));
    }
    updates.targetAudience = targetAudience;
  }

  if (req.body.status !== undefined) {
    const status = getStringValue(req.body.status);
    if (!allowedStatuses.includes(status)) {
      await cleanupUploadedFile(req.file);
      return next(createValidationError('status must be Active or Expired.'));
    }
    updates.status = status;
  }

  const previousImageUrl = announcement.imageUrl;
  const nextImageUrl = req.file ? buildAnnouncementImageUrl(req.file) : null;

  if (nextImageUrl) {
    updates.imageUrl = nextImageUrl;
  }

  announcement.set(updates);
  await announcement.validate();

  if (nextImageUrl) {
    await safeDeleteAnnouncementImage(previousImageUrl);
  }

  await announcement.save();

  res.status(200).json({
    success: true,
    message: 'Announcement updated successfully.',
    announcement,
  });
});

const deleteAnnouncement = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    const error = new Error('Invalid announcement id.');
    error.statusCode = 400;
    return next(error);
  }

  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    const error = new Error('Announcement not found.');
    error.statusCode = 404;
    return next(error);
  }

  const imageUrl = announcement.imageUrl;
  await announcement.deleteOne();
  await safeDeleteAnnouncementImage(imageUrl);

  res.status(200).json({
    success: true,
    message: 'Announcement deleted successfully.',
  });
});

const getActiveAnnouncements = asyncHandler(async (req, res, next) => {
  const filter = { status: 'Active' };
  const requestedAudience = getSingleQueryValue(req.query.targetAudience);

  if (requestedAudience !== undefined) {
    const targetAudience = getStringValue(requestedAudience);

    if (!allowedTargetAudiences.includes(targetAudience)) {
      return next(createValidationError('targetAudience must be All, Patients, Doctors, or Staff.'));
    }

    filter.targetAudience =
      targetAudience === 'All' ? targetAudience : { $in: ['All', targetAudience] };
  }

  const announcements = await Announcement.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: announcements.length,
    announcements,
  });
});

const getAllAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: announcements.length,
    announcements,
  });
});

export {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getActiveAnnouncements,
  getAllAnnouncements,
};
