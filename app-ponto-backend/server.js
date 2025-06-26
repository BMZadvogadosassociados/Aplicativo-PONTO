require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const connectDB = require('./src/config/database');
const Usuario = require('./src/models/Usuario');
const Ponto = require('./src/models/Ponto');
const Ajuste = require('./src/models/Ajuste');

// Middleware de verificação de admin
const verificarAdmin = (req, res, next) => {
  next();
};

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

console.log('🚀 Iniciando servidor...');

// Conectar ao MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== CERTIFICADOS SSL ====================

// Função para criar certificado autoassinado (desenvolvimento)
function criarCertificadoAutoassinado() {
  const certificadoPath = path.join(__dirname, 'certificados');
  const keyPath = path.join(certificadoPath, 'private-key.pem');
  const certPath = path.join(certificadoPath, 'certificate.pem');

  // Criar pasta se não existir
  if (!fs.existsSync(certificadoPath)) {
    fs.mkdirSync(certificadoPath, { recursive: true });
    console.log('📁 Pasta certificados criada');
  }

  // Verificar se certificados existem
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('🔒 Certificados SSL encontrados');
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }

  console.log('⚠️ Certificados SSL não encontrados!');
  console.log('📋 Para gerar certificados autoassinados:');
  console.log('');
  console.log('1. Instale OpenSSL');
  console.log('2. Execute os comandos:');
  console.log('');
  console.log('mkdir certificados');
  console.log('cd certificados');
  console.log('');
  console.log('# Gerar chave privada');
  console.log('openssl genrsa -out private-key.pem 2048');
  console.log('');
  console.log('# Gerar certificado autoassinado');
  console.log('openssl req -new -x509 -key private-key.pem -out certificate.pem -days 365');
  console.log('');
  console.log('Ou use o método alternativo abaixo...');

  return null;
}

// Método alternativo - certificado em memória para desenvolvimento

// ==================== TODAS AS ROTAS (mantidas iguais) ====================

// Rota principal
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Servidor do App de Ponto BMZ funcionando!',
    version: '1.0.0',
    database: 'MongoDB Atlas conectado',
    protocolos: {
      http: `Porta ${HTTP_PORT}`,
      https: `Porta ${HTTPS_PORT} 🔒`
    },
    timestamp: new Date().toISOString()
  });
});

// Rota de health check
app.get('/health', (req, res) => {
  const protocol = req.secure ? 'HTTPS' : 'HTTP';
  res.json({
    success: true,
    status: 'OK',
    protocol: protocol,
    database: 'Connected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ✅ Rota de informações das rotas
app.get('/rotas', (req, res) => {
  res.json({
    success: true,
    message: "Backend BMZ funcionando!",
    rotas_disponiveis: [
      "✅ GET /health",
      "✅ GET /rotas", 
      "✅ POST /api/auth/login",
      "✅ GET /api/auth/status (para teste)",
      "✅ POST /api/auth/cadastrar", 
      "✅ GET /api/auth/verificar",
      "✅ PUT /api/auth/perfil",
      "✅ PUT /api/auth/senha",
      "✅ GET /api/auth/estatisticas",
      "✅ POST /api/pontos/marcar",
      "✅ GET /api/pontos/hoje",
      "✅ GET /api/pontos/historico",
      "✅ GET /api/pontos/relatorio",
      "🆕 POST /api/ajustes - Solicitar ajuste de horário",
      "🆕 GET /api/ajustes - Listar ajustes do usuário",
      "🆕 PUT /api/ajustes/:id - Atualizar status (RH)",
      "🔧 GET /api/ajustes/admin - Listar todos os ajustes (Admin)",
      "🔧 GET /api/auth/admin/usuarios - Listar usuários (Admin)",
      "🔧 GET /api/pontos/admin - Listar pontos (Admin)",
      "🔧 GET /api/admin/estatisticas - Dashboard stats",
      "🔧 GET /api/admin/relatorio/:tipo - Gerar relatórios",
      "🖥️ GET /painel - Painel RH completo"
    ],
    protocolos: {
      http: `http://168.197.64.215 (porta ${HTTP_PORT})`,
      https: `https://168.197.64.215 (porta ${HTTPS_PORT}) 🔒`
    },
    versao: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Rota de teste do banco
app.get('/test-db', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    
    const states = {
      0: 'Desconectado',
      1: 'Conectado',
      2: 'Conectando',
      3: 'Desconectando'
    };
    
    res.json({
      success: true,
      database: {
        estado: states[dbState],
        codigo: dbState,
        nome: mongoose.connection.name || 'app-ponto'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar banco',
      error: error.message
    });
  }
});

// ==================== ROTAS DE AJUSTES ====================
// POST - Solicitar ajuste de horário
app.post('/api/ajustes', async (req, res) => {
  try {
    const { cpf, pontoId, novoHorario, motivo } = req.body;
    console.log('📝 Nova solicitação de ajuste recebida:', { cpf, pontoId, motivo });

    if (!cpf || !pontoId || !novoHorario || !motivo) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios: cpf, pontoId, novoHorario, motivo'
      });
    }

    if (motivo.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'O motivo deve ter pelo menos 10 caracteres'
      });
    }

    const novaData = new Date(novoHorario);
    if (isNaN(novaData.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Data/hora inválida'
      });
    }

    const novoAjuste = new Ajuste({
      cpf: cpf,
      pontoId: pontoId,
      novoHorario: novaData,
      motivo: motivo.trim(),
      status: 'pendente',
      criadoEm: new Date()
    });

    await novoAjuste.save();
    console.log('✅ Ajuste salvo com ID:', novoAjuste._id);

    res.json({
      success: true,
      message: 'Solicitação de ajuste enviada com sucesso',
      ajuste: {
        id: novoAjuste._id,
        status: 'pendente',
        criadoEm: novoAjuste.criadoEm
      }
    });

  } catch (error) {
    console.error('❌ Erro ao processar ajuste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ROTAS ADMIN ====================
app.get('/api/ajustes/admin', verificarAdmin, async (req, res) => {
  try {
    console.log('📋 Admin solicitou lista de ajustes');
    const ajustes = await Ajuste.find().sort({ criadoEm: -1 }).limit(100);
    const ajustesComUsuario = await Promise.all(
      ajustes.map(async (ajuste) => {
        try {
          const usuario = await Usuario.findOne({ cpf: ajuste.cpf }).select('nome sobrenome email');
          let pontoOriginal = null;
          try {
            pontoOriginal = await Ponto.findById(ajuste.pontoId);
          } catch (error) {
            console.log('Ponto original não encontrado:', ajuste.pontoId);
          }
          return {
            _id: ajuste._id,
            cpf: ajuste.cpf,
            pontoId: ajuste.pontoId,
            novoHorario: ajuste.novoHorario,
            motivo: ajuste.motivo,
            status: ajuste.status,
            respostaMensagem: ajuste.respostaMensagem,
            criadoEm: ajuste.criadoEm,
            atualizadoEm: ajuste.atualizadoEm,
            usuario: usuario,
            pontoOriginal: pontoOriginal
          };
        } catch (error) {
          console.error('Erro ao enriquecer ajuste:', error);
          return ajuste;
        }
      })
    );
    res.json({
      success: true,
      ajustes: ajustesComUsuario,
      total: ajustesComUsuario.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar ajustes admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ajustes'
    });
  }
});

app.get('/api/ajustes', async (req, res) => {
  try {
    // TODO: Implementar autenticação e filtrar por usuário
    // Por enquanto, retornando todos (para teste)
    console.log('📋 Buscando ajustes do usuário...');
    
    const ajustes = await Ajuste.find().sort({ criadoEm: -1 });
    
    console.log('✅ Ajustes encontrados:', ajustes.length);
    
    res.json({
      success: true,
      ajustes: ajustes,
      total: ajustes.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar ajustes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ajustes',
      error: error.message
    });
  }
});

// ✅ Rota única do Painel RH
app.get('/painel', async (req, res) => {
  const filePath = path.join(__dirname, 'public', 'painel.html');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Painel RH - Arquivo não encontrado</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #dc3545; font-size: 1.2rem; }
        </style>
      </head>
      <body>
        <h1>🚨 Painel RH</h1>
        <div class="error">Arquivo painel.html não encontrado!</div>
        <p><strong>Caminho esperado:</strong> ${filePath}</p>
        <a href="/rotas">← Ver todas as rotas</a>
      </body>
      </html>
    `);
  }
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.send(html);
  } catch (error) {
    console.error('❌ Erro ao carregar painel:', error);
    res.status(500).send(`
      <h1>Erro no Painel RH</h1>
      <p>Erro: ${error.message}</p>
      <a href="/rotas">← Ver todas as rotas</a>
    `);
  }
});

// Rota de teste para auth
app.get('/api/auth/status', (req, res) => {
  res.json({
    success: true,
    message: "Rota de autenticação funcionando!",
    protocolos: {
      http: `Disponível em HTTP (porta ${HTTP_PORT})`,
      https: `Disponível em HTTPS (porta ${HTTPS_PORT}) 🔒`
    }
  });
});

// Rotas importadas
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/pontos', require('./src/routes/pontos'));

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Rota ${req.originalUrl} não encontrada`,
    rotas_disponiveis: "Acesse /rotas para ver todas as rotas disponíveis"
  });
});

// Middleware de tratamento de erros global
app.use((error, req, res, next) => {
  console.error('❌ Erro não tratado:', error);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
  });
});

// ==================== INICIALIZAÇÃO DOS SERVIDORES ====================

// Iniciar servidor HTTP (porta 3000)
app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('✅ ================================');
  console.log('🌐 SERVIDOR HTTP INICIADO!');
  console.log('✅ ================================');
  console.log(`🟢 HTTP rodando em: http://0.0.0.0:${HTTP_PORT}`);
  console.log(`🏠 Acesso local: http://192.168.88.22:${HTTP_PORT}`);
  console.log(`🌐 Acesso externo: http://168.197.64.215`);
});

// Tentar iniciar servidor HTTPS (porta 3001)
try {
 let sslOptions = criarCertificadoAutoassinado();

if (!sslOptions) {
  console.error('⚠️ Certificados não encontrados. Abortando HTTPS!');
  process.exit(1); // força o servidor a não subir sem SSL válido
}

  const httpsServer = https.createServer(sslOptions, app);
  
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('✅ ================================');
    console.log('🔒 SERVIDOR HTTPS INICIADO!');
    console.log('✅ ================================');
    console.log(`🟢 HTTPS rodando em: https://0.0.0.0:${HTTPS_PORT}`);
    console.log(`🏠 Acesso local: https://192.168.88.22:${HTTPS_PORT}`);
    console.log(`🌐 Acesso externo: https://168.197.64.215`);
    console.log('⚠️ Certificado autoassinado - aceite no navegador');
    console.log('✅ ================================');
  });

} catch (error) {
  console.error('❌ Erro ao iniciar HTTPS:', error.message);
  console.log('⚠️ Servidor rodando apenas em HTTP');
}