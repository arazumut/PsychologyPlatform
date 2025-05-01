const { Session, TherapistProfile, ClientProfile, User } = require('../../models');
const { Op } = require('sequelize');
const emailService = require('../../utils/email/emailService');

/**
 * Yaklaşan seanslar için hatırlatma e-postaları gönderen servis
 */
class SessionReminderService {
  constructor() {
    // Varsayılan ayarlar
    this.reminderTimes = [
      { hours: 24, sent: new Set() }, // 24 saat önce
      { hours: 1, sent: new Set() }   // 1 saat önce
    ];
  }

  /**
   * Yaklaşan seansları kontrol et ve hatırlatma e-postaları gönder
   * @param {string} baseUrl - Uygulama temel URL'i
   */
  async checkAndSendReminders(baseUrl) {
    try {
      console.log('Seans hatırlatmaları kontrol ediliyor...');
      const now = new Date();

      // Her hatırlatma süresi için kontrol et
      for (const reminder of this.reminderTimes) {
        const targetTime = new Date(now.getTime() + reminder.hours * 60 * 60 * 1000);
        
        // Yaklaşan seansları bul (belirli bir süre içinde başlayacak olanlar)
        const upcomingSessions = await Session.findAll({
          where: {
            status: 'confirmed',
            startTime: {
              [Op.gt]: now,
              [Op.lt]: targetTime
            }
          },
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
            }
          ]
        });

        console.log(`${reminder.hours} saat içinde başlayacak ${upcomingSessions.length} seans bulundu`);

        // Her seans için hatırlatma gönder
        for (const session of upcomingSessions) {
          const sessionKey = `${session.id}_${reminder.hours}`;
          
          // Bu hatırlatma zaten gönderilmiş mi kontrol et
          if (reminder.sent.has(sessionKey)) {
            continue;
          }
          
          // Seans URL'i
          const therapistSessionUrl = `${baseUrl}/therapist/dashboard/sessions/${session.id}/join`;
          const clientSessionUrl = `${baseUrl}/client/dashboard/sessions/${session.id}/join`;
          
          try {
            // Terapiste hatırlatma gönder
            await emailService.sendSessionReminderEmail(
              session.therapist.User,
              {
                firstName: session.therapist.User.firstName,
                roleName: 'terapist',
                clientName: `${session.client.User.firstName} ${session.client.User.lastName}`,
                sessionDate: new Date(session.startTime).toLocaleDateString('tr-TR'),
                sessionTime: new Date(session.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                sessionType: session.sessionType,
                communicationType: session.communicationType,
                reminderHours: reminder.hours,
                sessionUrl: therapistSessionUrl
              }
            );
            
            // Danışana hatırlatma gönder
            await emailService.sendSessionReminderEmail(
              session.client.User,
              {
                firstName: session.client.User.firstName,
                roleName: 'danışan',
                therapistName: `${session.therapist.User.firstName} ${session.therapist.User.lastName}`,
                sessionDate: new Date(session.startTime).toLocaleDateString('tr-TR'),
                sessionTime: new Date(session.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                sessionType: session.sessionType,
                communicationType: session.communicationType,
                reminderHours: reminder.hours,
                sessionUrl: clientSessionUrl
              }
            );
            
            console.log(`${session.id} ID'li seans için ${reminder.hours} saat hatırlatması gönderildi`);
            
            // Bu hatırlatmayı gönderildi olarak işaretle
            reminder.sent.add(sessionKey);
            
            // Seanstan sonra, bu seansı hatırlatma listesinden kaldırmak için bir zamanlayıcı ayarla
            const sessionStartTime = new Date(session.startTime).getTime();
            const timeUntilSessionStarts = sessionStartTime - now.getTime();
            
            setTimeout(() => {
              reminder.sent.delete(sessionKey);
            }, timeUntilSessionStarts + 60 * 60 * 1000); // Seans başladıktan 1 saat sonra listeden kaldır
            
          } catch (error) {
            console.error(`Hatırlatma e-postası gönderilirken hata oluştu (Seans ID: ${session.id}):`, error);
          }
        }
      }
    } catch (error) {
      console.error('Seans hatırlatmaları kontrol edilirken hata:', error);
    }
  }

  /**
   * Belirtilen aralıklarla hatırlatma kontrolünü başlat
   * @param {string} baseUrl - Uygulama temel URL'i
   * @param {number} interval - Kontrol aralığı (dakika cinsinden)
   */
  startReminderScheduler(baseUrl, interval = 15) {
    console.log(`Seans hatırlatma servisi başlatıldı, kontrol aralığı: ${interval} dakika`);
    
    // İlk kontrol
    this.checkAndSendReminders(baseUrl);
    
    // Periyodik kontroller
    setInterval(() => {
      this.checkAndSendReminders(baseUrl);
    }, interval * 60 * 1000);
  }
}

module.exports = new SessionReminderService();