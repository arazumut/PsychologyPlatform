const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'İsim alanı boş olamaz'
      },
      len: {
        args: [2, 50],
        msg: 'İsim en az 2, en fazla 50 karakter olabilir'
      }
    }
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Soyad alanı boş olamaz'
      },
      len: {
        args: [2, 50],
        msg: 'Soyad en az 2, en fazla 50 karakter olabilir'
      }
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: {
        msg: 'Geçerli bir e-posta adresi giriniz'
      }
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: {
        args: [6, 100],
        msg: 'Şifre en az 6 karakter olmalıdır'
      }
    }
  },
  role: {
    type: DataTypes.ENUM('client', 'therapist', 'admin'),
    defaultValue: 'client'
  },
  avatar: {
    type: DataTypes.STRING,
    defaultValue: 'default-avatar.png'
  },
  phoneNumber: {
    type: DataTypes.STRING,
    validate: {
      is: {
        args: /^[0-9+\-\s()]{10,15}$/,
        msg: 'Geçerli bir telefon numarası giriniz'
      }
    }
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING
  },
  emailVerificationExpire: {
    type: DataTypes.DATE
  },
  resetPasswordToken: {
    type: DataTypes.STRING
  },
  resetPasswordExpire: {
    type: DataTypes.DATE
  },
  lastLogin: {
    type: DataTypes.DATE
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  refreshTokens: {
    type: DataTypes.TEXT,
    get() {
      const value = this.getDataValue('refreshTokens');
      return value ? JSON.parse(value) : [];
    },
    set(val) {
      this.setDataValue('refreshTokens', JSON.stringify(val || []));
    }
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Yöntemler
User.prototype.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

User.prototype.generateAuthToken = function() {
  return jwt.sign(
    { id: this.id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '1d' }
  );
};

User.prototype.generateRefreshToken = function() {
  const refreshToken = jwt.sign(
    { id: this.id },
    process.env.JWT_REFRESH_SECRET || 'refreshsecret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
  
  // Refresh token'ları sakla
  const refreshTokens = this.refreshTokens || [];
  refreshTokens.push(refreshToken);
  
  // En fazla 5 refresh token sakla
  if (refreshTokens.length > 5) {
    refreshTokens.shift();
  }
  
  this.refreshTokens = refreshTokens;
  this.save();
  
  return refreshToken;
};

User.prototype.generateEmailVerificationToken = function() {
  // Random token oluştur
  const verificationToken = crypto.randomBytes(20).toString('hex');
  
  // Token'ı hashle ve saklama
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  // Token'ın geçerlilik süresini belirle (24 saat)
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  
  return verificationToken;
};

User.prototype.generatePasswordResetToken = function() {
  // Random token oluştur
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Token'ı hashle ve saklama
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Token'ın geçerlilik süresini belirle (10 dakika)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

module.exports = User;