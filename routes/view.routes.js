const express = require('express');
const router = express.Router();
const { TherapistProfile, User } = require('../models');

// Ana Sayfa
router.get('/', (req, res) => {
  res.render('index', { title: 'Psikolojik Destek Platformu' });
});

// Terapistler Sayfası
router.get('/terapistler', async (req, res) => {
  try {
    // Aktif terapistleri getir
    const therapists = await TherapistProfile.findAll({
      include: [
        {
          model: User,
          as: 'User',
          
          attributes: ['firstName', 'lastName', 'avatar', 'isActive'],
          where: { isActive: true }
        }
      ],
      order: [
        ['rating', 'DESC']
      ]
    });

    res.render('terapistler', { 
      title: 'Terapistlerimiz | Psikolojik Destek Platformu',
      therapists
    });
  } catch (error) {
    console.error('Terapistler listesi getirme hatası:', error);
    res.status(500).render('error', {
      title: 'Hata',
      message: 'Terapistler listesi getirilirken bir hata oluştu.'
    });
  }
});

// Hizmetler Sayfası
router.get('/hizmetler', (req, res) => {
  res.render('hizmetler', { title: 'Hizmetlerimiz | Psikolojik Destek Platformu' });
});

// Hakkımızda Sayfası
router.get('/hakkimizda', (req, res) => {
  res.render('hakkimizda', { title: 'Hakkımızda | Psikolojik Destek Platformu' });
});

// Giriş Sayfası
router.get('/auth/login', (req, res) => {
  const registered = req.query.registered === 'true';
  res.render('auth/login', { 
    title: 'Giriş Yap | Psikolojik Destek Platformu',
    success: registered ? 'Kayıt işleminiz başarıyla tamamlandı. Lütfen giriş yapın.' : null
  });
});

// Kayıt Sayfası
router.get('/auth/register', (req, res) => {
  res.render('auth/register', { 
    title: 'Kayıt Ol | Psikolojik Destek Platformu' 
  });
});

// Şifremi Unuttum Sayfası
router.get('/auth/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { 
    title: 'Şifremi Unuttum | Psikolojik Destek Platformu' 
  });
});

// Şifre Sıfırlama Sayfası
router.get('/auth/reset-password/:token', (req, res) => {
  res.render('auth/reset-password', { 
    title: 'Şifre Sıfırla | Psikolojik Destek Platformu',
    token: req.params.token 
  });
});

// Gizlilik Politikası
router.get('/gizlilik-politikasi', (req, res) => {
  res.render('legal/gizlilik-politikasi', { 
    title: 'Gizlilik Politikası | Psikolojik Destek Platformu' 
  });
});

// Kullanım Koşulları
router.get('/kullanim-kosullari', (req, res) => {
  res.render('legal/kullanim-kosullari', { 
    title: 'Kullanım Koşulları | Psikolojik Destek Platformu' 
  });
});

module.exports = router;