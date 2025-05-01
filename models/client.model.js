const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClientProfile = sequelize.define('ClientProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  nickname: {
    type: DataTypes.STRING
  },
  useAnonymousName: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  dateOfBirth: {
    type: DataTypes.DATE
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other', 'prefer-not-to-say'),
    defaultValue: 'prefer-not-to-say'
  },
  contactNumber: {
    type: DataTypes.STRING
  },
  emergencyContactName: {
    type: DataTypes.STRING
  },
  emergencyContactRelationship: {
    type: DataTypes.STRING
  },
  emergencyContactPhone: {
    type: DataTypes.STRING
  },
  previousTherapyHad: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  previousTherapyDuration: {
    type: DataTypes.STRING
  },
  previousTherapyReason: {
    type: DataTypes.TEXT
  },
  preferredTherapistGender: {
    type: DataTypes.ENUM('male', 'female', 'no-preference'),
    defaultValue: 'no-preference'
  },
  preferredSessionTypes: {
    type: DataTypes.STRING, // JSON string
    defaultValue: JSON.stringify(['individual']),
    get() {
      const value = this.getDataValue('preferredSessionTypes');
      return value ? JSON.parse(value) : ['individual'];
    },
    set(val) {
      this.setDataValue('preferredSessionTypes', JSON.stringify(val));
    }
  },
  preferredCommunicationType: {
    type: DataTypes.ENUM('video', 'audio', 'chat'),
    defaultValue: 'video'
  },
  allowProfileSharing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  dataUsageConsent: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  emailNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  smsNotifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notes: {
    type: DataTypes.TEXT,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Notes must be less than 1000 characters'
      }
    }
  }
});

module.exports = ClientProfile;