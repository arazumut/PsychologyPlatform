const express = require('express');
const router = express.Router();
const {
  createFeedback,
  getTherapistFeedbacks,
  respondToFeedback,
  reviewFeedback,
  getMyFeedbacks,
  getFeedback
} = require('../controllers/feedback/feedback.controller');
const { protect, authorize } = require('../middleware/auth/auth.middleware');

// Geri bildirim oluşturma (danışanlar için)
router.post('/', protect, authorize('client'), createFeedback);

// Danışanın kendi geri bildirimlerini görüntüleme
router.get('/my', protect, authorize('client'), getMyFeedbacks);

// Terapistin bir geri bildirime yanıt vermesi
router.put('/:id/respond', protect, authorize('therapist'), respondToFeedback);

// Admin tarafından geri bildirim incelemesi
router.put('/:id/review', protect, authorize('admin'), reviewFeedback);

// Bir terapistin tüm geri bildirimlerini görüntüleme (public)
router.get('/therapist/:id', getTherapistFeedbacks);

// Belirli bir geri bildirimin detaylarını görüntüleme
router.get('/:id', protect, getFeedback);

module.exports = router;