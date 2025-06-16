import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import ApiService from '../services/api';

export default function LoginScreen() {
  const router = useRouter();

  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [verificandoBiometria, setVerificandoBiometria] = useState(true);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const botaoAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    verificarLoginAutomatico();
  }, []);

  useEffect(() => {
    if (!verificandoBiometria) {
      Animated.parallel([
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(formAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [verificandoBiometria]);

  const verificarLoginAutomatico = async () => {
    try {
      setVerificandoBiometria(true);
      const biometriaHabilitada = await AsyncStorage.getItem('biometricEnabled');

      if (biometriaHabilitada === 'true') {
        const credString = await AsyncStorage.getItem('biometricCredentials');
        if (credString) {
          const cred = JSON.parse(credString);
          const savedAt = new Date(cred.savedAt);
          const now = new Date();
          const diffDays = (now - savedAt) / (1000 * 60 * 60 * 24);
          if (diffDays <= 7) {
            await tentarLoginBiometrico(cred);
          } else {
            await limparCredenciaisBiometricas();
          }
        }
      }
    } catch (e) {
      console.error('Erro ao verificar login automático:', e);
    } finally {
      setVerificandoBiometria(false);
    }
  };

  const tentarLoginBiometrico = async (cred) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Use biometria para entrar',
        fallbackLabel: 'Usar senha',
      });

      if (result.success) {
        await AsyncStorage.setItem('token', cred.token);
        const tokenValido = await ApiService.verificarToken();
        if (tokenValido.success) {
          router.replace('/home');
        } else {
          await limparCredenciaisBiometricas();
        }
      }
    } catch (error) {
      console.error('Erro no login biométrico:', error);
    }
  };

  const limparCredenciaisBiometricas = async () => {
    await AsyncStorage.multiRemove(['biometricCredentials', 'biometricEnabled']);
  };

  const formatarCPF = (texto) => {
    const nums = texto.replace(/\D/g, '');
    const formatado = nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    setCpf(formatado);
  };

  const realizarLogin = async () => {
    if (!cpf || !senha) return Alert.alert('Atenção', 'Preencha todos os campos');
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return Alert.alert('Erro', 'CPF inválido');
    setCarregando(true);

    try {
      const response = await ApiService.login(cpfLimpo, senha);
      if (response.success) {
        Alert.alert('Sucesso', 'Login realizado com sucesso!', [
          { text: 'OK', onPress: () => router.push('/home') },
        ]);
      } else {
        Alert.alert('Erro', response.message || 'Erro ao fazer login');
      }
    } catch (error) {
      if (error.message.includes('fetch')) {
        Alert.alert('Erro de Conexão', 'Verifique sua internet ou o servidor.');
      } else {
        Alert.alert('Erro', error.message || 'Erro ao fazer login');
      }
    } finally {
      setCarregando(false);
    }
  };

  if (verificandoBiometria) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Image source={require('../assets/logo_alt.png')} style={styles.logoImage} />
          </View>
        </View>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#1A2E66" />
          <Text style={styles.loadingText}>Verificando autenticação...</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.logoCircle, { opacity: logoAnim, transform: [{ scale: logoAnim }] }]}>
            <Image source={require('../assets/logo_alt.png')} style={styles.logoImage} />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: formAnim,
              transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          <Text style={styles.titulo}>Bem-vindo</Text>
          <Text style={styles.subtitulo}>Acesse sua conta para continuar</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>CPF</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#1A2E66" />
              <TextInput
                style={styles.input}
                placeholder="000.000.000-00"
                value={cpf}
                onChangeText={formatarCPF}
                keyboardType="numeric"
                maxLength={14}
                editable={!carregando}
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#1A2E66" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!mostrarSenha}
                editable={!carregando}
                placeholderTextColor="#999"
              />
              <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
                <Ionicons name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} size={20} color="#1A2E66" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.esqueceuSenha}>
            <Text style={styles.esqueceuSenhaTexto}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.botaoEntrar, { transform: [{ scale: botaoAnim }] }]}
            onPressIn={() =>
              Animated.spring(botaoAnim, {
                toValue: 0.96,
                useNativeDriver: true,
              }).start()
            }
            onPressOut={() =>
              Animated.spring(botaoAnim, {
                toValue: 1,
                useNativeDriver: true,
              }).start()
            }
            onPress={realizarLogin}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.botaoEntrarTexto}>ENTRAR</Text>
            )}
          </TouchableOpacity>

          <View style={styles.cadastroContainer}>
            <Text style={styles.cadastroTexto}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.cadastroLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.biometriaInfo}>
            <Text style={styles.biometriaInfoTexto}>
              💡 Habilite a biometria nas configurações para login mais rápido
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoContainer: {
    height: '35%',
    backgroundColor: '#1A2E66',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },

  logoCircle: {
    width: 130,
    height: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },

  logoImage: {
    width: 90,
    height: 90,
  },

  loadingContent: {
    alignItems: 'center',
    marginTop: 30,
  },

  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#2C2C2C',
    fontWeight: '500',
  },

  formContainer: {
    flex: 1,
    padding: 25,
  },

  titulo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A2E66',
    marginBottom: 5,
  },

  subtitulo: {
    fontSize: 15,
    color: '#6D6D6D',
    marginBottom: 25,
  },

  inputContainer: {
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    color: '#1A2E66',
    marginBottom: 6,
    fontWeight: '600',
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F6',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 48,
  },

  input: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
    color: '#2C2C2C',
  },

  esqueceuSenha: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },

  esqueceuSenhaTexto: {
    color: '#1A2E66',
    fontSize: 14,
  },

  botaoEntrar: {
    backgroundColor: '#3A7456',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  botaoEntrarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  cadastroContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },

  cadastroTexto: {
    color: '#6D6D6D',
  },

  cadastroLink: {
    color: '#1A2E66',
    fontWeight: '600',
  },

  biometriaInfo: {
    backgroundColor: '#EAF1FF',
    padding: 12,
    borderRadius: 8,
    borderColor: '#D3E0FF',
    borderWidth: 1,
  },

  biometriaInfoTexto: {
    fontSize: 13,
    color: '#1A2E66',
    textAlign: 'center',
    fontWeight: '500',
  },
});
