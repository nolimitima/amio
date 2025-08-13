import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      setIsAuthenticated(!!user);
      setIsLoading(false);
    };
    getUser();

    // Подписка на изменения сессии
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setCurrentUser(session?.user || null);
      setIsAuthenticated(!!session?.user);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Регистрация с company_name в user_metadata
  const signup = async (email, password, companyName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { company_name: companyName } },
    });
    if (error) throw error;
    // Автоматически логинимся после регистрации
    const { data: loginData, error: loginError } = await supabase
      .auth
      .signInWithPassword({ email, password });
    if (loginError) throw loginError;
    setCurrentUser(loginData.user);
    setIsAuthenticated(true);
    return loginData.user;
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setCurrentUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // Обновление названия компании в user_metadata
  const updateOrgName = async (newName) => {
    if (!currentUser) throw new Error('Нет пользователя');
    const { error } = await supabase.auth.updateUser({ data: { company_name: newName } });
    if (error) throw error;
    // Обновляем локального пользователя
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  // Смена пароля
  const changePassword = async (_oldPass, newPass) => {
    if (!currentUser) throw new Error('Нет пользователя');
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) throw error;
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    signup,
    login,
    logout,
    updateOrgName,
    changePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}; 