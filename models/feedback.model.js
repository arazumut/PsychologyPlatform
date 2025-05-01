const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Feedback = sequelize.define('Feedback', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  therapistId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  comment: {
    type: DataTypes.TEXT,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Comment must be less than 500 characters'
      }
    }
  },
  tags: {
    type: DataTypes.STRING, // JSON string
    get() {
      const value = this.getDataValue('tags');
      return value ? JSON.parse(value) : [];
    },
    set(val) {
      this.setDataValue('tags', JSON.stringify(val || []));
    }
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  adminReviewedById: {
    type: DataTypes.INTEGER
  },
  adminReviewDate: {
    type: DataTypes.DATE
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  therapistResponseComment: {
    type: DataTypes.TEXT
  },
  therapistResponseDate: {
    type: DataTypes.DATE
  },
  isFlagged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  flagReason: {
    type: DataTypes.STRING
  },
  flaggedById: {
    type: DataTypes.INTEGER
  },
  flaggedDate: {
    type: DataTypes.DATE
  }
});

// Model tanımlandıktan sonra çağrılacak olan model metodu
Feedback.updateTherapistRating = async function(therapistId) {
  try {
    // Bu terapist için tüm onaylanmış geri bildirimleri bul
    const TherapistProfile = sequelize.models.TherapistProfile;
    if (!TherapistProfile) {
      console.error('TherapistProfile model is not defined');
      return;
    }
    
    const feedbacks = await this.findAll({
      where: {
        therapistId: therapistId,
        isApproved: true
      }
    });
    
    // Yeni puanlamayı hesapla
    const ratingSum = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
    const ratingCount = feedbacks.length;
    const averageRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;
    
    // Terapist profilini güncelle
    await TherapistProfile.update(
      {
        ratingSum,
        ratingCount,
        averageRating
      },
      {
        where: { id: therapistId }
      }
    );
  } catch (err) {
    console.error('Error updating therapist rating:', err);
  }
};

// Hook'lar
Feedback.afterCreate(async (feedback) => {
  if (feedback.isApproved) {
    await Feedback.updateTherapistRating(feedback.therapistId);
  }
});

Feedback.afterUpdate(async (feedback) => {
  if (feedback.isApproved) {
    await Feedback.updateTherapistRating(feedback.therapistId);
  }
});

Feedback.afterBulkUpdate(async (options) => {
  // Toplu güncellemeler için terapist ID bilgisi alınmalı
  // Bu durumda tüm etkilenen terapistlerin puanlaması tekrar hesaplanmalıdır
  // Bu kısmın implementasyonu karmaşık olabilir ve özel gereksinimler gerektirebilir
});

module.exports = Feedback;