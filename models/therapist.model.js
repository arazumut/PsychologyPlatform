const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TherapistProfile = sequelize.define('TherapistProfile', {
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
  specialization: {
    type: DataTypes.STRING,
    allowNull: false
  },
  experience: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  biography: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: {
        args: [10, 1000],
        msg: 'Biography must be between 10 and 1000 characters'
      }
    }
  },
  sessionRate: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  ratingSum: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  ratingCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  averageRating: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  sessionTypes: {
    type: DataTypes.STRING, // Store as JSON string
    defaultValue: JSON.stringify(['individual']),
    get() {
      const value = this.getDataValue('sessionTypes');
      return value ? JSON.parse(value) : ['individual'];
    },
    set(val) {
      this.setDataValue('sessionTypes', JSON.stringify(val));
    }
  },
  languages: {
    type: DataTypes.STRING, // Store as JSON string
    defaultValue: JSON.stringify(['Türkçe']),
    get() {
      const value = this.getDataValue('languages');
      return value ? JSON.parse(value) : ['Türkçe'];
    },
    set(val) {
      this.setDataValue('languages', JSON.stringify(val));
    }
  },
  expertise: {
    type: DataTypes.STRING, // Store as JSON string
    allowNull: false,
    get() {
      const value = this.getDataValue('expertise');
      return value ? JSON.parse(value) : [];
    },
    set(val) {
      this.setDataValue('expertise', JSON.stringify(val));
    }
  }
}, {
  hooks: {
    beforeSave: (therapist) => {
      // Calculate average rating when saving
      if (therapist.ratingCount > 0) {
        therapist.averageRating = Math.round((therapist.ratingSum / therapist.ratingCount) * 10) / 10; // round to 1 decimal
      }
    }
  }
});

// Education model association will be defined separately
// Certification model association will be defined separately
 
module.exports = TherapistProfile;