// screens/NotificationSettings.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import NotificationService from '../services/NotificationService';

export default function NotificationSettings() {
  const router = useRouter();
  const [lembretesHabilitados, setLembretesHabilitados] = useState(true);
  const [notificacoesAgendadas, setNotificacoesAgendadas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      setLoading(true);
      
      // Verificar status dos lembretes
      const remindersEnabled = await NotificationService.areRemindersEnabled();
      setLembretesHabilitados(remindersEnabled);

      // Buscar estatísticas
      const stats = await NotificationService.getNotificationStats();
      if (stats) {
        setNotificacoesAgendadas(stats.scheduledCount);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLembretes = async (value) => {
    try {
      setLembretesHabilitados(value);
      
      const success = await NotificationService.toggleReminders(value);
      
      if (success) {
        Alert.alert(
          'Configuração atualizada',
          value 
            ? 'Lembretes de ponto foram habilitados. Você receberá notificações nos horários de trabalho.'
            : 'Lembretes de ponto foram desabilitados.'
        );
        
        // Atualizar contagem
        await carregarConfiguracoes();
      } else {
        // Reverter se falhou
        setLembretesHabilitados(!value);
        Alert.alert('Erro', 'Não foi possível alterar a configuração.');
      }
      
    } catch (error) {
      console.error('❌ Erro ao alterar lembretes:', error);
      setLembretesHabilitados(!value);
      Alert.alert('Erro', 'Falha ao alterar configuração de lembretes.');
    }
  };

  const testarNotificacao = async () => {
    try {
      await NotificationService.testNotification();
      Alert.alert(
        'Teste enviado',
        'Se as notificações estiverem funcionando, você verá uma notificação de teste em breve.'
      );
    } catch (error) {
      console.error('❌ Erro ao testar notificação:', error);
      Alert.alert('Erro', 'Não foi possível enviar notificação de teste.');
    }
  };

  const verificarPermissoes = async () => {
    try {
      const hasPermission = await NotificationService.requestPermissions();
      
      if (hasPermission) {
        Alert.alert('Permissões OK', 'Todas as permissões de notificação estão concedidas.');
      } else {
        Alert.alert(
          'Permissões negadas',
          'Para receber notificações, é necessário permitir nas configurações do dispositivo.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Configurações', onPress: () => {
              // TODO: Abrir configurações do sistema
              console.log('Abrir configurações do sistema');
            }}
          ]
        );
      }
    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
      Alert.alert('Erro', 'Não foi possível verificar permissões.');
    }
  };

  const limparNotificacoes = async () => {
    Alert.alert(
      'Cancelar Notificações',
      'Isso cancelará todas as notificações agendadas. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            try {
              await NotificationService.cancelAllScheduledNotifications();
              Alert.alert('Concluído', 'Todas as notificações foram canceladas.');
              await carregarConfiguracoes();
            } catch (error) {
              console.error('❌ Erro ao cancelar notificações:', error);
              Alert.alert('Erro', 'Não foi possível cancelar as notificações.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e5f74" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        
        {/* Configurações principais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Lembretes de Ponto</Text>
              <Text style={styles.settingDescription}>
                Receber notificações nos horários de entrada, saída e almoço
              </Text>
            </View>
            <Switch
              value={lembretesHabilitados}
              onValueChange={toggleLembretes}
              trackColor={{ false: '#767577', true: '#1e5f74' }}
              thumbColor={lembretesHabilitados ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Informações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações</Text>
          
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={20} color="#1e5f74" />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Notificações Agendadas</Text>
              <Text style={styles.infoValue}>{notificacoesAgendadas} lembretes</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={20} color="#1e5f74" />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Horários dos Lembretes</Text>
              <Text style={styles.infoValue}>
                08:00 (Entrada) • 12:00 (Almoço) • 13:00 (Retorno) • 17:30 (Saída)
              </Text>
            </View>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={testarNotificacao}>
            <Ionicons name="flask-outline" size={20} color="#1e5f74" />
            <Text style={styles.actionButtonText}>Testar Notificação</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={verificarPermissoes}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#1e5f74" />
            <Text style={styles.actionButtonText}>Verificar Permissões</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={limparNotificacoes}>
            <Ionicons name="trash-outline" size={20} color="#dc3545" />
            <Text style={[styles.actionButtonText, { color: '#dc3545' }]}>
              Cancelar Todas as Notificações
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Ajuda */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre as Notificações</Text>
          
          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              • <Text style={styles.helpBold}>Lembretes automáticos:</Text> Receba notificações nos horários de trabalho para não esquecer de marcar o ponto.
            </Text>
            
            <Text style={styles.helpText}>
              • <Text style={styles.helpBold}>Status de ajustes:</Text> Seja notificado quando o RH aprovar ou rejeitar suas solicitações de ajuste.
            </Text>
            
            <Text style={styles.helpText}>
              • <Text style={styles.helpBold}>Inconsistências:</Text> Receba alertas sobre problemas com seus registros de ponto.
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e5f74',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e5f74',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoText: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#1e5f74',
    marginLeft: 12,
    flex: 1,
  },
  helpContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 12,
  },
  helpBold: {
    fontWeight: 'bold',
    color: '#333',
  },
});