const { User, ClientProfile, TherapistProfile } = require('../../models');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// Yardımcı fonksiyonlar
const sendTokenResponse = (user, statusCode, res) => {
  // Token oluştur
  const token = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();

  // Cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }

  // Son giriş zamanını güncelle
  user.lastLogin = Date.now();
  user.save();

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive
      }
    });
};

// @desc    Kayıt ol
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // E-posta adresi alınmış mı kontrol et
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var'
      });
    }

    // Rol kontrolü
    if (!['client', 'therapist'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz rol seçimi'
      });
    }

    // Kullanıcıyı oluştur
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role
    });

    // Doğrulama token'ı oluştur
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Rol bazlı profil oluştur
    if (role === 'client') {
      await ClientProfile.create({
        userId: user.id
      });
    } else if (role === 'therapist') {
      await TherapistProfile.create({
        userId: user.id,
        specialization: req.body.specialization || '',
        experience: req.body.experience || 0,
        licenseNumber: req.body.licenseNumber || '',
        sessionRate: req.body.sessionRate || 0,
        biography: req.body.biography || '',
        expertise: req.body.expertise || []
      });
    }

    // TODO: Doğrulama e-postası gönder

    res.status(201).json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu. Lütfen e-posta adresinizi doğrulayın.',
      userId: user.id,
      role: user.role
    });
  } catch (err) {
    console.error('Kayıt hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı kaydı sırasında bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Giriş yap
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Gerekli alanları kontrol et
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen e-posta ve şifrenizi girin'
      });
    }

    // Kullanıcıyı kontrol et
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz e-posta veya şifre'
      });
    }

    // Şifreyi kontrol et
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz e-posta veya şifre'
      });
    }

    // E-posta doğrulaması kontrolü
    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Lütfen önce e-posta adresinizi doğrulayın'
      });
    }

    // Hesap aktif mi kontrolü
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Hesabınız aktif değil. Yöneticinin onayını beklemeniz veya destek ile iletişime geçmeniz gerekiyor.'
      });
    }

    // Token ile cevap döndür
    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error('Giriş hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Giriş sırasında bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Kullanıcı bilgilerini al
// @route   GET /api/auth/me
// @access  Private
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: ClientProfile,
          as: 'clientProfile',
          required: false
        },
        {
          model: TherapistProfile,
          as: 'therapistProfile',
          required: false
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Kullanıcı bilgileri alınırken hata:', err);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı bilgileri alınırken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Çıkış yap
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Başarıyla çıkış yapıldı'
  });
};

// @desc    E-posta adresini doğrula
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    // Token'ı hash'le
    const emailVerificationToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // Token ile kullanıcıyı bul
    const user = await User.findOne({
      where: {
        emailVerificationToken,
        emailVerificationExpire: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veya süresi dolmuş token'
      });
    }

    // Kullanıcıyı güncelle
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpire = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'E-posta başarıyla doğrulandı. Şimdi giriş yapabilirsiniz.'
    });
  } catch (err) {
    console.error('E-posta doğrulama hatası:', err);
    res.status(500).json({
      success: false,
      message: 'E-posta doğrulama sırasında bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Şifre sıfırlama e-postası gönder
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { email: req.body.email }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı'
      });
    }

    // Reset token oluştur
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    // TODO: Şifre sıfırlama e-postası gönder

    res.status(200).json({
      success: true,
      message: 'Şifre sıfırlama e-postası gönderildi',
      resetUrl // Geliştirme amaçlı, production'da kaldırılmalı
    });
  } catch (err) {
    console.error('Şifre sıfırlama hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Şifre sıfırlama e-postası gönderilemedi',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Şifre sıfırla
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    // Token'ı hash'le
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      where: {
        resetPasswordToken,
        resetPasswordExpire: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veya süresi dolmuş token'
      });
    }

    // Yeni şifreyi ayarla
    user.password = req.body.password;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Şifre başarıyla sıfırlandı. Şimdi giriş yapabilirsiniz.'
    });
  } catch (err) {
    console.error('Şifre sıfırlama hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Şifre sıfırlama sırasında bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Private
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token gerekli'
      });
    }

    // Refresh token doğrula
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Kullanıcıyı bul
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Yeni token oluştur ve gönder
    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error('Token yenileme hatası:', err);
    res.status(401).json({
      success: false,
      message: 'Geçersiz refresh token',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};