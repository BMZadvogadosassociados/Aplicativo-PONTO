const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// Gerar token JWT
const gerarToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'chave-secreta-padrao', {
    expiresIn: '7d' // Token válido por 7 dias
  });
};

// 📝 CADASTRAR USUÁRIO
router.post('/cadastrar', async (req, res) => {
  try {
    const { nome, sobrenome, cpf, email, senha, empresa, cargo } = req.body;

    console.log('📝 Tentativa de cadastro para:', email);

    // Validações básicas
    if (!nome || !sobrenome || !cpf || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos obrigatórios devem ser preenchidos'
      });
    }

    // Limpar CPF (remover formatação)
    const cpfLimpo = cpf.replace(/\D/g, '');

    // Validar CPF
    if (!Usuario.validarCPF(cpfLimpo)) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido'
      });
    }

    // Verificar se usuário já existe (CPF)
    const usuarioCPFExistente = await Usuario.buscarPorCPF(cpfLimpo);
    if (usuarioCPFExistente) {
      return res.status(400).json({
        success: false,
        message: 'CPF já cadastrado no sistema'
      });
    }

    // Verificar se usuário já existe (Email)
    const usuarioEmailExistente = await Usuario.buscarPorEmail(email);
    if (usuarioEmailExistente) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado no sistema'
      });
    }

    // Criar novo usuário
    const novoUsuario = new Usuario({
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      cpf: cpfLimpo,
      email: email.toLowerCase().trim(),
      senha,
      empresa: empresa || 'BMZ Advogados',
      cargo: cargo || 'Funcionário'
    });

    await novoUsuario.save();

    console.log('✅ Usuário cadastrado com sucesso:', novoUsuario.email);

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      usuario: novoUsuario.toJSON()
    });

  } catch (error) {
    console.error('❌ Erro no cadastro:', error);
    
    // Tratamento de erros específicos do MongoDB
    if (error.code === 11000) {
      const campo = Object.keys(error.keyValue)[0];
      const valor = error.keyValue[campo];
      
      return res.status(400).json({
        success: false,
        message: `${campo === 'cpf' ? 'CPF' : 'Email'} já cadastrado: ${valor}`
      });
    }

    if (error.name === 'ValidationError') {
      const erros = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        erros
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔐 LOGIN
router.post('/login', async (req, res) => {
  try {
    const { cpf, senha } = req.body;

    console.log('🔐 Tentativa de login para CPF:', cpf.replace(/\d(?=\d{4})/g, '*'));

    // Validações básicas
    if (!cpf || !senha) {
      return res.status(400).json({
        success: false,
        message: 'CPF e senha são obrigatórios'
      });
    }

    // Limpar CPF
    const cpfLimpo = cpf.replace(/\D/g, '');

    // Buscar usuário por CPF
    const usuario = await Usuario.buscarPorCPF(cpfLimpo);
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'CPF não encontrado'
      });
    }

    // Verificar se usuário está ativo
    if (!usuario.ativo) {
      return res.status(401).json({
        success: false,
        message: 'Usuário desativado'
      });
    }

    // Verificar senha
    const senhaValida = await usuario.compararSenha(senha);
    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }

    // Gerar token
    const token = gerarToken(usuario._id);

    console.log('✅ Login realizado com sucesso para:', usuario.email);

    res.json({
      success: true,
      message: 'Login realizado com sucesso!',
      token,
      usuario: usuario.toJSON()
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔍 VERIFICAR TOKEN
router.get('/verificar', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Verificar e decodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chave-secreta-padrao');
    
    // Buscar usuário
    const usuario = await Usuario.findById(decoded.id).select('-senha');
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (!usuario.ativo) {
      return res.status(401).json({
        success: false,
        message: 'Usuário desativado'
      });
    }

    console.log('✅ Token verificado para:', usuario.email);

    res.json({
      success: true,
      message: 'Token válido',
      usuario: usuario.toJSON()
    });

  } catch (error) {
    console.error('❌ Erro na verificação do token:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// 🚪 LOGOUT (opcional - apenas limpa o token no cliente)
router.post('/logout', (req, res) => {
  console.log('🚪 Logout solicitado');
  
  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
});

// 👤 ATUALIZAR PERFIL
router.put('/perfil', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Verificar e decodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chave-secreta-padrao');
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const { nome, sobrenome, email } = req.body;

    console.log('👤 Atualizando perfil para:', usuario.email);

    // Validações básicas
    if (!nome || !sobrenome || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome, sobrenome e email são obrigatórios'
      });
    }

    // Verificar se o novo email já existe (se foi alterado)
    if (email.toLowerCase() !== usuario.email.toLowerCase()) {
      const emailExistente = await Usuario.buscarPorEmail(email);
      if (emailExistente) {
        return res.status(400).json({
          success: false,
          message: 'Este email já está sendo usado por outro usuário'
        });
      }
    }

    // Atualizar dados do usuário
    usuario.nome = nome.trim();
    usuario.sobrenome = sobrenome.trim();
    usuario.email = email.toLowerCase().trim();
    usuario.atualizadoEm = new Date();

    await usuario.save();

    console.log('✅ Perfil atualizado com sucesso para:', usuario.email);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso!',
      usuario: usuario.toJSON()
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar perfil:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (error.name === 'ValidationError') {
      const erros = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        erros
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🔒 ALTERAR SENHA
router.put('/senha', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Verificar e decodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chave-secreta-padrao');
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const { senhaAtual, novaSenha } = req.body;

    console.log('🔒 Alterando senha para:', usuario.email);

    // Validações básicas
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual e nova senha são obrigatórias'
      });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha deve ter pelo menos 6 caracteres'
      });
    }

    // Verificar senha atual
    const senhaAtualValida = await usuario.compararSenha(senhaAtual);
    if (!senhaAtualValida) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Verificar se a nova senha é diferente da atual
    const novaSenhaIgualAtual = await usuario.compararSenha(novaSenha);
    if (novaSenhaIgualAtual) {
      return res.status(400).json({
        success: false,
        message: 'A nova senha deve ser diferente da senha atual'
      });
    }

    // Atualizar senha
    usuario.senha = novaSenha; // O middleware do schema fará o hash automaticamente
    usuario.atualizadoEm = new Date();

    await usuario.save();

    console.log('✅ Senha alterada com sucesso para:', usuario.email);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro ao alterar senha:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 📊 OBTER ESTATÍSTICAS DO USUÁRIO
router.get('/estatisticas', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chave-secreta-padrao');
    const usuario = await Usuario.findById(decoded.id);
    
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Calcular estatísticas dos últimos 30 dias
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    
    const dataFim = new Date();

    // Buscar estatísticas usando o método do model Ponto
    const Ponto = require('../models/Ponto');
    const estatisticas = await Ponto.obterEstatisticasUsuario(usuario._id, dataInicio, dataFim);

    res.json({
      success: true,
      estatisticas: {
        ...estatisticas,
        periodo: {
          inicio: dataInicio.toISOString(),
          fim: dataFim.toISOString(),
          dias: 30
        },
        usuario: {
          nome: usuario.nome,
          empresa: usuario.empresa,
          criadoEm: usuario.criadoEm
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas'
    });
  }
});

module.exports = router;