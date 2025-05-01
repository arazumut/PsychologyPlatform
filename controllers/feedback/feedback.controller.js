const { Feedback, Session, TherapistProfile, ClientProfile, User } = require('../../models');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const emailService = require('../../utils/email/emailService');

// @desc    Seans için geri bildirim oluşturma (danışanlar için)
// @route   POST /api/feedback
// @access  Private (Client)
exports.createFeedback = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { sessionId, rating, comment, tags, isAnonymous } = req.body;
    
    // Gerekli alanların kontrolü
    if (!sessionId || !rating) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Seans ID ve puanlama gereklidir'
      });
    }
    
    // Geçerli bir rating mi kontrol et
    if (rating < 1 || rating > 5) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Puanlama 1 ile 5 arasında olmalıdır'
      });
    }
    
    // Kullanıcının danışan profilini al
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
    
    // Seansı bul ve kontrol et
    const session = await Session.findByPk(sessionId, {
      include: [
        { model: TherapistProfile, as: 'therapist', include: [{ model: User, as: 'User' }] }
      ],
      transaction
    });
    
    if (!session) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Seans bulunamadı'
      });
    }
    
    // Seans bu danışana ait mi kontrol et
    if (session.clientId !== clientProfile.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Bu seansa geri bildirim yapma yetkiniz yok'
      });
    }
    
    // Seans tamamlandı mı kontrol et
    if (session.status !== 'completed') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Sadece tamamlanmış seanslar için geri bildirim yapabilirsiniz'
      });
    }
    
    // Bu seans için zaten geri bildirim var mı kontrol et
    const existingFeedback = await Feedback.findOne({
      where: { sessionId },
      transaction
    });
    
    if (existingFeedback) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Bu seans için zaten geri bildirim yapmışsınız'
      });
    }
    
    // Yeni geri bildirim oluştur
    const feedback = await Feedback.create({
      sessionId,
      clientId: clientProfile.id,
      therapistId: session.therapistId,
      rating,
      comment: comment || '',
      tags: tags || [],
      isAnonymous: Boolean(isAnonymous),
      isApproved: false, // Geri bildirimler varsayılan olarak onay bekliyor durumunda
    }, { transaction });
    
    // İşlemi tamamla
    await transaction.commit();
    
    // Terapiste bildirim gönder
    try {
      const therapistUser = session.therapist.User;
      const feedbackUrl = `${req.protocol}://${req.get('host')}/therapist/dashboard/feedback/${feedback.id}`;
      
      await emailService.sendNewFeedbackNotificationEmail(
        therapistUser, 
        {
          therapistName: therapistUser.firstName,
          sessionDate: new Date(session.startTime).toLocaleDateString('tr-TR'),
          rating,
          isAnonymous: Boolean(isAnonymous),
          clientName: isAnonymous ? 'Anonim' : `${req.user.firstName} ${req.user.lastName}`,
          feedbackUrl
        }
      );
      
      console.log('Geri bildirim bildirimi e-postası gönderildi:', therapistUser.email);
    } catch (emailError) {
      console.error('Geri bildirim bildirimi e-postası gönderilemedi:', emailError);
      // E-posta hatası geri bildirim oluşturmayı engellemeyecek
    }
    
    res.status(201).json({
      success: true,
      message: 'Geri bildirim başarıyla oluşturuldu',
      data: feedback
    });
  } catch (err) {
    await transaction.rollback();
    console.error('Geri bildirim oluşturma hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Geri bildirim oluşturulurken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Bir terapistin tüm geri bildirimlerini görüntüleme
// @route   GET /api/feedback/therapist/:id
// @access  Public
exports.getTherapistFeedbacks = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, rating } = req.query;
    
    // Sayfa ve limit değerlerini sayıya dönüştür
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // Terapist profili kontrolü
    const therapistProfile = await TherapistProfile.findByPk(id, {
      include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName'] }]
    });
    
    if (!therapistProfile) {
      return res.status(404).json({
        success: false,
        message: 'Terapist profili bulunamadı'
      });
    }
    
    // Filtre ayarları
    const whereClause = {
      therapistId: id,
      isApproved: true,
      isPublic: true
    };
    
    // Rating filtresi eklenmişse
    if (rating && !isNaN(parseInt(rating))) {
      whereClause.rating = parseInt(rating);
    }
    
    // Onaylanmış ve genel geri bildirimleri al
    const { count, rows: feedbacks } = await Feedback.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Session,
          as: 'session',
          attributes: ['startTime', 'sessionType']
        },
        {
          model: ClientProfile,
          as: 'client',
          include: [
            { 
              model: User, 
              as: 'User',
              attributes: ['firstName', 'lastName'] 
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset
    });
    
    // Anonim olmayan geri bildirimleri formatla
    const formattedFeedbacks = feedbacks.map(feedback => {
      const formattedFeedback = {
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment,
        tags: feedback.tags,
        sessionDate: feedback.session ? new Date(feedback.session.startTime) : null,
        sessionType: feedback.session ? feedback.session.sessionType : null,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt,
        therapistResponse: feedback.therapistResponseComment,
        therapistResponseDate: feedback.therapistResponseDate
      };
      
      // Eğer anonim değilse danışan bilgilerini ekle
      if (!feedback.isAnonymous && feedback.client && feedback.client.User) {
        formattedFeedback.clientName = `${feedback.client.User.firstName} ${feedback.client.User.lastName}`;
      } else {
        formattedFeedback.clientName = 'Anonim';
      }
      
      return formattedFeedback;
    });
    
    // Sayfalama bilgilerini ekle
    const totalPages = Math.ceil(count / limitNum);
    
    res.status(200).json({
      success: true,
      count,
      totalPages,
      currentPage: pageNum,
      therapist: {
        id: therapistProfile.id,
        name: `${therapistProfile.User.firstName} ${therapistProfile.User.lastName}`,
        averageRating: therapistProfile.averageRating,
        ratingCount: therapistProfile.ratingCount
      },
      data: formattedFeedbacks
    });
  } catch (err) {
    console.error('Geri bildirim listeleme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Geri bildirimler listelenirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Terapistin geri bildirime yanıt vermesi
// @route   PUT /api/feedback/:id/respond
// @access  Private (Therapist)
exports.respondToFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    
    // Yanıt kontrolü
    if (!response) {
      return res.status(400).json({
        success: false,
        message: 'Yanıt metni gereklidir'
      });
    }
    
    // Geri bildirim kontrolü
    const feedback = await Feedback.findByPk(id, {
      include: [
        { model: Session, as: 'session' },
        { model: ClientProfile, as: 'client', include: [{ model: User, as: 'User' }] }
      ]
    });
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Geri bildirim bulunamadı'
      });
    }
    
    // Terapist yetki kontrolü
    const therapistProfile = await TherapistProfile.findOne({
      where: { userId: req.user.id }
    });
    
    if (!therapistProfile || therapistProfile.id !== feedback.therapistId) {
      return res.status(403).json({
        success: false,
        message: 'Bu geri bildirime yanıt verme yetkiniz yok'
      });
    }
    
    // Geri bildirim onaylanmış mı kontrolü
    if (!feedback.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Henüz onaylanmamış geri bildirimlere yanıt veremezsiniz'
      });
    }
    
    // Geri bildirim yanıtını güncelle
    feedback.therapistResponseComment = response;
    feedback.therapistResponseDate = new Date();
    await feedback.save();
    
    // Danışana bildirim gönder
    try {
      const feedbackUrl = `${req.protocol}://${req.get('host')}/client/dashboard/feedback/${feedback.id}`;
      
      await emailService.sendFeedbackResponseEmail(
        feedback.client.User,
        {
          clientName: feedback.client.User.firstName,
          therapistName: `${req.user.firstName} ${req.user.lastName}`,
          sessionDate: new Date(feedback.session.startTime).toLocaleDateString('tr-TR'),
          response,
          feedbackUrl
        }
      );
      
      console.log('Geri bildirim yanıt e-postası gönderildi:', feedback.client.User.email);
    } catch (emailError) {
      console.error('Geri bildirim yanıt e-postası gönderilemedi:', emailError);
      // E-posta hatası geri bildirim yanıtını engellemeyecek
    }
    
    res.status(200).json({
      success: true,
      message: 'Geri bildirime yanıt başarıyla kaydedildi',
      data: {
        id: feedback.id,
        response: feedback.therapistResponseComment,
        responseDate: feedback.therapistResponseDate
      }
    });
  } catch (err) {
    console.error('Geri bildirim yanıtlama hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Geri bildirim yanıtlanırken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Admin tarafından geri bildirimi onaylama/reddetme
// @route   PUT /api/feedback/:id/review
// @access  Private (Admin)
exports.reviewFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved, reviewNote } = req.body;
    
    // Onay durumu kontrolü
    if (isApproved === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Onay durumu belirtilmelidir'
      });
    }
    
    // Geri bildirim kontrolü
    const feedback = await Feedback.findByPk(id, {
      include: [
        { 
          model: TherapistProfile, 
          as: 'therapist',
          include: [{ model: User, as: 'User' }] 
        },
        { 
          model: ClientProfile, 
          as: 'client', 
          include: [{ model: User, as: 'User' }] 
        },
        { 
          model: Session, 
          as: 'session' 
        }
      ]
    });
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Geri bildirim bulunamadı'
      });
    }
    
    // Zaten incelenmiş mi kontrolü
    if (feedback.adminReviewedById) {
      return res.status(400).json({
        success: false,
        message: 'Bu geri bildirim zaten incelenmiş'
      });
    }
    
    // Onayı güncelle
    feedback.isApproved = isApproved;
    feedback.adminReviewedById = req.user.id;
    feedback.adminReviewDate = new Date();
    feedback.reviewNote = reviewNote || null;
    
    await feedback.save();
    
    // Eğer onaylandıysa terapistlerin ortalama puanını güncelle
    if (isApproved) {
      await Feedback.updateTherapistRating(feedback.therapistId);
      
      // Terapiste bildirim gönder
      try {
        const feedbackUrl = `${req.protocol}://${req.get('host')}/therapist/dashboard/feedback/${feedback.id}`;
        
        await emailService.sendFeedbackApprovedEmail(
          feedback.therapist.User,
          {
            therapistName: feedback.therapist.User.firstName,
            clientName: feedback.isAnonymous ? 'Anonim' : `${feedback.client.User.firstName} ${feedback.client.User.lastName}`,
            sessionDate: new Date(feedback.session.startTime).toLocaleDateString('tr-TR'),
            rating: feedback.rating,
            feedbackUrl
          }
        );
      } catch (emailError) {
        console.error('Geri bildirim onay e-postası gönderilemedi:', emailError);
      }
    } else {
      // Reddedildiyse danışana bildirim gönder
      try {
        await emailService.sendFeedbackRejectedEmail(
          feedback.client.User,
          {
            clientName: feedback.client.User.firstName,
            sessionDate: new Date(feedback.session.startTime).toLocaleDateString('tr-TR'),
            reason: reviewNote || 'Belirtilmemiş',
            supportEmail: process.env.SUPPORT_EMAIL || 'destek@psikolojikdestek.com'
          }
        );
      } catch (emailError) {
        console.error('Geri bildirim red e-postası gönderilemedi:', emailError);
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Geri bildirim başarıyla ${isApproved ? 'onaylandı' : 'reddedildi'}`,
      data: {
        id: feedback.id,
        isApproved: feedback.isApproved,
        reviewedDate: feedback.adminReviewDate
      }
    });
  } catch (err) {
    console.error('Geri bildirim inceleme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Geri bildirim incelenirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Kullanıcının (danışan) kendi geri bildirimlerini listele 
// @route   GET /api/feedback/my
// @access  Private (Client)
exports.getMyFeedbacks = async (req, res) => {
  try {
    // Danışan profili kontrolü
    const clientProfile = await ClientProfile.findOne({
      where: { userId: req.user.id }
    });
    
    if (!clientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Danışan profili bulunamadı'
      });
    }
    
    // Bu danışanın tüm geri bildirimlerini al
    const feedbacks = await Feedback.findAll({
      where: { clientId: clientProfile.id },
      include: [
        {
          model: Session,
          as: 'session',
          attributes: ['startTime', 'sessionType', 'status']
        },
        {
          model: TherapistProfile,
          as: 'therapist',
          include: [
            { 
              model: User, 
              as: 'User',
              attributes: ['firstName', 'lastName'] 
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Geri bildirimleri formatla
    const formattedFeedbacks = feedbacks.map(feedback => ({
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      tags: feedback.tags,
      isApproved: feedback.isApproved,
      isAnonymous: feedback.isAnonymous,
      sessionDate: new Date(feedback.session.startTime),
      sessionType: feedback.session.sessionType,
      therapistName: `${feedback.therapist.User.firstName} ${feedback.therapist.User.lastName}`,
      therapistResponse: feedback.therapistResponseComment,
      therapistResponseDate: feedback.therapistResponseDate,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt
    }));
    
    res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: formattedFeedbacks
    });
  } catch (err) {
    console.error('Geri bildirim listeleme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Geri bildirimler listelenirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// @desc    Geri bildirim detayı görüntüleme
// @route   GET /api/feedback/:id
// @access  Private
exports.getFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Geri bildirimi bul
    const feedback = await Feedback.findByPk(id, {
      include: [
        {
          model: Session,
          as: 'session'
        },
        {
          model: TherapistProfile,
          as: 'therapist',
          include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName'] }]
        },
        {
          model: ClientProfile,
          as: 'client',
          include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName'] }]
        }
      ]
    });
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Geri bildirim bulunamadı'
      });
    }
    
    // Kullanıcı bu geri bildirime erişebilir mi kontrolü
    let hasAccess = false;
    let detailLevel = 'public'; // public, client, therapist, admin
    
    if (req.user.role === 'admin') {
      hasAccess = true;
      detailLevel = 'admin';
    } else if (req.user.role === 'therapist') {
      const therapistProfile = await TherapistProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (therapistProfile && therapistProfile.id === feedback.therapistId) {
        hasAccess = true;
        detailLevel = 'therapist';
      }
    } else if (req.user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({
        where: { userId: req.user.id }
      });
      
      if (clientProfile && clientProfile.id === feedback.clientId) {
        hasAccess = true;
        detailLevel = 'client';
      }
    }
    
    // Genel olarak onaylanan geri bildirime herkes erişebilir
    if (!hasAccess && feedback.isApproved && feedback.isPublic) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bu geri bildirime erişim yetkiniz yok'
      });
    }
    
    // Detay seviyesine göre geri bildirim verilerini hazırla
    const feedbackData = {
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      tags: feedback.tags,
      isApproved: feedback.isApproved,
      sessionDate: new Date(feedback.session.startTime),
      sessionType: feedback.session.sessionType,
      therapistName: `${feedback.therapist.User.firstName} ${feedback.therapist.User.lastName}`,
      therapistResponse: feedback.therapistResponseComment,
      therapistResponseDate: feedback.therapistResponseDate,
      createdAt: feedback.createdAt
    };
    
    // Detay seviyesine göre ek bilgileri ekle
    if (['client', 'therapist', 'admin'].includes(detailLevel)) {
      feedbackData.isAnonymous = feedback.isAnonymous;
    }
    
    if (['therapist', 'admin'].includes(detailLevel) || detailLevel === 'client' && !feedback.isAnonymous) {
      feedbackData.clientName = `${feedback.client.User.firstName} ${feedback.client.User.lastName}`;
    } else {
      feedbackData.clientName = 'Anonim';
    }
    
    if (detailLevel === 'admin') {
      feedbackData.adminReviewedById = feedback.adminReviewedById;
      feedbackData.adminReviewDate = feedback.adminReviewDate;
      feedbackData.reviewNote = feedback.reviewNote;
      feedbackData.isPublic = feedback.isPublic;
      feedbackData.isFlagged = feedback.isFlagged;
      feedbackData.flagReason = feedback.flagReason;
      feedbackData.flaggedById = feedback.flaggedById;
      feedbackData.flaggedDate = feedback.flaggedDate;
    }
    
    res.status(200).json({
      success: true,
      data: feedbackData
    });
  } catch (err) {
    console.error('Geri bildirim detayı getirme hatası:', err);
    res.status(500).json({
      success: false,
      message: 'Geri bildirim detayı getirilirken bir hata oluştu',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};