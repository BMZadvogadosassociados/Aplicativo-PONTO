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

// ==================== MIDDLEWARE DE ADMIN ====================
const verificarAdmin = (req, res, next) => {
  // Verificar se é uma sessão admin (método simples)
  const adminToken = req.headers['admin-token'] || req.query.adminToken;
  
  if (adminToken === 'admin-bmz-2024') {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Acesso negado. Token administrativo requerido.'
    });
  }
};

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

console.log('⚙️ | Iniciando servidor...');

// Conectar ao MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== ROTA ESPECIAL PARA LET'S ENCRYPT ====================
// IMPORTANTE: Esta rota deve vir ANTES de qualquer outra rota
app.use('/.well-known', express.static('/var/www/html/.well-known'));

// Middleware para capturar IP real e informações do dispositivo
app.use((req, res, next) => {
  // Capturar IP real
  req.realIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] || 
               req.headers['cf-connecting-ip'] || // Cloudflare
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               req.ip ||
               'IP desconhecido';
  
  // Limpar IPv6 local para IPv4 se necessário
  if (req.realIP === '::1' || req.realIP === '::ffff:127.0.0.1') {
    req.realIP = '127.0.0.1 (local)';
  }

  // Capturar User-Agent e analisar dispositivo
  const userAgent = req.headers['user-agent'] || 'User-Agent desconhecido';
  req.deviceInfo = analisarDispositivo(userAgent);
  
  next();
});

// Função para analisar o User-Agent e extrair informações do dispositivo
function analisarDispositivo(userAgent) {
  const ua = userAgent.toLowerCase();
  
  let dispositivo = {
    sistema: 'Desconhecido',
    navegador: 'Desconhecido',
    dispositivo: 'Desconhecido',
    versao: '',
    mobile: false
  };

  // ==================== SISTEMAS OPERACIONAIS ====================
  // Windows
  if (ua.includes('windows nt 10.0')) {
    dispositivo.sistema = 'Windows 10/11';
  } else if (ua.includes('windows nt 6.3')) {
    dispositivo.sistema = 'Windows 8.1';
  } else if (ua.includes('windows nt 6.1')) {
    dispositivo.sistema = 'Windows 7';
  } else if (ua.includes('windows')) {
    dispositivo.sistema = 'Windows';
  }
  
  // macOS
  else if (ua.includes('mac os x')) {
    const macVersion = ua.match(/mac os x ([\d_]+)/);
    if (macVersion) {
      const version = macVersion[1].replace(/_/g, '.');
      dispositivo.sistema = `macOS ${version}`;
    } else {
      dispositivo.sistema = 'macOS';
    }
  }
  
  // iOS
  else if (ua.includes('iphone')) {
    dispositivo.mobile = true;
    dispositivo.dispositivo = 'iPhone';
    const iosVersion = ua.match(/os ([\d_]+)/);
    if (iosVersion) {
      dispositivo.sistema = `iOS ${iosVersion[1].replace(/_/g, '.')}`;
    } else {
      dispositivo.sistema = 'iOS';
    }
    
    // Detectar modelo do iPhone
    if (ua.includes('iphone14')) dispositivo.dispositivo = 'iPhone 14';
    else if (ua.includes('iphone13')) dispositivo.dispositivo = 'iPhone 13';
    else if (ua.includes('iphone12')) dispositivo.dispositivo = 'iPhone 12';
  }
  
  else if (ua.includes('ipad')) {
    dispositivo.mobile = true;
    dispositivo.dispositivo = 'iPad';
    const iosVersion = ua.match(/os ([\d_]+)/);
    if (iosVersion) {
      dispositivo.sistema = `iPadOS ${iosVersion[1].replace(/_/g, '.')}`;
    } else {
      dispositivo.sistema = 'iPadOS';
    }
  }
  
  // Android
  else if (ua.includes('android')) {
    dispositivo.mobile = true;
    dispositivo.sistema = 'Android';
    
    // Versão do Android
    const androidVersion = ua.match(/android ([\d.]+)/);
    if (androidVersion) {
      dispositivo.sistema = `Android ${androidVersion[1]}`;
    }
    
    // Modelos específicos
    if (ua.includes('samsung')) {
      dispositivo.dispositivo = 'Samsung';
      if (ua.includes('galaxy')) {
        if (ua.includes('s24')) dispositivo.dispositivo = 'Samsung Galaxy S24';
        else if (ua.includes('s23')) dispositivo.dispositivo = 'Samsung Galaxy S23';
        else if (ua.includes('s22')) dispositivo.dispositivo = 'Samsung Galaxy S22';
        else if (ua.includes('s21')) dispositivo.dispositivo = 'Samsung Galaxy S21';
        else dispositivo.dispositivo = 'Samsung Galaxy';
      }
    }
    else if (ua.includes('xiaomi')) {
      dispositivo.dispositivo = 'Xiaomi';
      if (ua.includes('redmi')) dispositivo.dispositivo = 'Xiaomi Redmi';
    }
    else if (ua.includes('huawei')) {
      dispositivo.dispositivo = 'Huawei';
    }
    else if (ua.includes('lg')) {
      dispositivo.dispositivo = 'LG';
    }
    else if (ua.includes('motorola') || ua.includes('moto')) {
      dispositivo.dispositivo = 'Motorola';
    }
    else {
      dispositivo.dispositivo = 'Android Device';
    }
  }
  
  // Linux
  else if (ua.includes('linux')) {
    dispositivo.sistema = 'Linux';
    if (ua.includes('ubuntu')) dispositivo.sistema = 'Ubuntu';
    else if (ua.includes('debian')) dispositivo.sistema = 'Debian';
    else if (ua.includes('fedora')) dispositivo.sistema = 'Fedora';
  }

  // ==================== NAVEGADORES ====================
  // Chrome
  if (ua.includes('chrome') && !ua.includes('edge') && !ua.includes('opr')) {
    dispositivo.navegador = 'Chrome';
    const chromeVersion = ua.match(/chrome\/([\d.]+)/);
    if (chromeVersion) {
      dispositivo.versao = chromeVersion[1].split('.')[0];
    }
  }
  // Firefox
  else if (ua.includes('firefox')) {
    dispositivo.navegador = 'Firefox';
    const firefoxVersion = ua.match(/firefox\/([\d.]+)/);
    if (firefoxVersion) {
      dispositivo.versao = firefoxVersion[1].split('.')[0];
    }
  }
  // Safari
  else if (ua.includes('safari') && !ua.includes('chrome')) {
    dispositivo.navegador = 'Safari';
    const safariVersion = ua.match(/version\/([\d.]+)/);
    if (safariVersion) {
      dispositivo.versao = safariVersion[1].split('.')[0];
    }
  }
  // Edge
  else if (ua.includes('edge')) {
    dispositivo.navegador = 'Edge';
    const edgeVersion = ua.match(/edge\/([\d.]+)/);
    if (edgeVersion) {
      dispositivo.versao = edgeVersion[1].split('.')[0];
    }
  }
  // Opera
  else if (ua.includes('opr') || ua.includes('opera')) {
    dispositivo.navegador = 'Opera';
    const operaVersion = ua.match(/(?:opr|opera)\/([\d.]+)/);
    if (operaVersion) {
      dispositivo.versao = operaVersion[1].split('.')[0];
    }
  }

  return dispositivo;
}

// Função para formatar informações do dispositivo
function formatarDispositivo(deviceInfo) {
  let info = [];
  
  // Sistema operacional
  if (deviceInfo.sistema !== 'Desconhecido') {
    info.push(deviceInfo.sistema);
  }
  
  // Dispositivo
  if (deviceInfo.dispositivo && deviceInfo.dispositivo !== 'Desconhecido') {
    info.push(deviceInfo.dispositivo);
  }
  
  // Navegador
  if (deviceInfo.navegador !== 'Desconhecido') {
    const browser = deviceInfo.versao ? 
      `${deviceInfo.navegador} ${deviceInfo.versao}` : 
      deviceInfo.navegador;
    info.push(browser);
  }
  
  // Indicar se é mobile
  if (deviceInfo.mobile) {
    info.push('📱 Mobile');
  } else {
    info.push('🖥️ Desktop');
  }
  
  return info.length > 0 ? info.join(' | ') : 'Dispositivo desconhecido';
}

// ==================== CERTIFICADOS SSL ====================
function criarCertificadoAutoassinado() {
  const certificadoPath = path.join(__dirname, 'certificados');
  const keyPath = path.join(certificadoPath, 'private-key.pem');
  const certPath = path.join(certificadoPath, 'certificate.pem');

  if (!fs.existsSync(certificadoPath)) {
    fs.mkdirSync(certificadoPath, { recursive: true });
    console.log('📁 Pasta certificados criada');
  }

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('🔒 Certificados SSL encontrados');
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }

  console.log('⚠️ ALERTA | Certificado SSL não foi encontrado no sistema.');

  return null;
}

// ==================== ROTAS BÁSICAS ====================

// Rota principal
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '💻 Servidor do App de Ponto BMZ ONLINE.',
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

// Rota de informações das rotas
app.get('/rotas', (req, res) => {
  res.json({
    success: true,
    message: "Backend BMZ funcionando!",
    rotas_disponiveis: [
      "✅ GET /health",
      "✅ GET /rotas", 
      "✅ POST /admin/login - Login administrativo",
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
      "🔧 GET /api/pontos/usuario/:cpf - Pontos de usuário específico (Admin)",
      "🖥️ GET /painel - Painel RH completo"
    ],
    protocolos: {
      http: `http://pontobmz.com (porta ${HTTP_PORT})`,
      https: `https://pontobmz.com (porta ${HTTPS_PORT}) 🔒`
    },
    versao: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// ==================== LOGIN ADMINISTRATIVO ====================
app.post('/admin/login', (req, res) => {
  try {
    const { login, senha } = req.body;
    const clientIP = req.realIP;
    const deviceInfo = formatarDispositivo(req.deviceInfo);

    console.log('🔐 Tentativa de login administrativo:', login);
    console.log('📱 Dispositivo:', deviceInfo);
    console.log('🌐 IP:', clientIP);

    if (!login || !senha) {
      console.log(`❌ ${clientIP} tentou login no painel - Campos obrigatórios não preenchidos`);
      console.log(`📱 Dispositivo: ${deviceInfo}`);
      return res.status(400).json({
        success: false,
        message: 'Login e senha são obrigatórios'
      });
    }

    // Credenciais administrativas
    const ADMIN_LOGIN = 'admin';
    const ADMIN_SENHA = 'Escritorio3116*!*!()';

    if (login === ADMIN_LOGIN && senha === ADMIN_SENHA) {
      console.log('✅ Login administrativo realizado com sucesso');
      console.log(`🌐 IP: ${clientIP}`);
      console.log(`📱 Dispositivo: ${deviceInfo}`);
      
      res.json({
        success: true,
        message: 'Login administrativo realizado com sucesso',
        adminToken: 'admin-bmz-2024',
        tipo: 'admin',
        nome: 'Administrador BMZ',
        permissoes: ['gerenciar_ajustes', 'visualizar_usuarios', 'gerar_relatorios']
      });
    } else {
      console.log(`❌ ${clientIP} tentou login no painel - Credenciais inválidas (Login: "${login}")`);
      console.log(`📱 Dispositivo: ${deviceInfo}`);
      
      res.status(401).json({
        success: false,
        message: 'Credenciais administrativas inválidas'
      });
    }

  } catch (error) {
    const clientIP = req.realIP || 'IP desconhecido';
    const deviceInfo = req.deviceInfo ? formatarDispositivo(req.deviceInfo) : 'Dispositivo desconhecido';
    
    console.error(`❌ ${clientIP} tentou login no painel - Erro interno:`, error);
    console.error(`📱 Dispositivo: ${deviceInfo}`);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Verificar token administrativo
app.get('/admin/verificar', (req, res) => {
  const adminToken = req.headers['admin-token'] || req.query.adminToken;
  
  if (adminToken === 'admin-bmz-2024') {
    res.json({
      success: true,
      message: 'Token administrativo válido',
      tipo: 'admin',
      nome: 'Administrador BMZ'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Token administrativo inválido'
    });
  }
});

// ==================== PAINEL RH ====================
app.get('/painel', async (req, res) => {
  const filePath = path.join(__dirname, 'public', 'painel.html');
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Painel RH - BMZ</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f4f4f8; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .error { color: #dc3545; font-size: 1.2rem; margin: 20px 0; }
          .login-form { text-align: left; margin-top: 30px; }
          .form-group { margin-bottom: 20px; }
          .form-label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
          .form-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; }
          .btn-login { background: #0052cc; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; }
          .btn-login:hover { background: #004099; }
          a { color: #0052cc; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏢 Painel RH - BMZ Advogados</h1>
          <div class="error">Arquivo painel.html não encontrado!</div>
          
          <div class="login-form">
            <h3>Login Administrativo</h3>
            <form onsubmit="fazerLogin(event)">
              <div class="form-group">
                <label class="form-label">Login:</label>
                <input type="text" class="form-input" id="loginInput" placeholder="Digite o login" required>
              </div>
              <div class="form-group">
                <label class="form-label">Senha:</label>
                <input type="password" class="form-input" id="senhaInput" placeholder="Digite a senha" required>
              </div>
              <button type="submit" class="btn-login">Entrar no Painel</button>
            </form>
          </div>
          
          <p style="margin-top: 30px;">
            <strong>Caminho esperado:</strong> ${filePath}<br>
            <a href="/rotas">← Ver todas as rotas</a>
          </p>
        </div>
        
        <script>
          async function fazerLogin(event) {
            event.preventDefault();
            
            const login = document.getElementById('loginInput').value;
            const senha = document.getElementById('senhaInput').value;
            
            try {
              const response = await fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, senha })
              });
              
              const data = await response.json();
              
              if (data.success) {
                alert('Login realizado com sucesso!');
                // Redirecionar para painel ou outra página
                window.location.href = '/painel?adminToken=' + data.adminToken;
              } else {
                alert('Erro: ' + data.message);
              }
            } catch (error) {
              alert('Erro de conexão: ' + error.message);
            }
          }
        </script>
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

// ==================== ROTAS IMPORTADAS ====================
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/pontos', require('./src/routes/pontos'));
app.use('/api/ajustes', require('./src/routes/ajustes'));

// ==================== ROTAS ADMINISTRATIVAS EXTRAS ====================
// Buscar todos os usuários (Admin)
app.get('/api/auth/admin/usuarios', verificarAdmin, async (req, res) => {
  try {
    console.log('👥 Admin solicitou lista de usuários');
    
    const usuarios = await Usuario.find().select('-senha').sort({ criadoEm: -1 });
    
    console.log('✅ Usuários encontrados:', usuarios.length);
    
    res.json({
      success: true,
      usuarios: usuarios,
      total: usuarios.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar usuários admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuários'
    });
  }
});

// Buscar todos os pontos (Admin)
app.get('/api/pontos/admin', verificarAdmin, async (req, res) => {
  try {
    
    
    const pontos = await Ponto.find().sort({ dataHora: -1 }).limit(1000);
    
    // Enriquecer pontos com dados do usuário
    const pontosComUsuario = await Promise.all(
      pontos.map(async (ponto) => {
        try {
          // Buscar dados do usuário pelo CPF
          const usuario = await Usuario.findOne({ cpf: ponto.cpf }).select('nome sobrenome email');
          
          return {
            ...ponto.toObject(),
            usuario: usuario
          };
        } catch (error) {
          console.error('❌ Erro ao buscar usuário do ponto:', error);
          return ponto.toObject();
        }
      })
    );
    
    console.log('✅ Pontos encontrados:', pontosComUsuario.length);
    
    res.json({
      success: true,
      pontos: pontosComUsuario,
      total: pontosComUsuario.length
    });
  } catch (error) {
    console.error('❌ Erro ao buscar pontos admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pontos'
    });
  }
});

// Buscar pontos de um usuário específico (Admin) - ROTA CORRIGIDA
app.get('/api/pontos/usuario/:cpf', verificarAdmin, async (req, res) => {
  try {
    const cpf = req.params.cpf;
  
    
    // Limpar CPF (remover formatação)
    const cpfLimpo = cpf.replace(/\D/g, '');
    console.log('🔍 CPF limpo:', cpfLimpo);
    
    // MÉTODO 1: Buscar usuário pelo CPF
    console.log('🔍 Buscando usuário com CPF:', cpfLimpo);
    const usuario = await Usuario.findOne({ cpf: cpfLimpo }).select('_id nome sobrenome email cpf');
    
    if (!usuario) {
      console.log('❌ Usuário não encontrado para CPF:', cpfLimpo);
      
      // Debug: listar alguns usuários para comparação
      const usuariosExemplo = await Usuario.find().select('nome cpf').limit(5);
      console.log('📋 Usuários de exemplo no banco:', usuariosExemplo);
      
      return res.status(404).json({
        success: false,
        message: `Usuário não encontrado para CPF: ${cpf}`,
        debug: {
          cpfBuscado: cpfLimpo,
          cpfOriginal: cpf,
          usuariosExemplo: usuariosExemplo
        }
      });
    }
    
    console.log('✅ Usuário encontrado:', {
      id: usuario._id,
      nome: usuario.nome,
      cpf: usuario.cpf
    });
    
    // MÉTODO 2: Buscar pontos usando múltiplas estratégias
    let pontos = [];
    
    // Estratégia 1: Buscar por ObjectId do usuário
    console.log('🔍 Estratégia 1: Buscando pontos por ObjectId do usuário');
    pontos = await Ponto.find({ usuario: usuario._id }).sort({ dataHora: -1 }).limit(500);
    console.log('📊 Pontos encontrados por ObjectId:', pontos.length);
    
    // Estratégia 2: Se não encontrou, buscar por CPF direto
    if (pontos.length === 0) {
      console.log('🔍 Estratégia 2: Buscando pontos por CPF direto');
      pontos = await Ponto.find({ cpf: cpfLimpo }).sort({ dataHora: -1 }).limit(500);
      console.log('📊 Pontos encontrados por CPF:', pontos.length);
    }
    
    // Estratégia 3: Se ainda não encontrou, buscar por CPF formatado
    if (pontos.length === 0) {
      console.log('🔍 Estratégia 3: Buscando pontos por CPF formatado');
      const cpfFormatado = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      pontos = await Ponto.find({ cpf: cpfFormatado }).sort({ dataHora: -1 }).limit(500);
      console.log('📊 Pontos encontrados por CPF formatado:', pontos.length);
    }
    
    // Debug: Se não encontrou pontos, investigar a estrutura
    if (pontos.length === 0) {
      console.log('⚠️ Nenhum ponto encontrado, investigando estrutura...');
      
      // Verificar alguns pontos existentes
      const pontosExemplo = await Ponto.find().limit(3);
      console.log('🔍 Estrutura de pontos de exemplo:', pontosExemplo.map(p => ({
        id: p._id,
        usuario: p.usuario,
        cpf: p.cpf,
        tipo: p.tipo,
        dataHora: p.dataHora
      })));
      
      // Verificar se existem pontos com usuário relacionado
      const pontosComUsuario = await Ponto.find({ usuario: { $exists: true } }).limit(3);
      console.log('🔍 Pontos com usuário:', pontosComUsuario.length);
      
      // Verificar se existem pontos com CPF
      const pontosComCpf = await Ponto.find({ cpf: { $exists: true } }).limit(3);
      console.log('🔍 Pontos com CPF:', pontosComCpf.length);
    }
    
    console.log('✅ Total de pontos encontrados:', pontos.length);
    
    res.json({
      success: true,
      pontos: pontos,
      usuario: usuario,
      total: pontos.length,
      debug: {
        usuarioEncontrado: true,
        pontosEncontrados: pontos.length,
        cpfBuscado: cpfLimpo,
        usuarioId: usuario._id
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar pontos do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar pontos do usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
    });
  }
});

// ==================== MIDDLEWARE DE ERRO ====================
// IMPORTANTE: O middleware de rotas não encontradas deve vir DEPOIS de todas as rotas
// MAS deve EXCLUIR as rotas do Let's Encrypt
app.use('*', (req, res, next) => {
  // Se for uma rota do Let's Encrypt, deixar passar
  if (req.originalUrl.startsWith('/.well-known/acme-challenge/')) {
    return next();
  }
  
  // Para todas as outras rotas não encontradas
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
  console.log('==================================');
  console.log('🌐 SERVIDOR EM HTTP INICIADO!');
  console.log('| Desenvolvido por Leonardo do T.I |')
  console.log('==================================');
  console.log(`🟢 HTTP rodando em: http://0.0.0.0:${HTTP_PORT}`);
  console.log(`🏠 Acesso local: http://192.168.88.163:${HTTP_PORT}`);
  console.log(`🌐 Acesso externo: http://pontobmz.com`);
});

// Tentar iniciar servidor HTTPS (porta 3001)
try {
  let sslOptions = criarCertificadoAutoassinado();

  if (!sslOptions) {
    console.error('⚠️ Certificados não encontrados. Continuando apenas com HTTP...');
  } else {
    const httpsServer = https.createServer(sslOptions, app);
    
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log('==================================');
      console.log('🔒 SERVIDOR EM HTTPS INICIADO!');
      console.log('==================================');
      console.log(`🟢 HTTPS rodando em: https://0.0.0.0:${HTTPS_PORT}`);
      console.log(`🏠 Acesso local: https://192.168.88.22:${HTTPS_PORT}`);
      console.log(`🌐 Acesso externo: https://pontobmz.com`);
      console.log(`🔑 Acesso ao painel administrativo: https://pontobmz.com/painel`);
      console.log('🔐 Login Administrativo no painel: admin / Escritorio3116*!*!()');
      console.log('==================================');
    });
  }
} catch (error) {
  console.error('❌ Erro ao iniciar HTTPS:', error.message);
  console.log('⚠️ Servidor rodando apenas em HTTP');
}