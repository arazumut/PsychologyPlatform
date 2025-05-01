const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  therapistId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  sessionType: {
    type: DataTypes.ENUM('individual', 'group', 'couples', 'children', 'adolescents', 'family'),
    defaultValue: 'individual'
  },
  communicationType: {
    type: DataTypes.ENUM('video', 'audio', 'chat'),
    defaultValue: 'video'
  },
  status: {
    type: DataTypes.ENUM('requested', 'confirmed', 'cancelled', 'completed', 'no-show'),
    defaultValue: 'requested'
  },
  cancelledBy: {
    type: DataTypes.ENUM('client', 'therapist', 'system', 'none'),
    defaultValue: 'none'
  },
  cancellationReason: {
    type: DataTypes.TEXT
  },
  sessionFee: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded', 'failed'),
    defaultValue: 'pending'
  },
  therapistNotes: {
    type: DataTypes.TEXT
  },
  sessionSummary: {
    type: DataTypes.TEXT
  },
  recordingAllowed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  meetingId: {
    type: DataTypes.STRING
  },
  meetingPassword: {
    type: DataTypes.STRING
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  duration: {
    type: DataTypes.VIRTUAL,
    get() {
      if (this.startTime && this.endTime) {
        return Math.round((new Date(this.endTime) - new Date(this.startTime)) / (1000 * 60)); // duration in minutes
      }
      return null;
    }
  }
}, {
  hooks: {
    // Seans zamanları çakışma kontrolü
    beforeCreate: async (session) => {
      await checkForOverlap(session);
    },
    beforeUpdate: async (session) => {
      if (session.changed('startTime') || session.changed('endTime') || session.changed('status')) {
        await checkForOverlap(session);
      }
    }
  }
});

// Seans zamanları çakışma kontrolü yardımcı fonksiyonu
async function checkForOverlap(session) {
  if (session.status === 'confirmed' || session.status === 'requested') {
    const overlappingSessions = await Session.findAll({
      where: {
        id: { [Op.ne]: session.id || 0 },
        therapistId: session.therapistId,
        status: { [Op.in]: ['confirmed', 'requested'] },
        startTime: { [Op.lt]: session.endTime },
        endTime: { [Op.gt]: session.startTime }
      }
    });
    
    if (overlappingSessions.length > 0) {
      throw new Error('Seans zamanı mevcut bir seans ile çakışıyor');
    }
  }
}

module.exports = Session;