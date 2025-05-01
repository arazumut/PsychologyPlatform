const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');

// E-posta şablonları için klasör yolu
const templatesDir = path.join(__dirname, '../../views/email-templates');

// Nodemailer transporter ayarları
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Şablondan e-posta içeriği oluştur
const renderEmailTemplate = async (templateName, data) => {
  const templatePath = path.join(templatesDir, `${templateName}.ejs`);
  
  try {
    // Şablon dosyasının varlığını kontrol et
    if (!fs.existsSync(templatePath)) {
      console.error(`E-posta şablonu bulunamadı: ${templateName}`);
      throw new Error(`E-posta şablonu bulunamadı: ${templateName}`);
    }
    
    // Şablonu render et
    const template = fs.readFileSync(templatePath, 'utf-8');
    return ejs.render(template, data);
  } catch (err) {
    console.error('E-posta şablonu oluşturulurken hata:', err);
    throw err;
  }
};

// E-posta gönderme fonksiyonu
const sendEmail = async ({ to, subject, template, templateData }) => {
  try {
    const transporter = createTransporter();
    
    // Şablonu kullanarak HTML içeriğini oluştur
    const html = await renderEmailTemplate(template, templateData);
    
    // E-posta gönder
    const info = await transporter.sendMail({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html
    });
    
    console.log(`E-posta gönderildi: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('E-posta gönderme hatası:', err);
    throw err;
  }
};

// Doğrulama e-postası gönder
exports.sendVerificationEmail = async (user, verificationUrl) => {
  const templateData = {
    firstName: user.firstName,
    verificationUrl,
    supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM,
    siteUrl: process.env.BASE_URL,
    siteName: process.env.SITE_NAME || 'Psikolojik Destek Platformu'
  };
  
  return sendEmail({
    to: user.email,
    subject: 'E-posta Adresinizi Doğrulayın',
    template: 'email-verification',
    templateData
  });
};

// Şifre sıfırlama e-postası gönder
exports.sendPasswordResetEmail = async (user, resetUrl) => {
  const templateData = {
    firstName: user.firstName,
    resetUrl,
    supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM,
    siteUrl: process.env.BASE_URL,
    siteName: process.env.SITE_NAME || 'Psikolojik Destek Platformu'
  };
  
  return sendEmail({
    to: user.email,
    subject: 'Şifre Sıfırlama Talebi',
    template: 'password-reset',
    templateData
  });
};

// Seans hatırlatma e-postası gönder
exports.sendSessionReminderEmail = async (user, session, therapist) => {
  const startTime = new Date(session.startTime);
  
  const templateData = {
    firstName: user.firstName,
    therapistName: `${therapist.User.firstName} ${therapist.User.lastName}`,
    sessionDate: startTime.toLocaleDateString('tr-TR'),
    sessionTime: startTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    sessionType: session.sessionType,
    sessionUrl: `${process.env.BASE_URL}/sessions/${session.id}/join`,
    supportEmail: process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM,
    siteName: process.env.SITE_NAME || 'Psikolojik Destek Platformu'
  };
  
  return sendEmail({
    to: user.email,
    subject: 'Yaklaşan Seans Hatırlatması',
    template: 'session-reminder',
    templateData
  });
};