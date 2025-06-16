const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Pegar token do header Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token não fornecido ou formato inválido' 
      });
    }

    // Extrair token (remover "Bearer ")
    const token = authHeader.substring(7);

    // Verificar e decodificar token
    const decoded = verifyToken(token);
    
    // Buscar usuário no banco
    const user = await User.findById(decoded.id);
    
    if (!user || !user.ativo) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não encontrado ou inativo' 
      });
    }

    // Adicionar usuário ao request
    req.user = user;
    next();

  } catch (error) {
    console.error('Erro na autenticação:', error.message);
    
    // Diferentes tipos de erro do JWT
    if (error.message === 'Token inválido' || error.name === 'JsonWebTokenError') {
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
      message: 'Erro na verificação do token' 
    });
  }
};

module.exports = auth;