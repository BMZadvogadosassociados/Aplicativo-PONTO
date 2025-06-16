const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [50, 'Nome deve ter no máximo 50 caracteres']
  },
  sobrenome: {
    type: String,
    required: [true, 'Sobrenome é obrigatório'],
    trim: true,
    maxlength: [50, 'Sobrenome deve ter no máximo 50 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true, // Remove o index: true extra
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  cpf: {
    type: String,
    required: [true, 'CPF é obrigatório'],
    unique: true, // Remove o index: true extra
    trim: true,
    match: [/^\d{11}$/, 'CPF deve conter exatamente 11 dígitos']
  },
  senha: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres']
  },
  empresa: {
    type: String,
    default: 'BMZ Advogados',
    trim: true
  },
  cargo: {
    type: String,
    default: 'Funcionário',
    trim: true
  },
  ativo: {
    type: Boolean,
    default: true
  },
  foto: {
    type: String,
    default: null
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

// Remover os índices manuais já que unique: true já cria os índices
// usuarioSchema.index({ email: 1 });
// usuarioSchema.index({ cpf: 1 });

// Middleware para hash da senha antes de salvar
usuarioSchema.pre('save', async function(next) {
  // Só fazer hash se a senha foi modificada
  if (!this.isModified('senha')) return next();
  
  try {
    // Hash da senha com salt 12
    const salt = await bcrypt.genSalt(12);
    this.senha = await bcrypt.hash(this.senha, salt);
    this.atualizadoEm = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware para atualizar atualizadoEm em updates
usuarioSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ atualizadoEm: new Date() });
  next();
});

// Método para comparar senhas
usuarioSchema.methods.compararSenha = async function(senhaInformada) {
  try {
    return await bcrypt.compare(senhaInformada, this.senha);
  } catch (error) {
    throw new Error('Erro ao comparar senhas');
  }
};

// Método para formato JSON (remove senha)
usuarioSchema.methods.toJSON = function() {
  const usuario = this.toObject();
  delete usuario.senha;
  
  return {
    id: usuario._id,
    nome: usuario.nome,
    sobrenome: usuario.sobrenome,
    email: usuario.email,
    cpf: usuario.cpf,
    empresa: usuario.empresa,
    cargo: usuario.cargo,
    foto: usuario.foto,
    ativo: usuario.ativo,
    criadoEm: usuario.criadoEm
  };
};

// Método estático para buscar por CPF
usuarioSchema.statics.buscarPorCPF = function(cpf) {
  // Remove formatação do CPF
  const cpfLimpo = cpf.replace(/\D/g, '');
  return this.findOne({ cpf: cpfLimpo });
};

// Método estático para buscar por email
usuarioSchema.statics.buscarPorEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Método estático para validar CPF
usuarioSchema.statics.validarCPF = function(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '');
  
  if (cpfLimpo.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
  
  // Validação dos dígitos verificadores
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
  }
  
  let resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.charAt(9))) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
  }
  
  resto = 11 - (soma % 11);
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.charAt(10))) return false;
  
  return true;
};

module.exports = mongoose.model('Usuario', usuarioSchema);