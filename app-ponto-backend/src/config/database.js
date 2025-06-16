const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    
    // Configurações de conexão (versão corrigida)
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 segundos
      socketTimeoutMS: 45000, // 45 segundos
      maxPoolSize: 10, // Manter até 10 conexões socket
      // Removido bufferMaxEntries pois não é mais suportado
    };

    // String de conexão do MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/app-ponto';
    
    if (!mongoURI) {
      throw new Error('❌ MONGODB_URI não encontrada nas variáveis de ambiente');
    }

    console.log('🌐 Conectando em:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Oculta credenciais nos logs

    // Conectar ao MongoDB
    const conn = await mongoose.connect(mongoURI, options);

    console.log('🟢 MongoDB conectado com sucesso!');
    console.log('📍 Host:', conn.connection.host);
    console.log('💾 Database:', conn.connection.name);
    
    // Log de eventos de conexão
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose conectado ao MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Erro de conexão MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ Mongoose desconectado do MongoDB');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔴 Conexão MongoDB fechada devido ao encerramento da aplicação');
      process.exit(0);
    });

    return conn;

  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error.message);
    
    // Sugestões de solução baseadas no tipo de erro
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('💡 Sugestões:');
      console.log('   - Verifique se o MongoDB Atlas está configurado corretamente');
      console.log('   - Confirme a string de conexão no .env');
      console.log('   - Verifique se seu IP está na whitelist do MongoDB Atlas');
      console.log('   - Teste a conexão diretamente no MongoDB Compass');
    }
    
    if (error.message.includes('authentication failed')) {
      console.log('💡 Problema de autenticação:');
      console.log('   - Verifique usuário e senha na string de conexão');
      console.log('   - Confirme as credenciais no MongoDB Atlas');
    }

    // Em desenvolvimento, não fechar o processo para permitir hot reload
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 Tentando novamente em 5 segundos...');
      setTimeout(connectDB, 5000);
    } else {
      process.exit(1);
    }
  }
};

// Função para verificar status da conexão
const getConnectionStatus = () => {
  const states = {
    0: 'Desconectado',
    1: 'Conectado',
    2: 'Conectando',
    3: 'Desconectando'
  };
  
  return {
    estado: states[mongoose.connection.readyState],
    codigo: mongoose.connection.readyState,
    host: mongoose.connection.host,
    database: mongoose.connection.name
  };
};

module.exports = connectDB;
module.exports.getConnectionStatus = getConnectionStatus;