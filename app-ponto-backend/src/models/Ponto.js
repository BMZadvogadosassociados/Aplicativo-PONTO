const mongoose = require('mongoose');

const pontoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['entrada', 'saida_almoco', 'entrada_almoco', 'saida']
  },
  dataHora: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Localização removida - sistema simplificado
  // localizacao: {
  //   latitude: {
  //     type: Number,
  //     required: false
  //   },
  //   longitude: {
  //     type: Number,
  //     required: false
  //   },
  //   endereco: {
  //     type: String,
  //     required: false
  //   }
  // },
  observacoes: {
    type: String,
    required: false
  },
  // Campo para indicar que a foto foi "verificada" (sem salvar a foto)
  fotoVerificada: {
    type: Boolean,
    default: true
  },
  // Metadados úteis para auditoria
  dispositivoInfo: {
    plataforma: String,
    versaoApp: String,
    ip: String
  },
  criadoEm: {
    type: Date,
    default: Date.now
  },
  atualizadoEm: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Adiciona automaticamente createdAt e updatedAt
});

// Índices para melhorar performance
pontoSchema.index({ usuario: 1, dataHora: -1 });
pontoSchema.index({ usuario: 1, tipo: 1, dataHora: -1 });

// Middleware para atualizar atualizadoEm
pontoSchema.pre('save', function(next) {
  this.atualizadoEm = new Date();
  next();
});

// Método para formatar dados para o frontend (sem localização)
pontoSchema.methods.toJSON = function() {
  const ponto = this.toObject();
  
  return {
    id: ponto._id,
    tipo: ponto.tipo,
    dataHora: ponto.dataHora,
    observacoes: ponto.observacoes,
    fotoVerificada: ponto.fotoVerificada,
    sincronizado: true,
    criadoEm: ponto.criadoEm
  };
};

// Método estático para buscar pontos de hoje
pontoSchema.statics.buscarPontosHoje = function(usuarioId) {
  const hoje = new Date();
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(inicioDia);
  fimDia.setDate(fimDia.getDate() + 1);

  return this.find({
    usuario: usuarioId,
    dataHora: {
      $gte: inicioDia,
      $lt: fimDia
    }
  }).sort({ dataHora: 1 });
};

// Método estático para validar sequência de pontos
pontoSchema.statics.validarSequenciaPontos = async function(usuarioId, novoTipo) {
  const pontosHoje = await this.buscarPontosHoje(usuarioId);
  const tiposJaMarcados = pontosHoje.map(p => p.tipo);
  
  const sequenciaValida = ['entrada', 'saida_almoco', 'entrada_almoco', 'saida'];
  
  // Verificar se o tipo já foi marcado
  if (tiposJaMarcados.includes(novoTipo)) {
    return {
      valido: false,
      motivo: `Ponto de ${novoTipo} já foi registrado hoje`
    };
  }
  
  // Verificar sequência
  const proximoEsperado = sequenciaValida[tiposJaMarcados.length];
  if (novoTipo !== proximoEsperado) {
    return {
      valido: false,
      motivo: `Sequência inválida. Esperado: ${proximoEsperado}, recebido: ${novoTipo}`
    };
  }
  
  return {
    valido: true,
    proximoPonto: sequenciaValida[tiposJaMarcados.length + 1] || null
  };
};

// Método estático para calcular horas trabalhadas de um dia
pontoSchema.statics.calcularHorasTrabalhadasDia = function(pontosDoDia) {
  const pontosPorTipo = {};
  pontosDoDia.forEach(ponto => {
    pontosPorTipo[ponto.tipo] = ponto.dataHora;
  });

  const entrada = pontosPorTipo['entrada'];
  const saidaAlmoco = pontosPorTipo['saida_almoco'];
  const entradaAlmoco = pontosPorTipo['entrada_almoco'];
  const saida = pontosPorTipo['saida'];

  if (!entrada) return 0;

  let totalMinutos = 0;

  // Horas da manhã (entrada até saída para almoço)
  if (entrada && saidaAlmoco) {
    const diffManha = saidaAlmoco.getTime() - entrada.getTime();
    totalMinutos += Math.floor(diffManha / 60000);
  }

  // Horas da tarde (entrada pós-almoço até saída)
  if (entradaAlmoco && saida) {
    const diffTarde = saida.getTime() - entradaAlmoco.getTime();
    totalMinutos += Math.floor(diffTarde / 60000);
  }

  // Retornar em horas decimais
  return totalMinutos / 60;
};

// Método estático para obter estatísticas do usuário
pontoSchema.statics.obterEstatisticasUsuario = async function(usuarioId, dataInicio, dataFim) {
  const pontos = await this.find({
    usuario: usuarioId,
    dataHora: {
      $gte: new Date(dataInicio),
      $lte: new Date(dataFim)
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
  let totalHoras = 0;
  let diasCompletos = 0;
  const diasTrabalhados = Object.keys(pontosPorDia).length;

  Object.values(pontosPorDia).forEach(pontosDoDia => {
    const horasDoDia = this.calcularHorasTrabalhadasDia(pontosDoDia);
    totalHoras += horasDoDia;
    
    if (pontosDoDia.length === 4) {
      diasCompletos++;
    }
  });

  return {
    totalPontos: pontos.length,
    diasTrabalhados,
    diasCompletos,
    totalHoras: Math.round(totalHoras * 100) / 100,
    mediaHorasPorDia: diasTrabalhados > 0 ? Math.round((totalHoras / diasTrabalhados) * 100) / 100 : 0
  };
};

module.exports = mongoose.model('Ponto', pontoSchema);