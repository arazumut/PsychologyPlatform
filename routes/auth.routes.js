const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getCurrentUser, 
  logout, 
  verifyEmail, 
  forgotPassword,
  resetPassword,
  refreshToken
} = require('../controllers/auth/auth.controller');
const { protect } = require('../middleware/auth/auth.middleware');

// Kullanıcı kaydı ve girişi
router.post('/register', register);
router.post('/login', login);
router.get('/logout', protect, logout);

// Kullanıcı bilgileri
router.get('/me', protect, getCurrentUser);

// E-posta doğrulama
router.get('/verify-email/:token', verifyEmail);

// Şifre işlemleri
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Token yenileme
router.post('/refresh-token', refreshToken);

module.exports = router;