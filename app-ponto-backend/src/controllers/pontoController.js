const Ponto = require('../models/Ponto');
const { validarLocalizacaoEmpresa, validarHorarioTrabalho, validarSequenciaPonto } = require('../utils/validators');

// Marcar ponto
const marcarPonto = async (req, res) => {
  try {
    const { tipo, localizacao, foto, observacoes } = req.body;
    const usuario = req.user._id;

    // Validações básicas
    if (!tipo || !localizacao || !foto) {
      return res.status(400).json({
        success: false,
        message: 'Tipo, localização e foto são obrigatórios'
      });
    }

    if (!['entrada', 'saida_almoco', 'entrada_almoco', 'saida'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de ponto inválido'
      });
    }

    // Buscar pontos do dia atual
    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

    const pontosHoje = await Ponto.find({
      usuario,
      dataHora: { $gte: inicioDia, $lte: fimDia }
    }).sort({ dataHora: 1 });

    // Validar sequência de pontos
    const validacaoSequencia = validarSequenciaPonto(pontosHoje, tipo);
    if (!validacaoSequencia.valido) {
      return res.status(400).json({
        success: false,
        message: validacaoSequencia.motivo
      });
    }

    // Validar horário de trabalho
    const validacaoHorario = validarHorarioTrabalho(tipo);
    if (!validacaoHorario.valido) {
      return res.status(400).json({
        success: false,
        message: validacaoHorario.motivo,
        horarioAtual: validacaoHorario.horarioAtual
      });
    }

    // Validar localização da empresa
    const { latitude, longitude } = localizacao;
    const validacaoLocal = validarLocalizacaoEmpresa(latitude, longitude);

    // Criar registro do ponto
    const novoPonto = new Ponto({
      usuario,
      tipo,
      dataHora: new Date(),
      localizacao: {
        latitude,
        longitude,
        endereco: localizacao.endereco || '',
        dentroEmpresa: validacaoLocal.dentroEmpresa,
        distanciaEmpresa: validacaoLocal.distancia
      },
      foto,
      observacoes: observacoes || null,
      aprovado: validacaoLocal.dentroEmpresa // Auto-aprova se estiver na empresa
    });

    await novoPonto.save();

    // Buscar ponto com dados do usuário populados
    const pontoSalvo = await Ponto.findById(novoPonto._id)
      .populate('usuario', 'nome sobrenome email')
      .lean();

    res.status(201).json({
      success: true,
      message: `${tipo.replace('_', ' ')} marcada com sucesso!`,
      ponto: pontoSalvo,
      localizacao: {
        dentroEmpresa: validacaoLocal.dentroEmpresa,
        distancia: validacaoLocal.distancia
      }
    });

  } catch (error) {
    console.error('Erro ao marcar ponto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Buscar histórico de pontos
const buscarHistorico = async (req, res) => {
  try {
    const usuario = req.user._id;
    const { data, limite = 30 } = req.query;

    let filtro = { usuario };

    // Filtrar por data específica se fornecida
    if (data) {
      const dataFiltro = new Date(data);
      const inicioDia = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), dataFiltro.getDate());
      const fimDia = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth(), dataFiltro.getDate(), 23, 59, 59);
      
      filtro.dataHora = { $gte: inicioDia, $lte: fimDia };
    }

    const pontos = await Ponto.find(filtro)
      .sort({ dataHora: -1 })
      .limit(parseInt(limite))
      .populate('usuario', 'nome sobrenome')
      .lean();

    res.json({
      success: true,
      total: pontos.length,
      pontos
    });

  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Buscar pontos do dia atual
const buscarPontosHoje = async (req, res) => {
  try {
    const usuario = req.user._id;
    
    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

    const pontos = await Ponto.find({
      usuario,
      dataHora: { $gte: inicioDia, $lte: fimDia }
    }).sort({ dataHora: 1 });

    // Calcular horas trabalhadas
    const horasTrabalhadasMinutos = await Ponto.calcularHorasDia(usuario, hoje);
    const horas = Math.floor(horasTrabalhadasMinutos / 60);
    const minutos = horasTrabalhadasMinutos % 60;
    const horasFormatadas = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;

    // Determinar próximo ponto esperado
    const tiposMarcados = pontos.map(p => p.tipo);
    const sequencia = ['entrada', 'saida_almoco', 'entrada_almoco', 'saida'];
    const proximoPonto = sequencia.find(tipo => !tiposMarcados.includes(tipo));

    res.json({
      success: true,
      data: hoje.toISOString().split('T')[0],
      pontos,
      resumo: {
        totalPontos: pontos.length,
        horasTrabalhadas: horasFormatadas,
        proximoPonto: proximoPonto || null,
        diaCompleto: pontos.length === 4
      }
    });

  } catch (error) {
    console.error('Erro ao buscar pontos de hoje:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Relatório de horas trabalhadas
const relatorioHoras = async (req, res) => {
  try {
    const usuario = req.user._id;
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        success: false,
        message: 'Data de início e fim são obrigatórias'
      });
    }

    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);

    const pontos = await Ponto.find({
      usuario,
      dataHora: { $gte: inicio, $lte: fim }
    }).sort({ dataHora: 1 });

    // Agrupar por dia
    const diasTrabalhados = {};
    pontos.forEach(ponto => {
      const dia = ponto.dataHora.toISOString().split('T')[0];
      if (!diasTrabalhados[dia]) {
        diasTrabalhados[dia] = [];
      }
      diasTrabalhados[dia].push(ponto);
    });

    // Calcular horas por dia
    const relatorio = [];
    let totalMinutos = 0;

    for (const [dia, pontosDia] of Object.entries(diasTrabalhados)) {
      const minutosTrabalhadosNoDia = await Ponto.calcularHorasDia(usuario, new Date(dia));
      totalMinutos += minutosTrabalhadosNoDia;

      const horas = Math.floor(minutosTrabalhadosNoDia / 60);
      const minutos = minutosTrabalhadosNoDia % 60;

      relatorio.push({
        data: dia,
        pontos: pontosDia.length,
        horasTrabalhadas: `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`,
        completo: pontosDia.length === 4
      });
    }

    const totalHoras = Math.floor(totalMinutos / 60);
    const totalMinutosRestantes = totalMinutos % 60;

    res.json({
      success: true,
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },
      relatorio,
      totais: {
        diasTrabalhados: relatorio.length,
        horasTotais: `${totalHoras.toString().padStart(2, '0')}:${totalMinutosRestantes.toString().padStart(2, '0')}`
      }
    });

  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  marcarPonto,
  buscarHistorico,
  buscarPontosHoje,
  relatorioHoras
};