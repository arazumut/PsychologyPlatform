const express = require('express');
const router = express.Router();
const {
  addAvailability,
  updateAvailability,
  deleteAvailability,
  getTherapistAvailabilities,
  getTherapistAvailabilitiesById
} = require('../controllers/therapist/availability.controller');
const { protect, authorize } = require('../middleware/auth/auth.middleware');

// Terapist müsaitlik yönetimi (sadece terapistler)
router.route('/availability')
  .post(protect, authorize('therapist'), addAvailability)
  .get(protect, authorize('therapist'), getTherapistAvailabilities);

router.route('/availability/:id')
  .put(protect, authorize('therapist'), updateAvailability)
  .delete(protect, authorize('therapist'), deleteAvailability);

// Belirli bir terapistin müsaitlik bilgilerini halka açık olarak getir (danışanlar için)
router.get('/:id/availability', getTherapistAvailabilitiesById);

module.exports = router;