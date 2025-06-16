import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const carregarPreferencia = async () => {
      const configs = await AsyncStorage.getItem('configuracoes');
      if (configs) {
        const { modoEscuro } = JSON.parse(configs);
        setDark(modoEscuro);
      } else {
        // Fallback: usar tema do sistema
        const colorScheme = Appearance.getColorScheme();
        setDark(colorScheme === 'dark');
      }
    };

    carregarPreferencia();
  }, []);

  const toggleTheme = async (value) => {
    setDark(value);
    const configs = await AsyncStorage.getItem('configuracoes');
    const parsed = configs ? JSON.parse(configs) : {};
    parsed.modoEscuro = value;
    await AsyncStorage.setItem('configuracoes', JSON.stringify(parsed));
  };

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
