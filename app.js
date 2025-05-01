const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const socketService = require('./services/socket.service');
const { testConnection, sequelize } = require('./config/database');

// .env dosyasını yükle
dotenv.config();

// Express uygulaması oluştur
const app = express();
const server = http.createServer(app);

// Socket.io başlat
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? process.env.BASE_URL : '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io servisi başlat
socketService(io);

// Middleware'ler
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());

// Logging sadece geliştirme ortamında
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Route'ları bağla
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/session', require('./routes/session.routes'));
app.use('/api/therapist', require('./routes/therapist.routes'));

// View router'ını bağla - sayfa görünümleri için
app.use('/', require('./routes/view.routes'));

// 404 hatası artık view router'da olmayan rotalar için
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Sayfa Bulunamadı',
    message: 'Aradığınız sayfa bulunamadı.'
  });
});

// Hata işleme middleware'i
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).render('error', {
    title: 'Hata',
    message: process.env.NODE_ENV === 'production' ? 'Bir hata oluştu' : err.message
  });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;

// Veritabanı bağlantısı ve senkronizasyonu
(async () => {
  try {
    // Veritabanı bağlantısı test et
    await testConnection();
    
    // Modelleri senkronize et
    const force = process.env.DB_FORCE_SYNC === 'true';
    await sequelize.sync({ force });
    console.log(`Veritabanı modelleri ${force ? 'yeniden oluşturuldu' : 'senkronize edildi'}`);
    
    // Sunucuyu başlat
    server.listen(PORT, () => {
      console.log(`Sunucu ${process.env.NODE_ENV} modunda ${PORT} portunda çalışıyor`);
      console.log(`http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Sunucu başlatılamadı:', error);
    process.exit(1);
  }
})();

// Oturum kapama sinyallerini dinle
process.on('SIGINT', async () => {
  console.log('Sunucu kapatılıyor...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Sunucu kapatılıyor...');
  await sequelize.close();
  process.exit(0);
});