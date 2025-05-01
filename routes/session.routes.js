const express = require('express');
const router = express.Router();
const {
  createSession,
  confirmSession,
  cancelSession,
  completeSession,
  getSessions,
  getSession
} = require('../controllers/session/session.controller');
const { protect, authorize } = require('../middleware/auth/auth.middleware');

// Seans oluşturma ve listeleme
router.route('/')
  .post(protect, authorize('client'), createSession)
  .get(protect, getSessions);

// Tek bir seansın detaylarını görüntüleme
router.get('/:id', protect, getSession);

// Seans onaylama (sadece terapistler)
router.put('/:id/confirm', protect, authorize('therapist'), confirmSession);

// Seans iptali (terapist ve danışanlar)
router.put('/:id/cancel', protect, authorize('therapist', 'client'), cancelSession);

// Seans tamamlama (sadece terapistler)
router.put('/:id/complete', protect, authorize('therapist'), completeSession);

module.exports = router;