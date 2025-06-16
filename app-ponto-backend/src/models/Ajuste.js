const mongoose = require('mongoose');

const ajusteSchema = new mongoose.Schema({
  cpf: {
    type: String,
    required: true,
    trim: true
  },
  pontoId: {
    type: String,
    required: true,
    trim: true
  },
  novoHorario: {
    type: Date,
    required: true
  },
  motivo: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pendente', 'aprovado', 'rejeitado'],
    default: 'pendente'
  },
  respostaMensagem: {
    type: String,
    trim: true,
    maxlength: 300,
    default: ''
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
  timestamps: false // Usando criadoEm e atualizadoEm personalizados
});

// Índices para otimizar consultas
ajusteSchema.index({ cpf: 1, criadoEm: -1 });
ajusteSchema.index({ status: 1, criadoEm: -1 });

// Middleware para atualizar atualizadoEm antes de salvar
ajusteSchema.pre('findOneAndUpdate', function() {
  this.set({ atualizadoEm: new Date() });
});

module.exports = mongoose.model('Ajuste', ajusteSchema);