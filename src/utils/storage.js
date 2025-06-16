import AsyncStorage from '@react-native-async-storage/async-storage';

export const salvarToken = async (token) => {
  await AsyncStorage.setItem('token', token);
};

export const obterToken = async () => {
  return await AsyncStorage.getItem('token');
};

export const removerToken = async () => {
  await AsyncStorage.removeItem('token');
};