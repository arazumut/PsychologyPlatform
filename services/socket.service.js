const { User, Session } = require('../models');
const jwt = require('jsonwebtoken');

const EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_SESSION: 'join_session',
  LEAVE_SESSION: 'leave_session',
  NEW_MESSAGE: 'new_message',
  RECEIVE_MESSAGE: 'receive_message',
  SESSION_STATUS: 'session_status',
  VIDEO_OFFER: 'video_offer',
  VIDEO_ANSWER: 'video_answer',
  NEW_ICE_CANDIDATE: 'new_ice_candidate',
  ERROR: 'error',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline'
};

// Çevrimiçi kullanıcıları takip eden obje
const onlineUsers = {};
// Aktif seans odalarını takip eden obje
const activeSessionRooms = {};

module.exports = (io) => {
  // JWT token kontrolü için middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Kimlik doğrulama gerekli'));
      }
      
      // Token doğrula
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Kullanıcıyı bul
      const user = await User.findByPk(decoded.id);
      
      if (!user) {
        return next(new Error('Kullanıcı bulunamadı'));
      }
      
      // Kullanıcı bilgisini socket'e ekle
      socket.user = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      };
      
      next();
    } catch (err) {
      return next(new Error('Geçersiz token'));
    }
  });

  io.on(EVENTS.CONNECTION, (socket) => {
    console.log(`Kullanıcı bağlandı: ${socket.user.id}`);
    
    // Kullanıcıyı çevrimiçi olarak işaretle
    onlineUsers[socket.user.id] = {
      socketId: socket.id,
      user: socket.user
    };
    
    // Kullanıcının çevrimiçi olduğunu bildirme (terapist/danışan ilişkilerine göre)
    io.emit(EVENTS.USER_ONLINE, {
      userId: socket.user.id,
      role: socket.user.role
    });
    
    // Seansa katılma
    socket.on(EVENTS.JOIN_SESSION, async ({ sessionId }) => {
      try {
        // Seansı veritabanından kontrol et
        const session = await Session.findByPk(sessionId);
        
        if (!session) {
          socket.emit(EVENTS.ERROR, { message: 'Seans bulunamadı' });
          return;
        }
        
        // Kullanıcının bu seansa katılma yetkisi var mı kontrol et
        const isAuthorized = 
          socket.user.role === 'admin' || 
          (socket.user.role === 'therapist' && session.therapistId === socket.user.id) ||
          (socket.user.role === 'client' && session.clientId === socket.user.id);
        
        if (!isAuthorized) {
          socket.emit(EVENTS.ERROR, { message: 'Bu seansa katılma yetkiniz yok' });
          return;
        }
        
        // Seans odasının adı
        const roomName = `session_${sessionId}`;
        
        // Odaya katıl
        socket.join(roomName);
        
        // Oda bilgisini güncelle
        if (!activeSessionRooms[roomName]) {
          activeSessionRooms[roomName] = {
            sessionId,
            participants: {}
          };
        }
        
        // Katılımcı bilgisini güncelle
        activeSessionRooms[roomName].participants[socket.user.id] = {
          socketId: socket.id,
          user: socket.user
        };
        
        // Odadaki diğer kullanıcılara bilgi ver
        socket.to(roomName).emit(EVENTS.SESSION_STATUS, {
          action: 'join',
          user: socket.user
        });
        
        // Başarıyla katıldığını kullanıcıya bildir
        socket.emit(EVENTS.SESSION_STATUS, {
          action: 'joined',
          participants: Object.values(activeSessionRooms[roomName].participants).map(p => p.user)
        });
        
        console.log(`${socket.user.id} kullanıcısı ${sessionId} ID'li seansa katıldı`);
      } catch (err) {
        console.error('Seansa katılma hatası:', err);
        socket.emit(EVENTS.ERROR, { message: 'Seansa katılırken bir hata oluştu' });
      }
    });
    
    // Seanstan ayrılma
    socket.on(EVENTS.LEAVE_SESSION, ({ sessionId }) => {
      const roomName = `session_${sessionId}`;
      
      socket.leave(roomName);
      
      // Oda bilgisini güncelle
      if (activeSessionRooms[roomName] && 
          activeSessionRooms[roomName].participants[socket.user.id]) {
        delete activeSessionRooms[roomName].participants[socket.user.id];
        
        // Odada kimse kalmadıysa odayı kaldır
        if (Object.keys(activeSessionRooms[roomName].participants).length === 0) {
          delete activeSessionRooms[roomName];
        } else {
          // Odadaki diğer kullanıcılara bilgi ver
          socket.to(roomName).emit(EVENTS.SESSION_STATUS, {
            action: 'leave',
            userId: socket.user.id
          });
        }
      }
      
      console.log(`${socket.user.id} kullanıcısı ${sessionId} ID'li seanstan ayrıldı`);
    });
    
    // Yeni mesaj gönderme
    socket.on(EVENTS.NEW_MESSAGE, ({ sessionId, message }) => {
      const roomName = `session_${sessionId}`;
      
      // Kullanıcı bu odada mı kontrol et
      if (!socket.rooms.has(roomName)) {
        socket.emit(EVENTS.ERROR, { message: 'Bu seansa katılmadınız' });
        return;
      }
      
      const messageData = {
        sender: socket.user,
        content: message,
        timestamp: new Date()
      };
      
      // Odadaki diğer kullanıcılara mesajı ilet
      socket.to(roomName).emit(EVENTS.RECEIVE_MESSAGE, messageData);
      
      console.log(`${socket.user.id} kullanıcısından ${sessionId} ID'li seansa mesaj: ${message}`);
    });
    
    // WebRTC sinyalleşme: Video teklifi
    socket.on(EVENTS.VIDEO_OFFER, ({ sessionId, targetUserId, sdp }) => {
      const roomName = `session_${sessionId}`;
      
      // Kullanıcı bu odada mı kontrol et
      if (!socket.rooms.has(roomName)) {
        socket.emit(EVENTS.ERROR, { message: 'Bu seansa katılmadınız' });
        return;
      }
      
      // Hedef kullanıcıyı bul
      const targetParticipant = activeSessionRooms[roomName]?.participants[targetUserId];
      
      if (!targetParticipant) {
        socket.emit(EVENTS.ERROR, { message: 'Hedef kullanıcı seansa bağlı değil' });
        return;
      }
      
      // Video teklifini hedef kullanıcıya ilet
      io.to(targetParticipant.socketId).emit(EVENTS.VIDEO_OFFER, {
        from: socket.user,
        sdp
      });
      
      console.log(`${socket.user.id} kullanıcısından ${targetUserId} kullanıcısına video teklifi gönderildi`);
    });
    
    // WebRTC sinyalleşme: Video cevabı
    socket.on(EVENTS.VIDEO_ANSWER, ({ sessionId, targetUserId, sdp }) => {
      const roomName = `session_${sessionId}`;
      
      // Kullanıcı bu odada mı kontrol et
      if (!socket.rooms.has(roomName)) {
        socket.emit(EVENTS.ERROR, { message: 'Bu seansa katılmadınız' });
        return;
      }
      
      // Hedef kullanıcıyı bul
      const targetParticipant = activeSessionRooms[roomName]?.participants[targetUserId];
      
      if (!targetParticipant) {
        socket.emit(EVENTS.ERROR, { message: 'Hedef kullanıcı seansa bağlı değil' });
        return;
      }
      
      // Video cevabını hedef kullanıcıya ilet
      io.to(targetParticipant.socketId).emit(EVENTS.VIDEO_ANSWER, {
        from: socket.user,
        sdp
      });
      
      console.log(`${socket.user.id} kullanıcısından ${targetUserId} kullanıcısına video cevabı gönderildi`);
    });
    
    // WebRTC sinyalleşme: ICE adayı
    socket.on(EVENTS.NEW_ICE_CANDIDATE, ({ sessionId, targetUserId, candidate }) => {
      const roomName = `session_${sessionId}`;
      
      // Kullanıcı bu odada mı kontrol et
      if (!socket.rooms.has(roomName)) {
        socket.emit(EVENTS.ERROR, { message: 'Bu seansa katılmadınız' });
        return;
      }
      
      // Hedef kullanıcıyı bul
      const targetParticipant = activeSessionRooms[roomName]?.participants[targetUserId];
      
      if (!targetParticipant) {
        socket.emit(EVENTS.ERROR, { message: 'Hedef kullanıcı seansa bağlı değil' });
        return;
      }
      
      // ICE adayını hedef kullanıcıya ilet
      io.to(targetParticipant.socketId).emit(EVENTS.NEW_ICE_CANDIDATE, {
        from: socket.user,
        candidate
      });
    });
    
    // Bağlantı koptuğunda
    socket.on(EVENTS.DISCONNECT, () => {
      console.log(`Kullanıcı ayrıldı: ${socket.user.id}`);
      
      // Kullanıcıyı çevrimdışı yap
      delete onlineUsers[socket.user.id];
      
      // Kullanıcının çevrimdışı olduğunu bildirme
      io.emit(EVENTS.USER_OFFLINE, {
        userId: socket.user.id
      });
      
      // Kullanıcının katıldığı tüm aktif odalardan çıkar
      Object.keys(activeSessionRooms).forEach(roomName => {
        if (activeSessionRooms[roomName].participants[socket.user.id]) {
          delete activeSessionRooms[roomName].participants[socket.user.id];
          
          // Odada kimse kalmadıysa odayı kaldır
          if (Object.keys(activeSessionRooms[roomName].participants).length === 0) {
            delete activeSessionRooms[roomName];
          } else {
            // Odadaki diğer kullanıcılara bilgi ver
            socket.to(roomName).emit(EVENTS.SESSION_STATUS, {
              action: 'leave',
              userId: socket.user.id
            });
          }
        }
      });
    });
  });
};