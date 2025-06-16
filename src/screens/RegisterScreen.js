import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import ApiService from '../services/api';

export default function RegisterScreen() {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatarCPF = (texto) => {
    const apenasNumeros = texto.replace(/\D/g, '');
    if (apenasNumeros.length <= 11) {
      const cpfFormatado = apenasNumeros
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
      setCpf(cpfFormatado);
    }
  };

  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const realizarCadastro = async () => {
    if (!nome || !sobrenome || !cpf || !email || !senha || !confirmarSenha)
      return Alert.alert('Atenção', 'Por favor, preencha todos os campos');

    if (!validarEmail(email)) return Alert.alert('Erro', 'Email inválido');

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return Alert.alert('Erro', 'CPF inválido');

    if (senha.length < 6) return Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');

    if (senha !== confirmarSenha) return Alert.alert('Erro', 'As senhas não coincidem');

    setCarregando(true);

    try {
      const dados = {
        nome,
        sobrenome,
        cpf: cpfLimpo,
        email,
        senha,
        empresa: 'BMZ Advogados',
        cargo: 'Funcionário',
      };

      const response = await ApiService.cadastrar(dados);

      if (response.success) {
        Alert.alert('Sucesso!', 'Cadastro realizado com sucesso!', [
          { text: 'Fazer Login', onPress: () => router.push('/') },
        ]);
      } else {
        Alert.alert('Erro', response.message || 'Erro ao realizar cadastro');
      }
    } catch (error) {
      if (error.message.includes('CPF já cadastrado')) {
        Alert.alert('Erro', 'Este CPF já está cadastrado no sistema');
      } else if (error.message.includes('Email já cadastrado')) {
        Alert.alert('Erro', 'Este email já está cadastrado no sistema');
      } else if (error.message.includes('fetch')) {
        Alert.alert('Erro de Conexão', 'Não foi possível conectar ao servidor.');
      } else {
        Alert.alert('Erro', error.message || 'Falha ao realizar cadastro');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#1A2E66" />
            </TouchableOpacity>
            <View style={styles.whatsappInfo}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              <Text style={styles.whatsappText}>Duvidas? +55 42 99962-8316</Text>
            </View>
          </View>

          <Animated.View
            style={[
              styles.tituloContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.titulo}>Cadastro</Text>
            <Text style={styles.subtitulo}>Crie sua conta para acessar o sistema</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.formContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {[
              { label: 'Nome', value: nome, set: setNome, icon: 'person-outline', placeholder: 'Seu nome' },
              { label: 'Sobrenome', value: sobrenome, set: setSobrenome, icon: 'person-outline', placeholder: 'Seu sobrenome' },
              { label: 'CPF', value: cpf, set: formatarCPF, icon: 'card-outline', placeholder: '000.000.000-00', keyboardType: 'numeric' },
              { label: 'Email', value: email, set: setEmail, icon: 'mail-outline', placeholder: 'seu@email.com', keyboardType: 'email-address', autoCapitalize: 'none' }
            ].map((input, i) => (
              <View key={i} style={styles.inputContainer}>
                <Text style={styles.label}>{input.label}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name={input.icon} size={20} color="#1A2E66" />
                  <TextInput
                    style={styles.input}
                    placeholder={input.placeholder}
                    value={input.value}
                    onChangeText={input.set}
                    editable={!carregando}
                    keyboardType={input.keyboardType || 'default'}
                    autoCapitalize={input.autoCapitalize || 'sentences'}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            ))}

            {/* Senha */}
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
                  <Ionicons name={mostrarSenha ? "eye-off-outline" : "eye-outline"} size={20} color="#1A2E66" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirmar Senha */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmar Senha</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#1A2E66" />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry={!mostrarConfirmarSenha}
                  editable={!carregando}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}>
                  <Ionicons name={mostrarConfirmarSenha ? "eye-off-outline" : "eye-outline"} size={20} color="#1A2E66" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Botão */}
            <TouchableOpacity
              style={[styles.botaoCadastrar, { backgroundColor: carregando ? '#ccc' : '#3A7456' }]}
              onPress={realizarCadastro}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.botaoCadastrarTexto}>CADASTRAR</Text>
              )}
            </TouchableOpacity>

            {/* Login */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginTexto}>Já tem uma conta? </Text>
              <TouchableOpacity onPress={() => router.push('/')}>
                <Text style={styles.loginLink}>Faça login</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },

  whatsappInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },

  whatsappText: { marginLeft: 5, fontSize: 14, color: '#2C2C2C' },

  tituloContainer: {
    paddingHorizontal: 30,
    marginBottom: 30,
  },

  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A2E66',
    marginBottom: 5,
  },

  subtitulo: {
    fontSize: 15,
    color: '#6D6D6D',
  },

  formContainer: {
    paddingHorizontal: 30,
  },

  inputContainer: { marginBottom: 18 },

  label: {
    fontSize: 15,
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
    height: 50,
  },

  input: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
    color: '#2C2C2C',
  },

  botaoCadastrar: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },

  botaoCadastrarTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },

  loginTexto: {
    color: '#6D6D6D',
  },

  loginLink: {
    color: '#1A2E66',
    fontWeight: '600',
  },
});
