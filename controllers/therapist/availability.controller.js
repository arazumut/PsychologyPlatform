const { Availability, TherapistProfile, User, Session } = require('../../models');
const { sequelize } = require('../../config/database');
const { Op } = require('sequelize');

// @desc    Terapist müsaitlik bilgisi ekle
// @route   POST /api/therapist/availability
// @access  Private (Therapist)
exports.addAvailability = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { dayOfWeek, startTime, endTime, recurrence, startDate, endDate, sessionDuration, bufferBetweenSessions } = req.body;
    
    // Gerekli alanların kontrolü
    if (dayOfWeek === undefined || !startTime || !endTime) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Gün, başlangıç ve bitiş saatleri gereklidir'
      });
    }
    
    // Haftanın günü kontrolü
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Geçersiz gün değeri. 0 (Pazar) ile 6 (Cumartesi) arasında bir değer girilmelidir'
      });
    }
    
    // Saat formatı kontrolü
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Saatler HH:MM formatında olmalıdır (24 saat)'
      });
    }
    
    // Bitiş saatinin başlangıç saatinden sonra olma kontrolü
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startTimeValue = startHour * 60 + startMinute;
    const endTimeValue = endHour * 60 + endMinute;
    
    if (endTimeValue <= startTimeValue) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bitiş saati, başlangıç saatinden sonra olmalıdır'
      });
    }
    
    // Terapist profili kontrolü
    const therapistProfile = await TherapistProfile.findOne({
      where: { userId: req.user.id },
      transaction
    });
    
    if (!therapistProfile) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Terapist profili bulunamadı'
      });
    }
    
    // Çakışan müsaitlik kontrolü
    const overlappingAvailability = await Availability.findOne({
      where: {
        therapistId: therapistProfile.id,
        dayOfWeek,
        [Op.or]: [
          {
            startTime: { [Op.lt]: endTime },
            endTime: { [Op.gt]: startTime }
          }
        ]
      },
      transaction
    });
    
    if (overlappingAvailability) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bu zaman diliminde zaten müsaitlik kaydınız bulunmaktadır'
      });
    }
    
    // Yeni müsaitlik oluştur
    const availability = await Availability.create({
      therapistId: therapistProfile.id,
      dayOfWeek,
      startTime,
      endTime,
      recurrence: recurrence || 'weekly',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      sessionDuration: sessionDuration || 50,
      bufferBetweenSessions: bufferBetweenSessions || 10
    }, { transaction });
    
    await transaction.commit();
    
    res.status(201).json({
      success: true,
      message: 'Müsaitlik bilgisi başarıyla eklendi',
      data: availability
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Müsaitlik ekleme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Müsaitlik bilgisi eklenirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Terapist müsaitlik bilgisini güncelle
// @route   PUT /api/therapist/availability/:id
// @access  Private (Therapist)
exports.updateAvailability = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, isAvailable, recurrence, startDate, endDate, sessionDuration, bufferBetweenSessions } = req.body;
    
    // Müsaitlik bilgisini bul
    const availability = await Availability.findByPk(id, { transaction });
    
    if (!availability) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Müsaitlik bilgisi bulunamadı'
      });
    }
    
    // Terapist profili kontrolü
    const therapistProfile = await TherapistProfile.findOne({
      where: { userId: req.user.id },
      transaction
    });
    
    if (!therapistProfile || therapistProfile.id !== availability.therapistId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Bu müsaitlik bilgisini güncelleme yetkiniz yok'
      });
    }
    
    // Saat değişikliği varsa format kontrolü
    if (startTime || endTime) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      
      if (startTime && !timeRegex.test(startTime)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Başlangıç saati HH:MM formatında olmalıdır (24 saat)'
        });
      }
      
      if (endTime && !timeRegex.test(endTime)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Bitiş saati HH:MM formatında olmalıdır (24 saat)'
        });
      }
    }
    
    // Saat değişikliği varsa bitiş saati kontrolü
    if (startTime || endTime) {
      const newStartTime = startTime || availability.startTime;
      const newEndTime = endTime || availability.endTime;
      
      const [startHour, startMinute] = newStartTime.split(':').map(Number);
      const [endHour, endMinute] = newEndTime.split(':').map(Number);
      
      const startTimeValue = startHour * 60 + startMinute;
      const endTimeValue = endHour * 60 + endMinute;
      
      if (endTimeValue <= startTimeValue) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Bitiş saati, başlangıç saatinden sonra olmalıdır'
        });
      }
    }
    
    // Gün değişikliği varsa kontrolü
    if (dayOfWeek !== undefined && (dayOfWeek < 0 || dayOfWeek > 6)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Geçersiz gün değeri. 0 (Pazar) ile 6 (Cumartesi) arasında bir değer girilmelidir'
      });
    }
    
    // Gün veya saat değişikliği varsa çakışma kontrolü
    if (dayOfWeek !== undefined || startTime || endTime) {
      const newDayOfWeek = dayOfWeek !== undefined ? dayOfWeek : availability.dayOfWeek;
      const newStartTime = startTime || availability.startTime;
      const newEndTime = endTime || availability.endTime;
      
      const overlappingAvailability = await Availability.findOne({
        where: {
          id: { [Op.ne]: id },
          therapistId: therapistProfile.id,
          dayOfWeek: newDayOfWeek,
          [Op.or]: [
            {
              startTime: { [Op.lt]: newEndTime },
              endTime: { [Op.gt]: newStartTime }
            }
          ]
        },
        transaction
      });
      
      if (overlappingAvailability) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Bu zaman diliminde zaten başka bir müsaitlik kaydınız bulunmaktadır'
        });
      }
    }

    // Etkilenen seanslar var mı kontrolü
    if ((dayOfWeek !== undefined || startTime || endTime || isAvailable === false) && isAvailable !== true) {
      // Etkilenecek haftanın günü
      const affectedDayOfWeek = dayOfWeek !== undefined ? dayOfWeek : availability.dayOfWeek;
      
      // Son 30 günde bu müsaitlik zamanında olan seanslar
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const upcomingSessions = await Session.findAll({
        where: {
          therapistId: therapistProfile.id,
          status: { [Op.in]: ['confirmed', 'requested'] },
          startTime: { [Op.gt]: new Date() }
        },
        transaction
      });
      
      // Haftanın aynı günündeki seansları filtrele
      const affectedSessions = upcomingSessions.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate.getDay() === affectedDayOfWeek;
      });
      
      if (affectedSessions.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Bu zaman diliminde onaylanmış veya bekleyen seanslarınız bulunmaktadır. Lütfen önce bu seansları iptal edin veya başka bir zamana taşıyın.',
          affectedSessionsCount: affectedSessions.length
        });
      }
    }
    
    // Müsaitlik bilgisini güncelle
    await availability.update({
      dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : availability.dayOfWeek,
      startTime: startTime || availability.startTime,
      endTime: endTime || availability.endTime,
      isAvailable: isAvailable !== undefined ? isAvailable : availability.isAvailable,
      recurrence: recurrence || availability.recurrence,
      startDate: startDate ? new Date(startDate) : availability.startDate,
      endDate: endDate ? new Date(endDate) : availability.endDate,
      sessionDuration: sessionDuration || availability.sessionDuration,
      bufferBetweenSessions: bufferBetweenSessions || availability.bufferBetweenSessions
    }, { transaction });
    
    await transaction.commit();
    
    res.status(200).json({
      success: true,
      message: 'Müsaitlik bilgisi başarıyla güncellendi',
      data: availability
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Müsaitlik güncelleme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Müsaitlik bilgisi güncellenirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Terapist müsaitlik bilgisini sil
// @route   DELETE /api/therapist/availability/:id
// @access  Private (Therapist)
exports.deleteAvailability = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    // Müsaitlik bilgisini bul
    const availability = await Availability.findByPk(id, { transaction });
    
    if (!availability) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Müsaitlik bilgisi bulunamadı'
      });
    }
    
    // Terapist profili kontrolü
    const therapistProfile = await TherapistProfile.findOne({
      where: { userId: req.user.id },
      transaction
    });
    
    if (!therapistProfile || therapistProfile.id !== availability.therapistId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Bu müsaitlik bilgisini silme yetkiniz yok'
      });
    }
    
    // Etkilenen seanslar var mı kontrolü
    const affectedDayOfWeek = availability.dayOfWeek;
    
    const upcomingSessions = await Session.findAll({
      where: {
        therapistId: therapistProfile.id,
        status: { [Op.in]: ['confirmed', 'requested'] },
        startTime: { [Op.gt]: new Date() }
      },
      transaction
    });
    
    // Haftanın aynı günündeki seansları filtrele
    const affectedSessions = upcomingSessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate.getDay() === affectedDayOfWeek;
    });
    
    if (affectedSessions.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bu zaman diliminde onaylanmış veya bekleyen seanslarınız bulunmaktadır. Lütfen önce bu seansları iptal edin veya başka bir zamana taşıyın.',
        affectedSessionsCount: affectedSessions.length
      });
    }
    
    // Müsaitlik bilgisini sil
    await availability.destroy({ transaction });
    
    await transaction.commit();
    
    res.status(200).json({
      success: true,
      message: 'Müsaitlik bilgisi başarıyla silindi'
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Müsaitlik silme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Müsaitlik bilgisi silinirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Terapistin müsaitlik bilgilerini listele
// @route   GET /api/therapist/availability
// @access  Private (Therapist)
exports.getTherapistAvailabilities = async (req, res) => {
  try {
    // Terapist profili kontrolü
    const therapistProfile = await TherapistProfile.findOne({
      where: { userId: req.user.id }
    });
    
    if (!therapistProfile) {
      return res.status(404).json({
        success: false,
        message: 'Terapist profili bulunamadı'
      });
    }
    
    // Müsaitlik bilgilerini getir
    const availabilities = await Availability.findAll({
      where: { therapistId: therapistProfile.id },
      order: [
        ['dayOfWeek', 'ASC'],
        ['startTime', 'ASC']
      ]
    });
    
    res.status(200).json({
      success: true,
      count: availabilities.length,
      data: availabilities
    });
  } catch (err) {
    console.error('Müsaitlik listesi getirme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Müsaitlik bilgileri getirilirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Belirli bir terapistin müsaitlik bilgilerini getir (danışanlar için)
// @route   GET /api/therapist/:id/availability
// @access  Public
exports.getTherapistAvailabilitiesById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Terapist profili kontrolü
    const therapistProfile = await TherapistProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['firstName', 'lastName', 'isActive']
        }
      ]
    });
    
    if (!therapistProfile) {
      return res.status(404).json({
        success: false,
        message: 'Terapist profili bulunamadı'
      });
    }
    
    // Terapist aktif mi kontrolü
    if (!therapistProfile.User.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Bu terapist şu anda aktif değil'
      });
    }
    
    // Müsaitlik bilgilerini getir
    const availabilities = await Availability.findAll({
      where: {
        therapistId: id,
        isAvailable: true
      },
      order: [
        ['dayOfWeek', 'ASC'],
        ['startTime', 'ASC']
      ]
    });
    
    // Seans süreleri ve boşlukları ile birlikte müsaitlik bilgilerini düzenle
    const formattedAvailabilities = availabilities.map(availability => {
      const [startHour, startMinute] = availability.startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startTimeMinutes = startHour * 60 + startMinute;
      const endTimeMinutes = endHour * 60 + endMinute;
      const totalTimeMinutes = endTimeMinutes - startTimeMinutes;
      
      // Mevcut sürede kaç seans yapılabilir
      const possibleSessions = Math.floor(totalTimeMinutes / (availability.sessionDuration + availability.bufferBetweenSessions));
      
      // Seans başlangıç saatleri
      const sessionSlots = [];
      for (let i = 0; i < possibleSessions; i++) {
        const slotStartMinutes = startTimeMinutes + i * (availability.sessionDuration + availability.bufferBetweenSessions);
        const slotHour = Math.floor(slotStartMinutes / 60);
        const slotMinute = slotStartMinutes % 60;
        
        const slotStartTime = `${slotHour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`;
        
        const slotEndMinutes = slotStartMinutes + availability.sessionDuration;
        const endHour = Math.floor(slotEndMinutes / 60);
        const endMinute = slotEndMinutes % 60;
        
        const slotEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        
        sessionSlots.push({
          startTime: slotStartTime,
          endTime: slotEndTime,
          duration: availability.sessionDuration
        });
      }
      
      return {
        ...availability.toJSON(),
        sessionSlots
      };
    });
    
    res.status(200).json({
      success: true,
      count: formattedAvailabilities.length,
      data: formattedAvailabilities,
      therapistName: `${therapistProfile.User.firstName} ${therapistProfile.User.lastName}`
    });
  } catch (err) {
    console.error('Terapist müsaitlik getirme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Terapist müsaitlik bilgileri getirilirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};