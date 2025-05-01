# Psikolojik Destek Platformu

![Psikolojik Destek Platformu]

## 📋 Proje Hakkında

Psikolojik Destek Platformu, danışanları ve terapistleri bir araya getiren modern bir çevrimiçi terapi platformudur. Kullanıcılar profesyonel psikolojik destek alabilir, uzman terapistlerle video görüşmesi yapabilir ve mental sağlıklarını yönetebilirler.

### 🌟 Özellikler

- **Güvenli Video Görüşmesi**: End-to-end şifrelenmiş, KVKK ve GDPR uyumlu görüşme ortamı
- **Terapist Eşleştirme**: Uzmanlık alanı ve deneyime göre terapist bulma
- **Online Randevu**: 7/24 online randevu planlama ve yönetimi  
- **Danışan Takibi**: Terapistler için kapsamlı danışan ilerleme takibi
- **Ödeme Entegrasyonu**: Güvenli online ödeme sistemi
- **İlerleme Takibi**: Kullanıcılar için interaktif ilerleme grafikleri ve raporları
- **Kaynak Kütüphanesi**: Mental sağlık konularında zengin içerik

## 🚀 Başlangıç

### Ön Gereksinimler

- Node.js (v14.0.0 veya üstü)
- npm (v6.0.0 veya üstü)
- SQLite (varsayılan veritabanı) veya MySQL/PostgreSQL

### Kurulum

1. Repoyu klonlayın:
   ```bash
   git clone https://github.com/yourusername/psychology-platform.git
   cd psychology-platform
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli değişkenleri ayarlayın:
   ```bash
   cp .env.example .env
   ```

4. Veritabanını kurun:
   ```bash
   npm run db:setup
   ```

5. Uygulamayı başlatın:
   ```bash
   npm run dev
   ```

6. Tarayıcınızda şu adrese gidin: `http://localhost:3000`

## 📊 Sistem Mimarisi

![Sistem Mimarisi](/public/images/system-architecture.png)

Platform aşağıdaki ana bileşenlerden oluşmaktadır:

- **Kullanıcı Yönetimi**: Kimlik doğrulama, yetkilendirme, profil yönetimi
- **Randevu Sistemi**: Randevu oluşturma, iptal etme, yeniden planlama
- **Video Konferans**: WebRTC tabanlı görüntülü görüşme sistemi
- **Ödeme İşlemleri**: İyzico ve Stripe entegrasyonları
- **Bildirim Sistemi**: E-posta ve anlık bildirimler
- **Raporlama Araçları**: Terapistler ve danışanlar için analitik paneller

## 💻 Teknoloji Yığını

- **Frontend**: EJS, HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Veritabanı**: SQLite (geliştirme), PostgreSQL (üretim)
- **Kimlik Doğrulama**: JWT, Passport.js
- **Video Konferans**: WebRTC, Socket.io
- **Ödeme İşlemleri**: Iyzico, Stripe
- **Bildirim Sistemi**: Nodemailer, Socket.io
- **Dağıtım**: Docker, Kubernetes

## 📝 API Dokümantasyonu

Tüm API endpointleri Swagger UI ile belgelenmiştir. Sunucu çalışırken `/api-docs` adresinden erişilebilir.

## 🔒 Veri Güvenliği

- Tüm kişisel veriler KVKK ve GDPR gereksinimlerine uygun olarak işlenmektedir
- Veritabanı bağlantıları şifrelenmiştir
- Video görüşmeleri end-to-end şifreleme ile korunmaktadır
- Düzenli güvenlik denetimleri ve penetrasyon testleri yapılmaktadır

## 🛠️ Kullanıcı Rolleri ve İzinler

### 👨‍⚕️ Terapistler

- Danışan kabul edebilir ve reddedebilir
- Müsaitlik saatlerini ayarlayabilir
- Danışan notları ekleyebilir
- Seans raporlarını görüntüleyebilir
- İlerleme metriklerini takip edebilir
- Kaynakları yönetebilir

### 👨‍💼 Danışanlar

- Terapist arayabilir ve filtreleyebilir
- Randevu oluşturabilir ve yönetebilir
- Video görüşmelerine katılabilir
- Geri bildirim gönderebilir
- İlerlemeyi görüntüleyebilir
- Kaynakları inceleyebilir

### 👩‍💼 Yöneticiler

- Kullanıcıları yönetebilir
- Terapist onaylayabilir
- Platform metriklerini görüntüleyebilir
- İçerik yönetebilir
- Sistem ayarlarını değiştirebilir


## 📱 Mobil Uyumluluk

Platform tam olarak mobil uyumludur ve aşağıdaki cihazlardan erişilebilir:
- 📱 Akıllı telefonlar (iOS ve Android)
- 🖥️ Masaüstü bilgisayarlar
- 💻 Dizüstü bilgisayarlar
- 📟 Tabletler

## 📈 Yol Haritası

- [x] Temel platform geliştirmesi
- [x] Video konferans entegrasyonu
- [x] Ödeme sistemi entegrasyonu
- [ ] Mobil uygulama (iOS ve Android)
- [ ] AI destekli terapist eşleştirme
- [ ] Grup terapisi oturumları
- [ ] Çoklu dil desteği genişletmesi

## 🤝 Katkıda Bulunma

1. Bu repoyu fork edin
2. Feature branch'inizi oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Bir Pull Request açın


---

&copy; 2025 Psikolojik Destek Platformu. Tüm hakları saklıdır.