import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Network from 'expo-network';

// ✅ CONFIGURAÇÃO ATUALIZADA PARA DOMÍNIO pontobmz.com

const getApiBaseUrl = () => {
  if (__DEV__) {
    // EM DESENVOLVIMENTO - usar IP local com porta específica
    const debuggerHost = Constants.expoConfig?.hostUri
      ? Constants.expoConfig.hostUri.split(':').shift()
      : null;
    
    if (debuggerHost && 
        debuggerHost !== 'localhost' && 
        debuggerHost !== '127.0.0.1' &&
        !debuggerHost.includes('exp://')) {
      console.log('🔍 DEV: Usando IP do debugger Expo:', debuggerHost);
      return `http://${debuggerHost}:3000`;
    }
    
    console.log('🔍 DEV: Usando IP local');
    return 'http://192.168.88.22:3000';
  }
  
  // ✅ EM PRODUÇÃO/BUILD - usar domínio com HTTPS
  console.log('🏗️ BUILD: Usando domínio pontobmz.com com HTTPS');
  return 'https://pontobmz.com'; // Domínio principal com SSL
};

// ✅ URLs ORGANIZADAS COM DOMÍNIO E FALLBACKS
class ApiService {
  constructor() {
    this.baseUrl = getApiBaseUrl();
    this.fallbackUrls = [
      'https://pontobmz.com',          // Domínio principal HTTPS
      'http://pontobmz.com',           // Domínio HTTP (fallback)
      'https://www.pontobmz.com',      // Subdomínio www HTTPS
      'http://www.pontobmz.com',       // Subdomínio www HTTP
      'http://168.197.64.215',         // IP público porta 80 (via hairpin NAT)
      'https://168.197.64.215',        // IP público porta 443 (via hairpin NAT)
      'http://168.197.64.215:3000',    // IP público porta 3000 (direto)
      'http://192.168.88.22:3000',     // IP local para desenvolvimento
    ];
    
    console.log('🌐 ApiService inicializado');
    console.log('📱 Ambiente:', __DEV__ ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');
    console.log('🌐 URL principal:', this.baseUrl);
    console.log('🔄 URLs de fallback:', this.fallbackUrls);
    console.log('🔒 SSL/HTTPS: Habilitado para pontobmz.com');
  }

  // ✅ TESTE OTIMIZADO PARA PRODUÇÃO COM DOMÍNIO
  async testarUrls() {
    const urlsParaTestar = [this.baseUrl, ...this.fallbackUrls];
    
    for (const url of urlsParaTestar) {
      try {
        console.log(`🔍 Testando: ${url}`);
        
        const controller = new AbortController();
        // Timeout menor em produção para ser mais responsivo
        const timeout = __DEV__ ? 5000 : 3000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(`${url}/health`, {
          signal: controller.signal,
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ URL funcionando: ${url}`, data?.protocol || '');
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

  // ✅ VERIFICAÇÃO DE REDE MELHORADA
  async verificarRedeDisponivel() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      
      if (!networkState.isConnected) {
        throw new Error('Sem conexão com a internet');
      }
      
      // Em produção, verificar também se a internet está realmente acessível
      if (!__DEV__ && !networkState.isInternetReachable) {
        console.log('⚠️ Internet pode não estar totalmente acessível');
        // Não falhar aqui, continuar tentando
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

  // ✅ VERIFICAÇÃO INTELIGENTE DE CONECTIVIDADE
  async verificarConectividade() {
    try {
      console.log('🔍 Verificando conectividade...');
      console.log('📱 Ambiente:', __DEV__ ? 'DEV' : 'BUILD');
      console.log('🌐 URL base atual:', this.baseUrl);
      
      // Verificar rede primeiro
      await this.verificarRedeDisponivel();
      
      // ✅ TIMEOUT OTIMIZADO POR AMBIENTE
      const timeoutDuration = __DEV__ ? 5000 : 2500;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log('⏰ Timeout na URL atual');
        }, timeoutDuration);
        
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
          console.log('✅ Servidor online na URL atual:', data?.protocol || 'HTTPS');
          return { success: true, data, url: this.baseUrl };
        }
      } catch (error) {
        console.log('⚠️ URL atual falhou, tentando fallbacks...');
        console.log('❌ Erro específico:', error.message);
        
        // ✅ TENTAR FALLBACKS
        const urlFuncionando = await this.testarUrls();
        
        const response = await fetch(`${urlFuncionando}/health`);
        const data = await response.json();
        
        console.log('✅ Conectado via fallback:', data?.protocol || 'HTTP');
        return { success: true, data, url: urlFuncionando };
      }
      
    } catch (error) {
      console.error('❌ Falha total de conectividade:', error);
      
      // ✅ DIAGNÓSTICO ESPECÍFICO
      if (!__DEV__) {
        console.error('🏗️ DIAGNÓSTICO PRODUÇÃO:');
        console.error('- Verifique se está conectado à internet');
        console.error('- Verifique se o servidor pontobmz.com está online');
        console.error('- URLs testadas:', [this.baseUrl, ...this.fallbackUrls]);
      }
      
      throw error;
    }
  }

  // ✅ REQUISIÇÃO OTIMIZADA
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
        timeout: __DEV__ ? 15000 : 10000, // Timeout menor em produção
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
          const errorData = await response.json();
          errorText = errorData.message || errorData.error || response.statusText;
        } catch (e) {
          try {
            errorText = await response.text();
          } catch (e2) {
            errorText = `HTTP ${response.status}`;
          }
        }
        
        console.error('❌ Erro HTTP:', errorText);
        throw new Error(`${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Resposta recebida:`, data.success ? 'Sucesso' : 'Falha');
      
      return data;

    } catch (error) {
      console.error(`❌ Erro na requisição para ${endpoint}:`, error);
      
      // Melhorar mensagens de erro
      if (error.name === 'AbortError') {
        throw new Error('Operação cancelada por timeout. Verifique sua conexão.');
      }
      
      if (error.message.includes('Network request failed') ||
          error.message.includes('fetch')) {
        throw new Error(`Erro de conexão. Servidor pode estar offline.`);
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

  async cadastrar(dadosUsuario) {
    try {
      console.log('📝 Iniciando cadastro para:', dadosUsuario.email);
      console.log('🌐 Conectando em:', this.baseUrl);
      
      const response = await this.makeRequest('/auth/cadastrar', {
        method: 'POST',
        body: JSON.stringify(dadosUsuario),
      });

      console.log('✅ Cadastro realizado:', response.success);
      return response;
      
    } catch (error) {
      console.error('❌ Erro no cadastro:', error.message);
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
      
      // Enriquecer pontos com dados de ajustes
      if (response.success && response.pontos) {
        try {
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
        } catch (ajustesError) {
          console.log('⚠️ Erro ao carregar ajustes:', ajustesError.message);
          // Continuar sem os ajustes
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

  // ==================== UTILITÁRIOS DE TESTE ====================
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
          'Verifique se o servidor está rodando em pontobmz.com',
          'Confirme se está conectado à internet',
          'Teste manualmente no navegador: https://pontobmz.com',
          'Verifique se o firewall não está bloqueando',
          'Reinicie o aplicativo'
        ]
      };
    }
  }

  // ✅ DIAGNÓSTICO SIMPLIFICADO PARA PRODUÇÃO
  async diagnosticarConexao() {
    console.log('🔬 === DIAGNÓSTICO DE CONEXÃO ===');
    console.log('📱 Ambiente:', __DEV__ ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');
    console.log('🌐 URL principal:', this.baseUrl);
    
    const resultados = {
      ambiente: __DEV__ ? 'DEV' : 'PRODUÇÃO',
      urlPrincipal: this.baseUrl,
      testeUrls: [],
      rede: null,
      erro: null
    };
    
    try {
      // Testar estado da rede
      console.log('📶 Testando estado da rede...');
      const networkState = await Network.getNetworkStateAsync();
      resultados.rede = {
        connected: networkState.isConnected,
        internet: networkState.isInternetReachable,
        type: networkState.type
      };
      console.log('📶 Estado da rede:', resultados.rede);
      
      // Testar URLs prioritárias
      const urlsPrioritarias = __DEV__ 
        ? [this.baseUrl, 'http://192.168.88.22:3000']
        : [this.baseUrl, 'https://pontobmz.com', 'http://pontobmz.com', 'http://168.197.64.215'];
      
      for (const url of urlsPrioritarias) {
        const testeUrl = { url, status: null, tempo: null, erro: null, sucesso: false };
        
        try {
          console.log(`🧪 Testando: ${url}`);
          const inicio = Date.now();
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.log(`⏰ Timeout em ${url}`);
          }, 3000);
          
          const response = await fetch(`${url}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          const tempo = Date.now() - inicio;
          
          testeUrl.status = response.status;
          testeUrl.tempo = tempo;
          testeUrl.sucesso = response.ok;
          
          console.log(`${response.ok ? '✅' : '❌'} ${url} - ${response.status} (${tempo}ms)`);
          
          if (response.ok && !resultados.urlFuncionando) {
            resultados.urlFuncionando = url;
            this.baseUrl = url;
          }
          
        } catch (error) {
          testeUrl.erro = error.name === 'AbortError' ? 'Timeout' : error.message;
          console.log(`❌ ${url} - ${testeUrl.erro}`);
        }
        
        resultados.testeUrls.push(testeUrl);
      }
      
      // Resultado final
      const urlsFuncionando = resultados.testeUrls.filter(t => t.sucesso);
      resultados.sucesso = urlsFuncionando.length > 0;
      resultados.funcionando = urlsFuncionando.length;
      
      console.log('🎯 === RESULTADO FINAL ===');
      console.log(`✅ URLs funcionando: ${urlsFuncionando.length}/${resultados.testeUrls.length}`);
      console.log(`🌐 URL escolhida: ${resultados.urlFuncionando || 'NENHUMA'}`);
      console.log('===========================');
      
      return resultados;
      
    } catch (error) {
      console.error('❌ Erro no diagnóstico:', error);
      resultados.erro = error.message;
      resultados.sucesso = false;
      return resultados;
    }
  }

  // ✅ INFORMAÇÕES DE DEBUG
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
      platform: Constants.platform?.os,
      deviceName: Constants.deviceName,
      sessionId: Constants.sessionId
    };
  }
}

export default new ApiService();
