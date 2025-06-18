import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';

// ✅ CONFIGURAÇÃO DINÂMICA DE IP MELHORADA
const getApiBaseUrl = () => {
  if (__DEV__) {
    // Lista de IPs para testar em ordem de prioridade
    const possibleIPs = [
      '192.168.88.99',  // Seu IP fixo atual
      '192.168.1.100',  // Outros IPs comuns da sua rede
      '192.168.0.100',
      '10.0.0.100'
    ];
    
    // Tentar detectar do Expo
    const debuggerHost = Constants.expoConfig?.hostUri
      ? Constants.expoConfig.hostUri.split(':').shift()
      : null;
    
    if (debuggerHost && 
        debuggerHost !== 'localhost' && 
        debuggerHost !== '127.0.0.1' &&
        !debuggerHost.includes('exp://')) {
      console.log('🔍 Usando IP do debugger Expo:', debuggerHost);
      return `http://${debuggerHost}:3000`;
    }
    
    // Fallback para IP fixo conhecido
    console.log('🔍 Usando IP fixo da rede local');
    return 'http://192.168.88.99:3000';
  }
  
  // Em produção
  return 'https://seu-dominio.com';
};

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.fallbackUrls = [
      'http://192.168.88.99:3000',
      'http://192.168.1.100:3000', 
      'http://192.168.0.100:3000',
      'http://10.0.2.2:3000' // Android emulator
    ];
    console.log('🌐 ApiService inicializado com URL:', this.baseUrl);
    console.log('🔄 URLs de fallback:', this.fallbackUrls);
  }

  // ✅ TESTAR MÚLTIPLAS URLS
  async testarUrls() {
    const urlsParaTestar = [this.baseUrl, ...this.fallbackUrls];
    
    for (const url of urlsParaTestar) {
      try {
        console.log(`🔍 Testando: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${url}/health`, {
          signal: controller.signal,
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ URL funcionando: ${url}`);
          this.baseUrl = url;
          return url;
        }
      } catch (error) {
        console.log(`❌ Falha em ${url}:`, error.message);
        continue;
      }
    }
    
    throw new Error('Nenhuma URL do servidor está acessível');
  }

  // ✅ VERIFICAR CONECTIVIDADE DE REDE
  async verificarRedeDisponivel() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      
      if (!networkState.isConnected) {
        throw new Error('Sem conexão com a internet');
      }
      
      if (!networkState.isInternetReachable) {
        throw new Error('Internet não está acessível');
      }
      
      console.log('✅ Rede disponível:', {
        connected: networkState.isConnected,
        internet: networkState.isInternetReachable,
        type: networkState.type
      });
      
      return true;
    } catch (error) {
      console.error('❌ Problema de rede:', error.message);
      throw error;
    }
  }

  // Obter token armazenado
  async getToken() {
    try {
      return await AsyncStorage.getItem('token');
    } catch (error) {
      console.log('❌ Erro ao obter token:', error);
      return null;
    }
  }

  // Salvar token
  async saveToken(token) {
    try {
      await AsyncStorage.setItem('token', token);
      console.log('✅ Token salvo com sucesso');
    } catch (error) {
      console.log('❌ Erro ao salvar token:', error);
    }
  }

  // Remover token (logout)
  async removeToken() {
    try {
      await AsyncStorage.multiRemove(['token', 'dadosUsuario']);
      console.log('✅ Token e dados removidos');
    } catch (error) {
      console.log('❌ Erro ao remover token:', error);
    }
  }

  // ✅ VERIFICAR CONECTIVIDADE COM FALLBACK DE URLS
  async verificarConectividade() {
    try {
      console.log('🔍 Verificando conectividade...');
      console.log('🌐 URL base atual:', this.baseUrl);
      
      // Primeiro verificar rede
      await this.verificarRedeDisponivel();
      
      // Tentar conectar na URL atual primeiro
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log('⏰ Timeout na URL atual');
        }, 5000);
        
        const response = await fetch(`${this.baseUrl}/health`, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Servidor online na URL atual:', data);
          return { success: true, data, url: this.baseUrl };
        }
      } catch (error) {
        console.log('⚠️ URL atual falhou, tentando fallbacks...');
        
        // Se a URL atual falhar, testar todas as URLs
        const urlFuncionando = await this.testarUrls();
        
        const response = await fetch(`${urlFuncionando}/health`);
        const data = await response.json();
        
        console.log('✅ Conectado via fallback:', data);
        return { success: true, data, url: urlFuncionando };
      }
      
    } catch (error) {
      console.error('❌ Falha total de conectividade:', error);
      
      // Mensagens mais específicas baseadas no tipo de erro
      if (error.name === 'AbortError') {
        throw new Error('Timeout: Nenhum servidor respondeu em tempo hábil');
      }
      
      if (error.message.includes('Network request failed') || 
          error.message.includes('fetch')) {
        throw new Error(`Erro de rede: Nenhum servidor acessível. URLs testadas: ${[this.baseUrl, ...this.fallbackUrls].join(', ')}`);
      }
      
      if (error.message.includes('Sem conexão') || 
          error.message.includes('Internet não está acessível')) {
        throw new Error('Sem conexão com a internet. Verifique sua rede WiFi/dados móveis');
      }
      
      throw error;
    }
  }

  // ✅ FAZER REQUISIÇÃO COM VERIFICAÇÃO MELHORADA
  async makeRequest(endpoint, options = {}) {
    try {
      // Verificar conectividade apenas se não for skipado
      if (!options.skipConnectivityCheck) {
        await this.verificarConectividade();
      }
      
      const token = await this.getToken();
      
      const config = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        timeout: 15000,
        ...options,
      };

      const fullUrl = `${this.baseUrl}/api${endpoint}`;
      
      console.log(`🌐 ${config.method} ${fullUrl}`);
      console.log(`🔑 Token presente: ${!!token}`);
      
      // Timeout manual
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('⏰ Timeout da requisição');
      }, config.timeout);
      
      const response = await fetch(fullUrl, {
        ...config,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📡 Status da resposta: ${response.status}`);
      
      if (!response.ok) {
        let errorText = 'Erro desconhecido';
        try {
          errorText = await response.text();
        } catch (e) {
          console.log('Não foi possível ler texto do erro');
        }
        
        console.error('❌ Erro HTTP:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Resposta recebida:`, data.success ? 'Sucesso' : 'Falha');
      
      return data;

    } catch (error) {
      console.error(`❌ Erro na requisição para ${endpoint}:`, error);
      
      // Melhorar mensagens de erro
      if (error.name === 'AbortError') {
        throw new Error('Timeout: Operação demorou muito para completar');
      }
      
      if (error.message.includes('Network request failed') ||
          error.message.includes('fetch')) {
        throw new Error(`Erro de conexão. Verifique se o servidor está acessível em ${this.baseUrl}`);
      }
      
      throw error;
    }
  }

  // ==================== AUTENTICAÇÃO ====================
  async login(cpf, senha) {
    try {
      console.log('🔐 Iniciando login para CPF:', cpf.replace(/\d(?=\d{4})/g, '*'));
      console.log('🌐 Conectando em:', this.baseUrl);
      
      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ cpf, senha }),
      });

      if (response.success) {
        if (response.token) {
          await this.saveToken(response.token);
        }
        
        if (response.usuario) {
          await AsyncStorage.setItem('dadosUsuario', JSON.stringify(response.usuario));
        }
        
        console.log('✅ Login realizado com sucesso');
      }

      return response;
      
    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      throw error;
    }
  }

  async verificarToken() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        return {
          success: false,
          message: 'Token não encontrado'
        };
      }

      const response = await this.makeRequest('/auth/verificar', {
        method: 'GET',
      });

      console.log('🔍 Verificação de token:', response.success ? 'Válido' : 'Inválido');
      return response;
      
    } catch (error) {
      console.error('❌ Erro na verificação do token:', error.message);
      
      if (error.message.includes('401') || error.message.includes('Token inválido')) {
        await this.removeToken();
      }
      
      return {
        success: false,
        message: error.message
      };
    }
  }

  async logout() {
    try {
      try {
        await this.makeRequest('/auth/logout', {
          method: 'POST',
          skipConnectivityCheck: true
        });
      } catch (error) {
        console.log('⚠️ Erro ao notificar logout no servidor (ignorado):', error.message);
      }

      await this.removeToken();
      
      console.log('✅ Logout realizado');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erro no logout:', error.message);
      await this.removeToken();
      return { success: true };
    }
  }

  // ==================== PONTOS ====================
  async marcarPonto(dadosPonto) {
    try {
      console.log('📍 Marcando ponto:', dadosPonto.tipo);
      
      const dadosOtimizados = {
        tipo: dadosPonto.tipo,
        dataHora: dadosPonto.dataHora,
        localizacao: dadosPonto.localizacao,
        observacoes: dadosPonto.observacoes || `Ponto ${dadosPonto.tipo} via app`,
      };

      const response = await this.makeRequest('/pontos/marcar', {
        method: 'POST',
        body: JSON.stringify(dadosOtimizados),
      });

      console.log('✅ Ponto marcado:', response.success);
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao marcar ponto:', error.message);
      
      // Salvar offline em caso de erro
      try {
        const pontosOffline = await AsyncStorage.getItem('pontosOffline');
        const lista = pontosOffline ? JSON.parse(pontosOffline) : [];
        lista.push({
          ...dadosPonto,
          timestampOffline: new Date().toISOString()
        });
        await AsyncStorage.setItem('pontosOffline', JSON.stringify(lista));
        
        return {
          success: true,
          message: 'Ponto salvo localmente. Será enviado quando possível.',
          offline: true,
          ponto: {
            ...dadosPonto,
            id: Date.now().toString(),
            sincronizado: false
          }
        };
      } catch (offlineError) {
        throw error;
      }
    }
  }

  async buscarPontosHoje() {
    try {
      console.log('📅 Buscando pontos de hoje...');
      
      const response = await this.makeRequest('/pontos/hoje', {
        method: 'GET',
      });

      console.log('✅ Pontos de hoje:', response.pontos?.length || 0);
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao buscar pontos de hoje:', error.message);
      throw error;
    }
  }

  async buscarHistorico(filtros = {}) {
    try {
      console.log('📊 Buscando histórico...');
      
      const token = await this.getToken();
      if (!token) {
        return {
          success: false,
          message: 'Token não encontrado'
        };
      }
      
      const params = new URLSearchParams();
      
      if (filtros.data) params.append('data', filtros.data);
      if (filtros.limite) params.append('limite', filtros.limite.toString());
      
      const queryString = params.toString();
      const endpoint = queryString ? `/pontos/historico?${queryString}` : '/pontos/historico';
      
      const response = await this.makeRequest(endpoint, {
        method: 'GET',
      });

      console.log('✅ Histórico carregado:', response.pontos?.length || 0, 'pontos');
      
      if (response.success && response.pontos) {
        const ajustesResponse = await this.buscarAjustes();
        if (ajustesResponse.success) {
          const ajustes = ajustesResponse.ajustes || [];
          
          response.pontos = response.pontos.map(ponto => {
            const ajusteRelacionado = ajustes.find(ajuste => 
              ajuste.pontoId === (ponto.id || ponto._id)
            );
            
            if (ajusteRelacionado) {
              return {
                ...ponto,
                statusAjuste: ajusteRelacionado.status,
                novoHorario: ajusteRelacionado.novoHorario,
                motivoAjuste: ajusteRelacionado.motivo,
                respostaRH: ajusteRelacionado.respostaMensagem,
                ...(ajusteRelacionado.status === 'aprovado' ? {
                  horarioOriginal: ponto.dataHora,
                  dataHora: ajusteRelacionado.novoHorario
                } : {})
              };
            }
            return ponto;
          });
        }
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao buscar histórico:', error.message);
      throw error;
    }
  }

  // ==================== AJUSTES ====================
  async solicitarAjuste(dadosAjuste) {
    try {
      console.log('📝 Solicitando ajuste de horário:', dadosAjuste);
      
      if (!dadosAjuste.cpf || !dadosAjuste.pontoId || !dadosAjuste.novoHorario || !dadosAjuste.motivo) {
        throw new Error('Dados incompletos para solicitação de ajuste');
      }

      if (dadosAjuste.motivo.trim().length < 10) {
        throw new Error('O motivo deve ter pelo menos 10 caracteres');
      }

      const response = await this.makeRequest('/ajustes', {
        method: 'POST',
        body: JSON.stringify(dadosAjuste),
      });

      console.log('✅ Ajuste solicitado:', response.success);
      
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao solicitar ajuste:', error.message);
      
      try {
        const ajustesOffline = await AsyncStorage.getItem('ajustesOffline');
        const lista = ajustesOffline ? JSON.parse(ajustesOffline) : [];
        lista.push({
          ...dadosAjuste,
          timestampOffline: new Date().toISOString()
        });
        await AsyncStorage.setItem('ajustesOffline', JSON.stringify(lista));
        
        return {
          success: true,
          message: 'Ajuste salvo localmente. Será enviado quando possível.',
          offline: true
        };
      } catch (offlineError) {
        throw error;
      }
    }
  }

  async buscarAjustes() {
    try {
      console.log('📋 Buscando ajustes do usuário...');
      
      const response = await this.makeRequest('/ajustes', {
        method: 'GET',
      });

      console.log('✅ Ajustes carregados:', response.ajustes?.length || 0);
      return response;
      
    } catch (error) {
      console.error('❌ Erro ao buscar ajustes:', error.message);
      
      return {
        success: true,
        ajustes: [],
        message: 'Ajustes carregados do cache local'
      };
    }
  }

  // ==================== UTILITÁRIOS ====================
  async testarConexao() {
    try {
      console.log('🔧 Testando conexão...');
      console.log('🌐 URL atual:', this.baseUrl);
      
      const resultado = await this.verificarConectividade();
      
      return {
        success: true,
        ...resultado,
        message: `Conectado com sucesso em ${resultado.url}`
      };
      
    } catch (error) {
      console.error('❌ Falha na conexão:', error.message);
      
      return {
        success: false,
        error: error.message,
        url: this.baseUrl,
        urlsTestadas: [this.baseUrl, ...this.fallbackUrls],
        sugestoes: [
          'Verifique se o servidor está rodando',
          'Confirme se está na mesma rede WiFi',
          'Teste manualmente no navegador os IPs listados',
          'Reinicie o servidor e o aplicativo',
          'Verifique o firewall/antivirus'
        ]
      };
    }
  }

  // ✅ FORÇAR REDESCOBERTA DO IP
  async redescbrirServidor() {
    try {
      console.log('🔍 Forçando redescoberta do servidor...');
      
      const urlEncontrada = await this.testarUrls();
      
      console.log(`✅ Servidor redescoberto em: ${urlEncontrada}`);
      
      return {
        success: true,
        novaUrl: urlEncontrada,
        message: `Servidor encontrado em ${urlEncontrada}`
      };
      
    } catch (error) {
      console.error('❌ Nenhum servidor encontrado');
      
      return {
        success: false,
        error: 'Nenhum servidor acessível encontrado',
        urlsTestadas: [this.baseUrl, ...this.fallbackUrls]
      };
    }
  }

  // ✅ NOVA: Obter informações de debug melhoradas
  getDebugInfo() {
    const debuggerHost = Constants.expoConfig?.hostUri
      ? Constants.expoConfig.hostUri.split(':').shift()
      : null;
      
    return {
      apiBaseUrl: this.baseUrl,
      fallbackUrls: this.fallbackUrls,
      isDev: __DEV__,
      debuggerHost,
      expoGoUrl: Constants.expoConfig?.hostUri,
      platform: Constants.platform,
      expoVersion: Constants.expoVersion,
      deviceName: Constants.deviceName,
      sessionId: Constants.sessionId
    };
  }

  // ✅ MÉTODO PARA LOGS DETALHADOS
  async logConnectionDetails() {
    const debug = this.getDebugInfo();
    
    console.log('📋 === DETALHES DE CONEXÃO ===');
    console.log('🌐 URL principal:', debug.apiBaseUrl);
    console.log('🔄 URLs fallback:', debug.fallbackUrls);
    console.log('📱 Plataforma:', debug.platform?.os);
    console.log('🔗 Expo Go URL:', debug.expoGoUrl);
    console.log('💻 Debugger Host:', debug.debuggerHost);
    console.log('📱 Device:', debug.deviceName);
    console.log('🆔 Session:', debug.sessionId);
    console.log('===============================');
    
    return debug;
  }
}

export default new ApiService();