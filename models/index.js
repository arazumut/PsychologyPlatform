const { sequelize } = require('../config/database');
const User = require('./user.model');
const ClientProfile = require('./client.model');
const TherapistProfile = require('./therapist.model');
const Session = require('./session.model');
const Availability = require('./availability.model');
const Feedback = require('./feedback.model');

// User - Profil İlişkileri
User.hasOne(ClientProfile, {
  foreignKey: 'userId',
  as: 'clientProfile'
});
ClientProfile.belongsTo(User, {
  foreignKey: 'userId'
});

User.hasOne(TherapistProfile, {
  foreignKey: 'userId',
  as: 'therapistProfile'
});
TherapistProfile.belongsTo(User, {
  foreignKey: 'userId'
});

// Terapist - Müsaitlik İlişkisi
TherapistProfile.hasMany(Availability, {
  foreignKey: 'therapistId',
  as: 'availabilities'
});
Availability.belongsTo(TherapistProfile, {
  foreignKey: 'therapistId'
});

// Oturum (Session) İlişkileri
TherapistProfile.hasMany(Session, {
  foreignKey: 'therapistId',
  as: 'sessions'
});
Session.belongsTo(TherapistProfile, {
  foreignKey: 'therapistId'
});

ClientProfile.hasMany(Session, {
  foreignKey: 'clientId',
  as: 'sessions'
});
Session.belongsTo(ClientProfile, {
  foreignKey: 'clientId'
});

// Geri Bildirim (Feedback) İlişkileri
Session.hasOne(Feedback, {
  foreignKey: 'sessionId',
  as: 'feedback'
});
Feedback.belongsTo(Session, {
  foreignKey: 'sessionId'
});

ClientProfile.hasMany(Feedback, {
  foreignKey: 'clientId',
  as: 'feedbacks'
});
Feedback.belongsTo(ClientProfile, {
  foreignKey: 'clientId'
});

TherapistProfile.hasMany(Feedback, {
  foreignKey: 'therapistId',
  as: 'feedbacks'
});
Feedback.belongsTo(TherapistProfile, {
  foreignKey: 'therapistId'
});

// Admin İnceleme İlişkisi
User.hasMany(Feedback, {
  foreignKey: 'adminReviewedById',
  as: 'reviewedFeedbacks'
});
Feedback.belongsTo(User, {
  foreignKey: 'adminReviewedById',
  as: 'reviewedBy'
});

// Bayrak (Flag) İlişkisi
User.hasMany(Feedback, {
  foreignKey: 'flaggedById',
  as: 'flaggedFeedbacks'
});
Feedback.belongsTo(User, {
  foreignKey: 'flaggedById',
  as: 'flaggedBy'
});

// İlave modeller ve ilişkiler eklenebilir (örneğin: Education, Certification, vb.)

// Tüm modelleri dışa aktar
module.exports = {
  sequelize,
  User,
  ClientProfile,
  TherapistProfile,
  Session,
  Availability,
  Feedback
};