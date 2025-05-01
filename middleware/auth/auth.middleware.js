const jwt = require('jsonwebtoken');
const { User } = require('../../models');

// Kullanıcı girişini koruma middleware'i
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Token'ı header'dan veya cookie'den al
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Bearer token'dan al
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Cookie'den al
      token = req.cookies.token;
    }

    // Token yoksa hata döndür
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Bu kaynağa erişmek için giriş yapmalısınız'
      });
    }

    try {
      // Token'ı doğrula
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Kullanıcı bilgisini al
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Bu token ile ilişkili kullanıcı bulunamadı'
        });
      }

      // Kullanıcı aktif değilse erişimi engelle
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Hesabınız aktif değil. Lütfen yönetici ile iletişime geçin.'
        });
      }

      // Kullanıcı bilgisini request nesnesine ekle
      req.user = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive
      };

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz token'
      });
    }
  } catch (err) {
    console.error('Kimlik doğrulama hatası:', err);
    return res.status(500).json({
      success: false,
      message: 'Kimlik doğrulama sırasında bir hata oluştu'
    });
  }
};

// Rol bazlı yetkilendirme middleware'i
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(500).json({
        success: false,
        message: 'Kullanıcı bilgisi eksik, önce kimlik doğrulama gerekli'
      });
    }

    // Kullanıcının rolü izin verilen roller arasında yoksa erişimi engelle
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `${req.user.role} rolüne sahip kullanıcıların bu kaynağa erişim izni yok`
      });
    }

    next();
  };
};