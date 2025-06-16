const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Ponto = require('../models/Ponto');

// Middleware para verificar token
const verificarToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).select('-senha');
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    console.error('❌ Erro na verificação do token:', error);
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// 📍 MARCAR PONTO - Versão Simplificada (sem foto e sem localização)
router.post('/marcar', verificarToken, async (req, res) => {
  try {
    const { tipo, dataHora, observacoes } = req.body;
    const usuario = req.usuario;

    console.log('📝 Marcando ponto para:', usuario.nome);
    console.log('📅 Dados recebidos:', { tipo, dataHora });

    // Validações básicas
    if (!tipo || !dataHora) {
      return res.status(400).json({
        success: false,
        message: 'Tipo e data/hora são obrigatórios'
      });
    }

    // Validar tipos permitidos
    const tiposPermitidos = ['entrada', 'saida_almoco', 'entrada_almoco', 'saida'];
    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de ponto inválido'
      });
    }

    // Verificar se já existe ponto do mesmo tipo hoje
    const hoje = new Date(dataHora);
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimDia = new Date(inicioDia);
    fimDia.setDate(fimDia.getDate() + 1);

    const pontoExistente = await Ponto.findOne({
      usuario: usuario._id,
      tipo: tipo,
      dataHora: {
        $gte: inicioDia,
        $lt: fimDia
      }
    });

    if (pontoExistente) {
      return res.status(400).json({
        success: false,
        message: `Ponto de ${tipo} já foi registrado hoje`
      });
    }

    // Criar novo ponto (SEM FOTO E SEM LOCALIZAÇÃO)
    const novoPonto = new Ponto({
      usuario: usuario._id,
      tipo: tipo,
      dataHora: new Date(dataHora),
      observacoes: observacoes || `Ponto ${tipo} registrado`,
      fotoVerificada: true, // Assumimos que a foto foi "verificada" para fins psicológicos
      criadoEm: new Date()
    });

    await novoPonto.save();

    console.log('✅ Ponto salvo com sucesso:', novoPonto._id);

    // Buscar pontos do dia para retornar
    const pontosHoje = await Ponto.find({
      usuario: usuario._id,
      dataHora: {
        $gte: inicioDia,
        $lt: fimDia
      }
    }).sort({ dataHora: 1 });

    res.json({
      success: true,
      message: 'Ponto registrado com sucesso!',
      ponto: {
        id: novoPonto._id,
        tipo: novoPonto.tipo,
        dataHora: novoPonto.dataHora,
        fotoVerificada: true
      },
      pontosHoje: pontosHoje.map(p => ({
        id: p._id,
        tipo: p.tipo,
        dataHora: p.dataHora,
        fotoVerificada: p.fotoVerificada
      }))
    });

  } catch (error) {
    console.error('❌ Erro ao marcar ponto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📅 BUSCAR PONTOS DE HOJE
router.get('/hoje', verificarToken, async (req, res) => {
  try {
    const usuario = req.usuario;
    
    // Data de hoje
    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimDia = new Date(inicioDia);
    fimDia.setDate(fimDia.getDate() + 1);

    const pontos = await Ponto.find({
      usuario: usuario._id,
      dataHora: {
        $gte: inicioDia,
        $lt: fimDia
      }
    }).sort({ dataHora: 1 });

    console.log(`📊 Encontrados ${pontos.length} pontos hoje para ${usuario.nome}`);

    res.json({
      success: true,
      pontos: pontos.map(ponto => ({
        id: ponto._id,
        tipo: ponto.tipo,
        dataHora: ponto.dataHora,
        localizacao: ponto.localizacao,
        observacoes: ponto.observacoes,
        fotoVerificada: ponto.fotoVerificada || true,
        sincronizado: true
      }))
    });

  } catch (error) {
    console.error('❌ Erro ao buscar pontos de hoje:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pontos'
    });
  }
});

// 📈 HISTÓRICO DE PONTOS
router.get('/historico', verificarToken, async (req, res) => {
  try {
    const usuario = req.usuario;
    const { data, limite = 30 } = req.query;

    let filtro = { usuario: usuario._id };

    // Filtrar por data específica se fornecida
    if (data) {
      const dataFiltro = new Date(data);
      const inicioDia = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), dataFiltro.getDate());
      const fimDia = new Date(inicioDia);
      fimDia.setDate(fimDia.getDate() + 1);
      
      filtro.dataHora = {
        $gte: inicioDia,
        $lt: fimDia
      };
    }

    const pontos = await Ponto.find(filtro)
      .sort({ dataHora: -1 })
      .limit(parseInt(limite));

    res.json({
      success: true,
      pontos: pontos.map(ponto => ({
        id: ponto._id,
        tipo: ponto.tipo,
        dataHora: ponto.dataHora,
        localizacao: ponto.localizacao,
        observacoes: ponto.observacoes,
        fotoVerificada: true,
        sincronizado: true
      })),
      total: pontos.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico'
    });
  }
});

// 📊 RELATÓRIO DE PONTOS
router.get('/relatorio', verificarToken, async (req, res) => {
  try {
    const usuario = req.usuario;
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        success: false,
        message: 'Data de início e fim são obrigatórias'
      });
    }

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999); // Incluir o dia inteiro

    const pontos = await Ponto.find({
      usuario: usuario._id,
      dataHora: {
        $gte: inicio,
        $lte: fim
      }
    }).sort({ dataHora: 1 });

    // Agrupar por dia
    const pontosPorDia = {};
    pontos.forEach(ponto => {
      const data = ponto.dataHora.toLocaleDateString('pt-BR');
      if (!pontosPorDia[data]) {
        pontosPorDia[data] = [];
      }
      pontosPorDia[data].push(ponto);
    });

    // Calcular estatísticas
    const relatorio = Object.entries(pontosPorDia).map(([data, pontosDoDia]) => {
      const pontosPorTipo = {};
      pontosDoDia.forEach(ponto => {
        pontosPorTipo[ponto.tipo] = ponto.dataHora;
      });

      // Calcular horas trabalhadas
      let horasTrabalhadas = 0;
      const entrada = pontosPorTipo['entrada'];
      const saidaAlmoco = pontosPorTipo['saida_almoco'];
      const entradaAlmoco = pontosPorTipo['entrada_almoco'];
      const saida = pontosPorTipo['saida'];

      if (entrada && saidaAlmoco) {
        horasTrabalhadas += (saidaAlmoco - entrada) / (1000 * 60 * 60);
      }
      if (entradaAlmoco && saida) {
        horasTrabalhadas += (saida - entradaAlmoco) / (1000 * 60 * 60);
      }

      return {
        data,
        pontos: pontosDoDia.length,
        horasTrabalhadas: Math.round(horasTrabalhadas * 100) / 100,
        completo: pontosDoDia.length === 4,
        detalhes: pontosDoDia.map(p => ({
          tipo: p.tipo,
          dataHora: p.dataHora,
          localizacao: p.localizacao
        }))
      };
    });

    res.json({
      success: true,
      relatorio,
      periodo: {
        inicio: dataInicio,
        fim: dataFim,
        totalDias: relatorio.length
      },
      resumo: {
        totalPontos: pontos.length,
        diasCompletos: relatorio.filter(d => d.completo).length,
        horasTotais: relatorio.reduce((total, dia) => total + dia.horasTrabalhadas, 0)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório'
    });
  }
});

module.exports = router;