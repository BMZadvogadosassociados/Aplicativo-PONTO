// services/NotificationService.js - VERSÃO COMPLETA CORRIGIDA
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import ApiService from './api'; // ✅ CORRIGIDO: Importação da API

// Configuração das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  
  // Inicializar o serviço de notificações
  async initialize() {
    try {
      console.log('🔔 Inicializando notificações de ajustes...');
      
      // Solicitar permissões
      const permission = await this.requestPermissions();
      if (!permission) {
        console.log('❌ Permissão de notificação negada');
        return false;
      }

      // Configurar listeners
      this.setupNotificationListeners();

      console.log('✅ Notificações de ajustes inicializadas');
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao inicializar notificações:', error);
      return false;
    }
  }

  // Solicitar permissões
  async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('🚫 Permissão de notificação negada pelo usuário');
        return false;
      }

      // Configurações específicas do Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Ajustes de Ponto BMZ',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1e5f74',
          sound: 'default',
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao solicitar permissões:', error);
      return false;
    }
  }

  // Configurar listeners de notificações
  setupNotificationListeners() {
    // Listener para quando app está aberto
    Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notificação de ajuste recebida:', notification);
    });

    // ✅ MELHORADO: Listener para quando usuário toca na notificação
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notificação de ajuste tocada:', response);
      
      // Navegar para histórico se for notificação de ajuste
      if (response.notification.request.content.data?.type === 'ajuste_status') {
        console.log('📱 Redirecionando para histórico...');
        // TODO: Implementar navegação quando necessário
        // router.push('/history');
      }
    });
  }

  // ==================== NOTIFICAÇÃO DE AJUSTES ====================

  // Notificar sobre status de ajuste
  async notifyAjusteStatus(status, motivo, respostaRH) {
    try {
      const isAprovado = status === 'aprovado';
      
      const notification = {
        title: isAprovado ? '✅ Ajuste Aprovado!' : '❌ Ajuste Rejeitado',
        body: isAprovado 
          ? `Seu ajuste de horário foi aprovado${respostaRH ? ': ' + respostaRH : ''}`
          : `Seu ajuste foi rejeitado${respostaRH ? ': ' + respostaRH : ''}`,
        data: {
          type: 'ajuste_status',
          status,
          motivo,
          respostaRH,
          timestamp: new Date().toISOString()
        },
        sound: 'default',
        priority: 'high'
      };

      await this.scheduleImmediateNotification(notification);
      console.log(`🔔 Notificação de ajuste enviada: ${status}`);
      
    } catch (error) {
      console.error('❌ Erro ao notificar ajuste:', error);
    }
  }

  // ==================== AGENDAMENTO ====================

  // Agendar notificação imediata
  async scheduleImmediateNotification(notification) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: notification,
        trigger: null, // Imediatamente
      });
      
      console.log('📤 Notificação enviada:', notification.title);
    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
    }
  }

  // ==================== INTEGRAÇÃO COM API ====================

  // ✅ CORRIGIDO: Verificar novos ajustes e notificar
  async checkAjustesStatus() {
    try {
      console.log('🔍 Verificando status dos ajustes...');
      
      // ✅ NOVO: Verificar se notificações estão ativadas nas configurações
      const configs = await AsyncStorage.getItem('configuracoes');
      if (configs) {
        const configObj = JSON.parse(configs);
        if (!configObj.notificacoes) {
          console.log('🔕 Notificações desabilitadas nas configurações');
          return;
        }
      }
      
      // Buscar última verificação
      const ultimaVerificacao = await AsyncStorage.getItem('ultimaVerificacaoAjustes');
      const agora = new Date().toISOString();

      // ✅ CORRIGIDO: Buscar ajustes atuais usando a API corretamente
      const response = await ApiService.buscarAjustes();
      
      // ✅ MELHORADO: Tratamento de erro e verificação de dados
      if (response.success && response.ajustes) {
        // Verificar se ajustes é array
        const ajustes = Array.isArray(response.ajustes) ? response.ajustes : [];
        
        // Verificar mudanças desde última verificação
        const ajustesAnteriores = await AsyncStorage.getItem('statusAjustesCache');
        const statusAnterior = ajustesAnteriores ? JSON.parse(ajustesAnteriores) : {};
        
        for (const ajuste of ajustes) {
          const ajusteId = ajuste.id || ajuste._id;
          const statusAtual = ajuste.status;
          const statusPrevio = statusAnterior[ajusteId];
          
          // Se houve mudança de status e não é mais pendente
          if (statusPrevio && statusPrevio !== statusAtual && statusAtual !== 'pendente') {
            console.log(`🔔 Mudança detectada: ${statusPrevio} → ${statusAtual}`);
            await this.notifyAjusteStatus(statusAtual, ajuste.motivo, ajuste.respostaMensagem);
          }
          
          // Atualizar cache de status
          statusAnterior[ajusteId] = statusAtual;
        }
        
        // Salvar cache atualizado
        await AsyncStorage.setItem('statusAjustesCache', JSON.stringify(statusAnterior));
        console.log(`✅ ${ajustes.length} ajustes verificados`);
      } else {
        console.log('⚠️ Nenhum ajuste encontrado ou erro na resposta');
      }

      await AsyncStorage.setItem('ultimaVerificacaoAjustes', agora);
      console.log('✅ Verificação de ajustes concluída');
      
    } catch (error) {
      console.error('❌ Erro ao verificar ajustes:', error);
      // Não lançar erro para não quebrar outras funcionalidades
    }
  }

  // ==================== UTILITÁRIOS ====================

  // Testar notificação
  async testNotification() {
    try {
      await this.scheduleImmediateNotification({
        title: '🎉 BMZ Advogados Associados',
        body: 'Suas notificações estão funcionando corretamente!',
        data: { type: 'teste' }
      });
      console.log('Notificação eniviada...');
    } catch (error) {
      console.error('❌ Erro ao testar notificação:', error);
      throw error;
    }
  }

  // Verificar se as notificações estão habilitadas
  async areNotificationsEnabled() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
      return false;
    }
  }

  // ✅ NOVO: Verificar se estão habilitadas nas configurações do app
  async areNotificationsEnabledInSettings() {
    try {
      const configs = await AsyncStorage.getItem('configuracoes');
      if (configs) {
        const configObj = JSON.parse(configs);
        return configObj.notificacoes === true;
      }
      return true; // padrão ativado
    } catch (error) {
      console.error('❌ Erro ao verificar configurações:', error);
      return true;
    }
  }

  // ✅ MELHORADO: Obter estatísticas completas
  async getNotificationStats() {
    try {
      const systemEnabled = await this.areNotificationsEnabled();
      const settingsEnabled = await this.areNotificationsEnabledInSettings();
      const lastCheck = await AsyncStorage.getItem('ultimaVerificacaoAjustes');
      const cache = await AsyncStorage.getItem('statusAjustesCache');
      
      const ajustesMonitorados = cache ? Object.keys(JSON.parse(cache)).length : 0;

      return {
        systemEnabled,
        settingsEnabled,
        enabled: systemEnabled && settingsEnabled,
        lastCheck: lastCheck ? new Date(lastCheck).toLocaleString('pt-BR') : 'Nunca',
        ajustesMonitorados
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  // ✅ NOVO: Limpar cache de notificações
  async clearNotificationCache() {
    try {
      await AsyncStorage.multiRemove([
        'ultimaVerificacaoAjustes',
        'statusAjustesCache'
      ]);
      console.log('🧹 Cache de notificações limpo');
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
    }
  }

  // ✅ NOVO: Forçar verificação imediata
  async forceCheck() {
    console.log('🔄 Forçando verificação de ajustes...');
    await this.checkAjustesStatus();
  }
}

export default new NotificationService();