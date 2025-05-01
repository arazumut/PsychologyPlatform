const { Session, TherapistProfile, ClientProfile, User, Availability } = require('../../models');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');

// @desc    Yeni seans oluştur (danışanlar için)
// @route   POST /api/session
// @access  Private (Client)
exports.createSession = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { therapistId, startTime, endTime, sessionType, communicationType } = req.body;
    
    // Gerekli alanların kontrolü
    if (!therapistId || !startTime || !endTime || !sessionType || !communicationType) {
      return res.status(400).json({
        success: false,
        message: 'Tüm gerekli alanları doldurmalısınız'
      });
    }
    
    // Kullanıcı danışan profili kontrolü
    const clientProfile = await ClientProfile.findOne({ 
      where: { userId: req.user.id },
      transaction
    });
    
    if (!clientProfile) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Danışan profili bulunamadı'
      });
    }
    
    // Terapist profili kontrolü
    const therapistProfile = await TherapistProfile.findByPk(therapistId, { 
      include: [{ model: User, as: 'User' }],
      transaction
    });
    
    if (!therapistProfile) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Terapist profili bulunamadı'
      });
    }
    
    // Terapist aktif mi kontrolü
    if (!therapistProfile.User.isActive) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Terapist şu anda aktif değil'
      });
    }
    
    // Terapistin müsaitlik kontrolü
    const sessionStartTime = new Date(startTime);
    const sessionEndTime = new Date(endTime);
    
    // Geçmiş tarih kontrolü
    if (sessionStartTime <= new Date()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Geçmiş bir tarih için randevu oluşturamazsınız'
      });
    }
    
    // Başlangıç ve bitiş saatlerinin mantıklı olma kontrolü
    if (sessionStartTime >= sessionEndTime) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Başlangıç saati, bitiş saatinden önce olmalıdır'
      });
    }
    
    // Terapistin bu saatte başka bir seansı var mı kontrolü
    const overlappingSessions = await Session.findAll({
      where: {
        therapistId,
        status: { [Op.in]: ['confirmed', 'requested'] },
        [Op.or]: [
          {
            startTime: { [Op.lt]: sessionEndTime },
            endTime: { [Op.gt]: sessionStartTime }
          }
        ]
      },
      transaction
    });
    
    if (overlappingSessions.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Terapist bu saatte müsait değil'
      });
    }
    
    // Terapistin çalışma takviminde bu saat var mı kontrolü
    const dayOfWeek = sessionStartTime.getDay(); // 0: Pazar, 1: Pazartesi, ...
    const sessionTimeHours = sessionStartTime.getHours().toString().padStart(2, '0');
    const sessionTimeMinutes = sessionStartTime.getMinutes().toString().padStart(2, '0');
    const sessionTimeStr = `${sessionTimeHours}:${sessionTimeMinutes}`;
    
    const availability = await Availability.findOne({
      where: {
        therapistId,
        dayOfWeek,
        isAvailable: true,
        [Op.and]: [
          sequelize.literal(`TIME(startTime) <= TIME('${sessionTimeStr}')`),
          sequelize.literal(`TIME(endTime) >= TIME('${sessionTimeStr}')`)
        ]
      },
      transaction
    });
    
    if (!availability) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Terapist bu saatte çalışma takviminde görünmüyor'
      });
    }
    
    // Yeni seans oluştur
    const session = await Session.create({
      therapistId,
      clientId: clientProfile.id,
      startTime: sessionStartTime,
      endTime: sessionEndTime,
      sessionType,
      communicationType,
      status: 'requested',
      sessionFee: therapistProfile.sessionRate
    }, { transaction });
    
    // İşlemi tamamla
    await transaction.commit();
    
    // TODO: Terapiste bildirim gönder
    
    res.status(201).json({
      success: true,
      message: 'Seans talebi başarıyla oluşturuldu',
      data: session
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Seans oluşturma hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Seans oluşturulurken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Terapi seansını onayla (terapistler için)
// @route   PUT /api/session/:id/confirm
// @access  Private (Therapist)
exports.confirmSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Seansı bul
    const session = await Session.findByPk(id, {
      include: [
        { model: TherapistProfile, as: 'therapist' },
        { model: ClientProfile, as: 'client', include: [{ model: User, as: 'User' }] }
      ]
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Seans bulunamadı'
      });
    }
    
    // Terapist yetki kontrolü
    const therapistProfile = await TherapistProfile.findOne({
      where: { userId: req.user.id }
    });
    
    if (!therapistProfile || therapistProfile.id !== session.therapistId) {
      return res.status(403).json({
        success: false,
        message: 'Bu seansı onaylama yetkiniz yok'
      });
    }
    
    // Seans durumu kontrolü
    if (session.status !== 'requested') {
      return res.status(400).json({
        success: false,
        message: 'Bu seans talebi zaten onaylanmış veya iptal edilmiş'
      });
    }
    
    // Seans başlangıç zamanı geçmiş mi kontrolü
    if (new Date(session.startTime) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Geçmiş bir seansı onaylayamazsınız'
      });
    }
    
    // Seansı onayla
    session.status = 'confirmed';
    await session.save();
    
    // TODO: Danışana bildirim gönder
    
    res.status(200).json({
      success: true,
      message: 'Seans başarıyla onaylandı',
      data: session
    });
  } catch (err) {
    console.error('Seans onaylama hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Seans onaylanırken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Terapi seansını iptal et
// @route   PUT /api/session/:id/cancel
// @access  Private (Client, Therapist)
exports.cancelSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Seansı bul
    const session = await Session.findByPk(id, {
      include: [
        { model: TherapistProfile, as: 'therapist' },
        { model: ClientProfile, as: 'client' }
      ]
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Seans bulunamadı'
      });
    }
    
    // Kullanıcı yetki kontrolü
    let userType = null;
    
    if (req.user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (clientProfile && clientProfile.id === session.clientId) {
        userType = 'client';
      }
    } else if (req.user.role === 'therapist') {
      const therapistProfile = await TherapistProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (therapistProfile && therapistProfile.id === session.therapistId) {
        userType = 'therapist';
      }
    }
    
    if (!userType) {
      return res.status(403).json({
        success: false,
        message: 'Bu seansı iptal etme yetkiniz yok'
      });
    }
    
    // Seans durumu kontrolü
    if (session.status !== 'requested' && session.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Bu seans zaten iptal edilmiş veya tamamlanmış'
      });
    }
    
    // Seansın başlangıç zamanına 24 saatten az kaldıysa (isteğe bağlı)
    const isLessThan24Hours = (new Date(session.startTime) - new Date()) < 24 * 60 * 60 * 1000;
    
    // Seansı iptal et
    session.status = 'cancelled';
    session.cancelledBy = userType;
    session.cancellationReason = reason;
    await session.save();
    
    // TODO: Diğer tarafa bildirim gönder
    
    res.status(200).json({
      success: true,
      message: 'Seans başarıyla iptal edildi',
      data: {
        ...session.toJSON(),
        isLessThan24Hours
      }
    });
  } catch (err) {
    console.error('Seans iptali hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Seans iptal edilirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Terapi seansını sonlandır
// @route   PUT /api/session/:id/complete
// @access  Private (Therapist)
exports.completeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { therapistNotes, sessionSummary } = req.body;
    
    // Seansı bul
    const session = await Session.findByPk(id, {
      include: [
        { model: TherapistProfile, as: 'therapist' },
        { model: ClientProfile, as: 'client' }
      ]
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Seans bulunamadı'
      });
    }
    
    // Terapist yetki kontrolü
    const therapistProfile = await TherapistProfile.findOne({
      where: { userId: req.user.id }
    });
    
    if (!therapistProfile || therapistProfile.id !== session.therapistId) {
      return res.status(403).json({
        success: false,
        message: 'Bu seansı sonlandırma yetkiniz yok'
      });
    }
    
    // Seans durumu kontrolü
    if (session.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Bu seans onaylanmamış veya iptal edilmiş'
      });
    }
    
    // Seansı tamamla
    session.status = 'completed';
    session.therapistNotes = therapistNotes;
    session.sessionSummary = sessionSummary;
    await session.save();
    
    // TODO: Danışana geri bildirim talebinde bulunma bildirimi gönder
    
    res.status(200).json({
      success: true,
      message: 'Seans başarıyla tamamlandı',
      data: session
    });
  } catch (err) {
    console.error('Seans tamamlama hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Seans tamamlanırken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Kullanıcı için seans listesini getir
// @route   GET /api/session
// @access  Private (Client, Therapist)
exports.getSessions = async (req, res) => {
  try {
    let whereClause = {};
    
    // Sorgu parametreleri
    const { status, startDate, endDate } = req.query;
    
    // Kullanıcı tipine göre sorguyu ayarla
    if (req.user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (!clientProfile) {
        return res.status(404).json({
          success: false,
          message: 'Danışan profili bulunamadı'
        });
      }
      
      whereClause.clientId = clientProfile.id;
    } else if (req.user.role === 'therapist') {
      const therapistProfile = await TherapistProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (!therapistProfile) {
        return res.status(404).json({
          success: false,
          message: 'Terapist profili bulunamadı'
        });
      }
      
      whereClause.therapistId = therapistProfile.id;
    } else if (req.user.role === 'admin') {
      // Admin tüm seansları görebilir
    } else {
      return res.status(403).json({
        success: false,
        message: 'Bu kaynağa erişim izniniz yok'
      });
    }
    
    // Durum filtreleme
    if (status && ['requested', 'confirmed', 'cancelled', 'completed', 'no-show'].includes(status)) {
      whereClause.status = status;
    }
    
    // Tarih aralığı filtreleme
    if (startDate) {
      whereClause.startTime = whereClause.startTime || {};
      whereClause.startTime[Op.gte] = new Date(startDate);
    }
    
    if (endDate) {
      whereClause.startTime = whereClause.startTime || {};
      whereClause.startTime[Op.lte] = new Date(endDate);
    }
    
    // Seansları getir
    const sessions = await Session.findAll({
      where: whereClause,
      include: [
        { 
          model: TherapistProfile, 
          as: 'therapist',
          include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName', 'email'] }] 
        },
        { 
          model: ClientProfile, 
          as: 'client',
          include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName', 'email'] }]
        }
      ],
      order: [['startTime', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (err) {
    console.error('Seans listesi getirme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Seans listesi getirilirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Tek bir seansın detaylarını getir
// @route   GET /api/session/:id
// @access  Private (Client, Therapist)
exports.getSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Seansı bul
    const session = await Session.findByPk(id, {
      include: [
        { 
          model: TherapistProfile, 
          as: 'therapist',
          include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName', 'email'] }] 
        },
        { 
          model: ClientProfile, 
          as: 'client',
          include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName', 'email'] }]
        }
      ]
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Seans bulunamadı'
      });
    }
    
    // Kullanıcı yetki kontrolü
    let hasAccess = false;
    
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else if (req.user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (clientProfile && clientProfile.id === session.clientId) {
        hasAccess = true;
      }
    } else if (req.user.role === 'therapist') {
      const therapistProfile = await TherapistProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (therapistProfile && therapistProfile.id === session.therapistId) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bu seansa erişim yetkiniz yok'
      });
    }
    
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (err) {
    console.error('Seans detayı getirme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Seans detayı getirilirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};