const { Sequelize } = require('sequelize');
const path = require('path');

// SQLite veritabanı için dosya konumu
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/psychology_platform.sqlite');

// Sequelize yapılandırması
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false
  }
});

// Veritabanı bağlantı testi
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('SQLite veritabanı bağlantısı başarılı.');

    // Veritabanı dosya dizini kontrolü ve oluşturma
    const fs = require('fs');
    const dataDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`Veritabanı dizini oluşturuldu: ${dataDir}`);
    }

    return true;
  } catch (error) {
    console.error('Veritabanı bağlantı hatası:', error);
    throw error;
  }
};

module.exports = { sequelize, testConnection };