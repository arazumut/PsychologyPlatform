const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Availability = sequelize.define('Availability', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  therapistId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  dayOfWeek: {
    type: DataTypes.INTEGER, // 0: Sunday, 1: Monday, ..., 6: Saturday
    allowNull: false,
    validate: {
      min: 0,
      max: 6
    }
  },
  startTime: {
    type: DataTypes.STRING, // Format: "HH:MM" in 24-hour time
    allowNull: false,
    validate: {
      is: /^([01]\d|2[0-3]):([0-5]\d)$/,
      msg: 'Time must be in HH:MM format (24-hour)'
    }
  },
  endTime: {
    type: DataTypes.STRING, // Format: "HH:MM" in 24-hour time
    allowNull: false,
    validate: {
      is: /^([01]\d|2[0-3]):([0-5]\d)$/,
      msg: 'Time must be in HH:MM format (24-hour)'
    }
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  recurrence: {
    type: DataTypes.ENUM('weekly', 'biweekly', 'monthly', 'once'),
    defaultValue: 'weekly'
  },
  startDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endDate: {
    type: DataTypes.DATE
  },
  sessionDuration: {
    type: DataTypes.INTEGER, // Duration in minutes
    defaultValue: 50
  },
  bufferBetweenSessions: {
    type: DataTypes.INTEGER, // Buffer time in minutes
    defaultValue: 10
  }
}, {
  hooks: {
    beforeValidate: (availability) => {
      // Bitiş süresinin başlangıç süresinden sonra olduğunu kontrol et
      if (availability.startTime && availability.endTime) {
        const [startHour, startMinute] = availability.startTime.split(':').map(Number);
        const [endHour, endMinute] = availability.endTime.split(':').map(Number);
        
        const startTimeValue = startHour * 60 + startMinute;
        const endTimeValue = endHour * 60 + endMinute;
        
        if (endTimeValue <= startTimeValue) {
          throw new Error('End time must be after start time');
        }
      }
    }
  },
  indexes: [
    {
      fields: ['therapistId', 'dayOfWeek']
    }
  ]
});

module.exports = Availability;