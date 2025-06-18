require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const connectDB = require('./src/config/database');
const Usuario = require('./src/models/Usuario');
const Ponto = require('./src/models/Ponto');
const Ajuste = require('./src/models/Ajuste');

// Middleware de verificação de admin
const verificarAdmin = (req, res, next) => {
  // Por enquanto, permitir acesso direto
  // Depois você pode implementar autenticação de admin
  next();
};

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Iniciando servidor...');

// Conectar ao MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== ROTAS BÁSICAS ====================

// Rota principal
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Servidor do App de Ponto BMZ funcionando!',
    version: '1.0.0',
    database: 'MongoDB Atlas conectado',
    timestamp: new Date().toISOString()
  });
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
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
    ip_servidor: "192.168.88.99:3000",
    versao: "1.0.0",
    novas_funcionalidades: [
      "🔧 Atualização de perfil do usuário",
      "🔒 Alteração de senha",
      "📊 Estatísticas de pontos do usuário",
      "🖥️ Painel RH via navegador com dashboard completo",
      "⏱️ Sistema de ajustes de horário",
      "📱 Sincronização offline",
      "👥 Gestão de usuários (Admin)",
      "📊 Relatórios em tempo real",
      "📈 Dashboard com estatísticas",
      "🔄 Auto-refresh no painel"
    ],
    admin_features: [
      "👀 Visualizar todos os pontos de todos os usuários",
      "✅ Aprovar/Rejeitar solicitações de ajuste",
      "📊 Dashboard com estatísticas em tempo real",
      "👥 Gerenciar usuários cadastrados",
      "📈 Gerar relatórios em Excel/CSV",
      "🔍 Filtros avançados por data, usuário, status",
      "⏰ Monitoramento em tempo real"
    ],
    acesso_painel: {
      url: "http://192.168.88.181:3000/painel",
      descricao: "Painel web completo para RH e administração",
      recursos: [
        "Dashboard com estatísticas",
        "Gestão de solicitações de ajuste",
        "Visualização de pontos de todos os usuários",
        "Relatórios e exportações",
        "Interface responsiva"
      ]
    },
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

    // Validações
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

    // Verificar se a data é válida
    const novaData = new Date(novoHorario);
    if (isNaN(novaData.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Data/hora inválida'
      });
    }

    // Criar novo ajuste
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

// GET - Listar ajustes do usuário
app.get('/api/ajustes', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Decodificar token para obter dados do usuário
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id);

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Buscar ajustes do usuário
    const ajustes = await Ajuste.find({ cpf: usuario.cpf })
      .sort({ criadoEm: -1 })
      .limit(50);

    res.json({
      success: true,
      ajustes: ajustes.map(ajuste => ({
        id: ajuste._id,
        pontoId: ajuste.pontoId,
        novoHorario: ajuste.novoHorario,
        motivo: ajuste.motivo,
        status: ajuste.status,
        criadoEm: ajuste.criadoEm,
        respostaMensagem: ajuste.respostaMensagem
      }))
    });

  } catch (error) {
    console.error('❌ Erro ao buscar ajustes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ajustes'
    });
  }
});

// PUT - Atualizar status de ajuste (para RH)
app.put('/api/ajustes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, respostaMensagem } = req.body;

    if (!['aprovado', 'rejeitado'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status deve ser "aprovado" ou "rejeitado"'
      });
    }

    const ajuste = await Ajuste.findByIdAndUpdate(
      id,
      {
        status,
        respostaMensagem: respostaMensagem || '',
        atualizadoEm: new Date()
      },
      { new: true }
    );

    if (!ajuste) {
      return res.status(404).json({
        success: false,
        message: 'Ajuste não encontrado'
      });
    }

    console.log(`✅ Ajuste ${status}:`, ajuste._id);

    res.json({
      success: true,
      message: `Ajuste ${status} com sucesso`,
      ajuste: {
        id: ajuste._id,
        status: ajuste.status,
        respostaMensagem: ajuste.respostaMensagem
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar ajuste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar ajuste'
    });
  }
});

// ==================== ROTAS ADMIN ====================

// GET - Listar todos os ajustes (para admin)
app.get('/api/ajustes/admin', verificarAdmin, async (req, res) => {
  try {
    console.log('📋 Admin solicitou lista de ajustes');

    const ajustes = await Ajuste.find()
      .sort({ criadoEm: -1 })
      .limit(100);

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

// GET - Listar todos os usuários (para admin)
app.get('/api/auth/admin/usuarios', verificarAdmin, async (req, res) => {
  try {
    console.log('👥 Admin solicitou lista de usuários');

    const usuarios = await Usuario.find()
      .select('-senha')
      .sort({ criadoEm: -1 });

    res.json({
      success: true,
      usuarios: usuarios.map(usuario => ({
        _id: usuario._id,
        nome: usuario.nome,
        sobrenome: usuario.sobrenome,
        email: usuario.email,
        cpf: usuario.cpf,
        empresa: usuario.empresa,
        criadoEm: usuario.criadoEm,
        ultimoLogin: usuario.ultimoLogin || null
      })),
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

// GET - Listar todos os pontos (para admin)
app.get('/api/pontos/admin', verificarAdmin, async (req, res) => {
  try {
    console.log('📊 Admin solicitou lista de pontos');

    const { usuario, dataInicio, dataFim, limite = 100 } = req.query;

    let filtros = {};
    
    if (usuario) {
      filtros.usuario = usuario;
    }

    if (dataInicio || dataFim) {
      filtros.dataHora = {};
      if (dataInicio) filtros.dataHora.$gte = new Date(dataInicio);
      if (dataFim) filtros.dataHora.$lte = new Date(dataFim);
    }

    const pontos = await Ponto.find(filtros)
      .populate('usuario', 'nome sobrenome email cpf')
      .sort({ dataHora: -1 })
      .limit(parseInt(limite));

    res.json({
      success: true,
      pontos: pontos.map(ponto => ({
        _id: ponto._id,
        tipo: ponto.tipo,
        dataHora: ponto.dataHora,
        localizacao: ponto.localizacao,
        observacoes: ponto.observacoes,
        fotoVerificada: ponto.fotoVerificada,
        criadoEm: ponto.criadoEm,
        usuario: ponto.usuario ? {
          _id: ponto.usuario._id,
          nome: ponto.usuario.nome,
          sobrenome: ponto.usuario.sobrenome,
          email: ponto.usuario.email,
          cpf: ponto.usuario.cpf
        } : null
      })),
      total: pontos.length,
      filtros: filtros
    });

  } catch (error) {
    console.error('❌ Erro ao buscar pontos admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pontos'
    });
  }
});

// GET - Estatísticas do dashboard
app.get('/api/admin/estatisticas', verificarAdmin, async (req, res) => {
  try {
    console.log('📈 Admin solicitou estatísticas');

    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimDia = new Date(inicioDia);
    fimDia.setDate(fimDia.getDate() + 1);

    const totalUsuarios = await Usuario.countDocuments();
    const ajustesPendentes = await Ajuste.countDocuments({ status: 'pendente' });
    const pontosHoje = await Ponto.countDocuments({
      dataHora: { $gte: inicioDia, $lt: fimDia }
    });
    const problemas = await Ponto.countDocuments({
      fotoVerificada: { $ne: true }
    });

    const totalPontos = await Ponto.countDocuments();
    const totalAjustes = await Ajuste.countDocuments();

    res.json({
      success: true,
      estatisticas: {
        totalUsuarios,
        ajustesPendentes,
        pontosHoje,
        problemas,
        totalPontos,
        totalAjustes,
        dataAtualizacao: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas'
    });
  }
});

// GET - Gerar relatório
app.get('/api/admin/relatorio/:tipo', verificarAdmin, async (req, res) => {
  try {
    const { tipo } = req.params;
    const { dataInicio, dataFim, formato = 'json' } = req.query;

    console.log(`📄 Gerando relatório ${tipo} (${formato})`);

    let dados = [];

    if (tipo === 'pontos') {
      const filtros = {};
      if (dataInicio) filtros.dataHora = { $gte: new Date(dataInicio) };
      if (dataFim) filtros.dataHora = { ...filtros.dataHora, $lte: new Date(dataFim) };

      const pontos = await Ponto.find(filtros)
        .populate('usuario', 'nome sobrenome email cpf')
        .sort({ dataHora: -1 });

      dados = pontos.map(ponto => ({
        Data: new Date(ponto.dataHora).toLocaleDateString('pt-BR'),
        Hora: new Date(ponto.dataHora).toLocaleTimeString('pt-BR'),
        Usuario: ponto.usuario ? `${ponto.usuario.nome} ${ponto.usuario.sobrenome}` : 'N/A',
        CPF: ponto.usuario?.cpf || 'N/A',
        Tipo: ponto.tipo,
        Localizacao: ponto.localizacao?.endereco || 'N/A',
        Verificado: ponto.fotoVerificada ? 'Sim' : 'Não'
      }));
    } else if (tipo === 'ajustes') {
      const ajustes = await Ajuste.find().sort({ criadoEm: -1 });

      dados = await Promise.all(ajustes.map(async (ajuste) => {
        const usuario = await Usuario.findOne({ cpf: ajuste.cpf }).select('nome sobrenome');
        return {
          Data: new Date(ajuste.criadoEm).toLocaleDateString('pt-BR'),
          Usuario: usuario ? `${usuario.nome} ${usuario.sobrenome}` : ajuste.cpf,
          CPF: ajuste.cpf,
          NovoHorario: new Date(ajuste.novoHorario).toLocaleString('pt-BR'),
          Motivo: ajuste.motivo,
          Status: ajuste.status,
          Resposta: ajuste.respostaMensagem || ''
        };
      }));
    }

    if (formato === 'csv') {
      if (dados.length === 0) {
        return res.json({ success: false, message: 'Nenhum dado encontrado' });
      }

      const headers = Object.keys(dados[0]).join(',');
      const rows = dados.map(row => Object.values(row).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio_${tipo}_${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        dados,
        tipo,
        total: dados.length,
        geradoEm: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório'
    });
  }
});

// ==================== PAINEL RH ====================

// ✅ Rota única do Painel RH
app.get('/painel', async (req, res) => {
  const filePath = path.join(__dirname, 'public', 'painel.html');

  // Verificar se o arquivo existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Painel RH - Arquivo não encontrado</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #dc3545; font-size: 1.2rem; }
          .instructions { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>🚨 Painel RH</h1>
        <div class="error">Arquivo painel.html não encontrado!</div>
        <div class="instructions">
          <h3>Para configurar o painel:</h3>
          <ol>
            <li>Crie a pasta <code>public</code> na raiz do projeto</li>
            <li>Salve o arquivo <code>painel.html</code> dentro dela</li>
            <li>Reinicie o servidor</li>
          </ol>
        </div>
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

// ==================== ROTAS DE TESTE ====================

// Rota de teste para auth
app.get('/api/auth/status', (req, res) => {
  res.json({
    success: true,
    message: "Rota de autenticação funcionando!",
    rotas_auth: [
      "POST /api/auth/login - para fazer login",
      "POST /api/auth/cadastrar - para cadastrar",
      "GET /api/auth/verificar - verificar token",
      "PUT /api/auth/perfil - atualizar perfil",
      "PUT /api/auth/senha - alterar senha",
      "GET /api/auth/estatisticas - obter estatísticas"
    ]
  });
});

// ==================== ROTAS DA API ====================

// Rotas importadas
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/pontos', require('./src/routes/pontos'));

// ==================== MIDDLEWARES FINAIS ====================

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

// ==================== INICIALIZAÇÃO ====================

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🟢 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🧪 Teste do banco: http://localhost:${PORT}/test-db`);
  console.log(`📋 Rotas disponíveis: http://localhost:${PORT}/rotas`);
  console.log(`🖥️ Painel RH: http://localhost:${PORT}/painel`);
  console.log(`📱 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🆕 Sistema de ajustes implementado!`);
});

console.log('✅ Servidor configurado com todas as funcionalidades!');