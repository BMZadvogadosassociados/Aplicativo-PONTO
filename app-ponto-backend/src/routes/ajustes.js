const express = require('express');
const router = express.Router();
const Ajuste = require('../models/Ajuste');
const Usuario = require('../models/Usuario');
const Ponto = require('../models/Ponto');

// ==================== MIDDLEWARE DE ADMIN ====================
const verificarAdmin = (req, res, next) => {
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

// ==================== ROTAS DE AJUSTES ====================

// POST /api/ajustes - usuário solicita ajuste de ponto
router.post('/', async (req, res) => {
  try {
    const { cpf, pontoId, novoHorario, motivo } = req.body;
    
    console.log('📝 Nova solicitação de ajuste recebida:', { cpf, pontoId, motivo });

    // Validações básicas
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

    // Validar data
    const novaData = new Date(novoHorario);
    if (isNaN(novaData.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Data/hora inválida'
      });
    }

    // Criar novo ajuste
    const novoAjuste = new Ajuste({
      cpf: cpf.replace(/\D/g, ''), // Limpar CPF
      pontoId,
      novoHorario: novaData,
      motivo: motivo.trim(),
      status: 'pendente',
      criadoEm: new Date()
    });

    await novoAjuste.save();
    
    console.log('✅ Ajuste salvo com ID:', novoAjuste._id);

    res.status(201).json({
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

// GET /api/ajustes - Buscar ajustes do usuário (com autenticação básica)
router.get('/', async (req, res) => {
  try {
    console.log('📋 Buscando ajustes do usuário...');
    
    // TODO: Implementar filtro por usuário autenticado
    // Por enquanto, retornando todos para teste
    const ajustes = await Ajuste.find().sort({ criadoEm: -1 }).limit(100);
    
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

// PUT /api/ajustes/:id - Aprovar ou recusar ajuste (ADMIN)
router.put('/:id', verificarAdmin, async (req, res) => {
  try {
    const { status, respostaMensagem } = req.body;
    const ajusteId = req.params.id;
    
    console.log(`🔄 Admin atualizando ajuste ${ajusteId} para status: ${status}`);
    
    // Validações
    if (!['aprovado', 'rejeitado'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status deve ser "aprovado" ou "rejeitado"'
      });
    }

    // Atualizar ajuste
    const ajuste = await Ajuste.findByIdAndUpdate(
      ajusteId,
      {
        status: status,
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

    console.log('✅ Ajuste atualizado:', ajuste._id, 'Status:', status);

    res.json({
      success: true,
      message: `Ajuste ${status} com sucesso`,
      ajuste: ajuste
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar ajuste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/ajustes/admin - Buscar todos os ajustes com detalhes (ADMIN)
router.get('/admin', verificarAdmin, async (req, res) => {
  try {
    console.log('📋 Admin solicitou lista completa de ajustes');
    
    const ajustes = await Ajuste.find().sort({ criadoEm: -1 }).limit(200);
    
    // Enriquecer ajustes com dados do usuário e ponto original
    const ajustesComDetalhes = await Promise.all(
      ajustes.map(async (ajuste) => {
        try {
          // Buscar dados do usuário
          const usuario = await Usuario.findOne({ cpf: ajuste.cpf }).select('nome sobrenome email empresa');
          
          // Buscar ponto original
          let pontoOriginal = null;
          try {
            pontoOriginal = await Ponto.findById(ajuste.pontoId);
          } catch (error) {
            console.log('⚠️ Ponto original não encontrado:', ajuste.pontoId);
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
          console.error('❌ Erro ao enriquecer ajuste:', error);
          return ajuste;
        }
      })
    );
    
    console.log('✅ Ajustes admin carregados:', ajustesComDetalhes.length);
    
    res.json({
      success: true,
      ajustes: ajustesComDetalhes,
      total: ajustesComDetalhes.length,
      estatisticas: {
        pendentes: ajustesComDetalhes.filter(a => a.status === 'pendente').length,
        aprovados: ajustesComDetalhes.filter(a => a.status === 'aprovado').length,
        rejeitados: ajustesComDetalhes.filter(a => a.status === 'rejeitado').length
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar ajustes admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ajustes',
      error: error.message
    });
  }
});

// GET /api/ajustes/:id - Buscar ajuste específico por ID
router.get('/:id', async (req, res) => {
  try {
    const ajusteId = req.params.id;
    
    console.log('🔍 Buscando ajuste:', ajusteId);
    
    const ajuste = await Ajuste.findById(ajusteId);
    
    if (!ajuste) {
      return res.status(404).json({
        success: false,
        message: 'Ajuste não encontrado'
      });
    }
    
    // Buscar dados complementares
    const usuario = await Usuario.findOne({ cpf: ajuste.cpf }).select('nome sobrenome email');
    let pontoOriginal = null;
    
    try {
      pontoOriginal = await Ponto.findById(ajuste.pontoId);
    } catch (error) {
      console.log('⚠️ Ponto original não encontrado');
    }
    
    res.json({
      success: true,
      ajuste: {
        ...ajuste.toObject(),
        usuario,
        pontoOriginal
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar ajuste específico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ajuste',
      error: error.message
    });
  }
});

// DELETE /api/ajustes/:id - Cancelar ajuste (apenas se pendente)
router.delete('/:id', async (req, res) => {
  try {
    const ajusteId = req.params.id;
    
    console.log('🗑️ Tentativa de cancelar ajuste:', ajusteId);
    
    const ajuste = await Ajuste.findById(ajusteId);
    
    if (!ajuste) {
      return res.status(404).json({
        success: false,
        message: 'Ajuste não encontrado'
      });
    }
    
    if (ajuste.status !== 'pendente') {
      return res.status(400).json({
        success: false,
        message: 'Apenas ajustes pendentes podem ser cancelados'
      });
    }
    
    await Ajuste.findByIdAndDelete(ajusteId);
    
    console.log('✅ Ajuste cancelado:', ajusteId);
    
    res.json({
      success: true,
      message: 'Ajuste cancelado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao cancelar ajuste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar ajuste',
      error: error.message
    });
  }
});

// ==================== ESTATÍSTICAS ====================
// GET /api/ajustes/stats/resumo - Estatísticas resumidas
router.get('/stats/resumo', verificarAdmin, async (req, res) => {
  try {
    console.log('📊 Admin solicitou estatísticas de ajustes');
    
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioSemana = new Date(agora.setDate(agora.getDate() - agora.getDay()));
    
    const [
      totalAjustes,
      ajustesPendentes,
      ajustesAprovados,
      ajustesRejeitados,
      ajustesMes,
      ajustesSemana
    ] = await Promise.all([
      Ajuste.countDocuments(),
      Ajuste.countDocuments({ status: 'pendente' }),
      Ajuste.countDocuments({ status: 'aprovado' }),
      Ajuste.countDocuments({ status: 'rejeitado' }),
      Ajuste.countDocuments({ criadoEm: { $gte: inicioMes } }),
      Ajuste.countDocuments({ criadoEm: { $gte: inicioSemana } })
    ]);
    
    const stats = {
      total: totalAjustes,
      pendentes: ajustesPendentes,
      aprovados: ajustesAprovados,
      rejeitados: ajustesRejeitados,
      noMes: ajustesMes,
      naSemana: ajustesSemana,
      taxaAprovacao: totalAjustes > 0 ? ((ajustesAprovados / totalAjustes) * 100).toFixed(1) : 0
    };
    
    console.log('✅ Estatísticas calculadas:', stats);
    
    res.json({
      success: true,
      estatisticas: stats
    });
    
  } catch (error) {
    console.error('❌ Erro ao calcular estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular estatísticas',
      error: error.message
    });
  }
});

// ==================== VALIDAÇÕES E UTILITÁRIOS ====================
// Middleware para validar ObjectId
const validarObjectId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: 'ID do ajuste inválido'
    });
  }
  
  next();
};

// Aplicar validação em rotas que usam :id
router.put('/:id', validarObjectId, verificarAdmin, async (req, res) => {
  // Código já implementado acima permanece o mesmo
  try {
    const { status, respostaMensagem } = req.body;
    const ajusteId = req.params.id;
    
    console.log(`🔄 Admin atualizando ajuste ${ajusteId} para status: ${status}`);
    
    // Validações
    if (!['aprovado', 'rejeitado'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status deve ser "aprovado" ou "rejeitado"'
      });
    }

    // Atualizar ajuste
    const ajuste = await Ajuste.findByIdAndUpdate(
      ajusteId,
      {
        status: status,
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

    console.log('✅ Ajuste atualizado:', ajuste._id, 'Status:', status);

    res.json({
      success: true,
      message: `Ajuste ${status} com sucesso`,
      ajuste: ajuste
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar ajuste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// Rota para teste de conectividade
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rotas de ajustes funcionando corretamente!',
    timestamp: new Date().toISOString(),
    routes: [
      'POST /api/ajustes - Criar ajuste',
      'GET /api/ajustes - Listar ajustes',
      'GET /api/ajustes/admin - Listar todos (Admin)',
      'PUT /api/ajustes/:id - Aprovar/Rejeitar (Admin)',
      'GET /api/ajustes/:id - Buscar específico',
      'DELETE /api/ajustes/:id - Cancelar ajuste',
      'GET /api/ajustes/stats/resumo - Estatísticas (Admin)'
    ]
  });
});

module.exports = router;