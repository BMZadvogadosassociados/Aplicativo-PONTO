import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Platform } from 'react-native';

class BiometricService {
  
  // Verificar se o dispositivo suporta biometria
  async isSupported() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      return {
        hasHardware,
        isEnrolled,
        isSupported: hasHardware && isEnrolled
      };
    } catch (error) {
      console.error('❌ Erro ao verificar suporte biométrico:', error);
      return {
        hasHardware: false,
        isEnrolled: false,
        isSupported: false
      };
    }
  }

  // Obter tipos de biometria disponíveis
  async getSupportedTypes() {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      const biometricTypes = {
        fingerprint: types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
        faceId: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
        iris: types.includes(LocalAuthentication.AuthenticationType.IRIS)
      };

      return biometricTypes;
    } catch (error) {
      console.error('❌ Erro ao obter tipos biométricos:', error);
      return {
        fingerprint: false,
        faceId: false,
        iris: false
      };
    }
  }

  // Autenticar com biometria
  async authenticate(options = {}) {
    try {
      const support = await this.isSupported();
      
      if (!support.isSupported) {
        return {
          success: false,
          error: 'Biometria não disponível neste dispositivo',
          errorCode: 'NOT_SUPPORTED'
        };
      }

      const types = await this.getSupportedTypes();
      
      // Definir prompt baseado no tipo disponível
      let promptMessage = 'Use sua biometria para acessar';
      let fallbackLabel = 'Usar senha';
      
      if (types.faceId) {
        promptMessage = Platform.OS === 'ios' ? 'Use o Face ID para acessar' : 'Use o reconhecimento facial para acessar';
      } else if (types.fingerprint) {
        promptMessage = 'Use sua impressão digital para acessar';
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel,
        disableDeviceFallback: false,
        cancelLabel: 'Cancelar',
        ...options
      });

      if (result.success) {
        console.log('✅ Autenticação biométrica bem-sucedida');
        return {
          success: true,
          biometricType: this.getBiometricTypeName(types)
        };
      } else {
        console.log('❌ Autenticação biométrica cancelada/falhou:', result.error);
        return {
          success: false,
          error: result.error || 'Autenticação cancelada',
          errorCode: result.error
        };
      }

    } catch (error) {
      console.error('❌ Erro na autenticação biométrica:', error);
      return {
        success: false,
        error: 'Erro na autenticação biométrica',
        errorCode: 'UNKNOWN_ERROR'
      };
    }
  }

  // Verificar se biometria está habilitada para o app
  async isBiometricEnabled() {
    try {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      return enabled === 'true';
    } catch (error) {
      console.error('❌ Erro ao verificar biometria habilitada:', error);
      return false;
    }
  }

  // Habilitar/Desabilitar biometria
  async setBiometricEnabled(enabled) {
    try {
      await AsyncStorage.setItem('biometricEnabled', enabled.toString());
      console.log(`🔐 Biometria ${enabled ? 'habilitada' : 'desabilitada'}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao configurar biometria:', error);
      return false;
    }
  }

  // Salvar credenciais de forma segura
  async saveCredentials(cpf, token) {
    try {
      const credentials = {
        cpf,
        token,
        savedAt: new Date().toISOString()
      };

      await AsyncStorage.setItem('biometricCredentials', JSON.stringify(credentials));
      console.log('🔐 Credenciais salvas para biometria');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar credenciais:', error);
      return false;
    }
  }

  // Obter credenciais salvas
  async getSavedCredentials() {
    try {
      const credentialsString = await AsyncStorage.getItem('biometricCredentials');
      
      if (!credentialsString) {
        return null;
      }

      const credentials = JSON.parse(credentialsString);
      
      // Verificar se as credenciais não expiraram (7 dias)
      const savedAt = new Date(credentials.savedAt);
      const now = new Date();
      const diffDays = (now - savedAt) / (1000 * 60 * 60 * 24);
      
      if (diffDays > 7) {
        console.log('⚠️ Credenciais biométricas expiraram');
        await this.clearCredentials();
        return null;
      }

      return credentials;
    } catch (error) {
      console.error('❌ Erro ao obter credenciais:', error);
      return null;
    }
  }

  // Limpar credenciais salvas
  async clearCredentials() {
    try {
      await AsyncStorage.multiRemove(['biometricCredentials', 'biometricEnabled']);
      console.log('🗑️ Credenciais biométricas removidas');
      return true;
    } catch (error) {
      console.error('❌ Erro ao limpar credenciais:', error);
      return false;
    }
  }

  // Configurar biometria (usado no Settings)
  async setupBiometric(cpf, token) {
    try {
      const support = await this.isSupported();
      
      if (!support.isSupported) {
        Alert.alert(
          'Biometria Indisponível',
          'Seu dispositivo não suporta autenticação biométrica ou não tem nenhuma biometria cadastrada.',
          [{ text: 'OK' }]
        );
        return false;
      }

      const types = await this.getSupportedTypes();
      const biometricName = this.getBiometricTypeName(types);

      return new Promise((resolve) => {
        Alert.alert(
          'Confirmar Configuração',
          `Deseja usar ${biometricName} para fazer login automaticamente?`,
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => resolve(false)
            },
            {
              text: 'Configurar',
              onPress: async () => {
                const authResult = await this.authenticate({
                  promptMessage: `Configure ${biometricName} para login automático`
                });

                if (authResult.success) {
                  await this.setBiometricEnabled(true);
                  await this.saveCredentials(cpf, token);
                  
                  Alert.alert(
                    'Biometria Configurada',
                    `${biometricName} foi configurada com sucesso! Agora você pode fazer login automaticamente.`,
                    [{ text: 'OK' }]
                  );
                  resolve(true);
                } else {
                  Alert.alert(
                    'Configuração Cancelada',
                    'A configuração da biometria foi cancelada.',
                    [{ text: 'OK' }]
                  );
                  resolve(false);
                }
              }
            }
          ]
        );
      });
    } catch (error) {
      console.error('❌ Erro ao configurar biometria:', error);
      Alert.alert('Erro', 'Não foi possível configurar a biometria');
      return false;
    }
  }

  // Obter nome amigável do tipo de biometria
  getBiometricTypeName(types) {
    if (types.faceId) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Reconhecimento Facial';
    } else if (types.fingerprint) {
      return 'Impressão Digital';
    } else if (types.iris) {
      return 'Reconhecimento de Íris';
    }
    return 'Biometria';
  }

  // Verificar status completo da biometria
  async getFullStatus() {
    try {
      const support = await this.isSupported();
      const types = await this.getSupportedTypes();
      const isEnabled = await this.isBiometricEnabled();
      const hasCredentials = !!(await this.getSavedCredentials());

      return {
        ...support,
        types,
        isEnabled,
        hasCredentials,
        biometricName: this.getBiometricTypeName(types),
        canUse: support.isSupported && isEnabled && hasCredentials
      };
    } catch (error) {
      console.error('❌ Erro ao obter status da biometria:', error);
      return {
        hasHardware: false,
        isEnrolled: false,
        isSupported: false,
        types: { fingerprint: false, faceId: false, iris: false },
        isEnabled: false,
        hasCredentials: false,
        biometricName: 'Biometria',
        canUse: false
      };
    }
  }

  // Desabilitar biometria (usado no Settings)
  async disableBiometric() {
    try {
      return new Promise((resolve) => {
        Alert.alert(
          'Desabilitar Biometria',
          'Tem certeza que deseja desabilitar a autenticação biométrica? Você precisará fazer login com CPF e senha.',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => resolve(false)
            },
            {
              text: 'Desabilitar',
              style: 'destructive',
              onPress: async () => {
                await this.clearCredentials();
                Alert.alert(
                  'Biometria Desabilitada',
                  'A autenticação biométrica foi desabilitada com sucesso.',
                  [{ text: 'OK' }]
                );
                resolve(true);
              }
            }
          ]
        );
      });
    } catch (error) {
      console.error('❌ Erro ao desabilitar biometria:', error);
      return false;
    }
  }
}

export default new BiometricService();