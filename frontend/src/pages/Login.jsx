import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logoWhite from '../assets/logo-white.png';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Пожалуйста, введите корректный email адрес');
      return;
    }

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="font-[Inter] bg-[#F1EFED] min-h-screen w-full">
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md">
          {/* Form Container */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <img
                  src={logoWhite}
                  alt="Amio logo"
                  className="h-16 w-16 object-contain cursor-pointer hover:opacity-80 transition-opacity duration-200"
                  onClick={() => navigate('/')}
                />
              </div>
              <h1 className="text-2xl font-light text-[#121E1D] mb-2">Добро пожаловать</h1>
              <p className="text-[#232823] font-extralight">Войдите в свой аккаунт</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-light text-[#121E1D] mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#121E1D]/20 bg-white/50 backdrop-blur-sm text-[#121E1D] placeholder-[#232823]/60 font-light focus:outline-none focus:ring-2 focus:ring-[#D1E889]/50 focus:border-transparent transition-all duration-200"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-light text-[#121E1D] mb-2">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#121E1D]/20 bg-white/50 backdrop-blur-sm text-[#121E1D] placeholder-[#232823]/60 font-light focus:outline-none focus:ring-2 focus:ring-[#D1E889]/50 focus:border-transparent transition-all duration-200"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm font-light bg-red-50/50 rounded-lg p-3 border border-red-200/50">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] font-light rounded-xl py-3 px-6 transition-all duration-200 shadow-md shadow-[#D1E889]/20 hover:shadow-lg hover:shadow-[#D1E889]/30 transform hover:-translate-y-0.5"
              >
                Войти
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-[#232823] font-extralight">
                Нет аккаунта?{' '}
                <Link
                  to="/signup"
                  className="text-[#121E1D] font-light hover:text-[#D1E889] transition-colors duration-200 underline decoration-[#D1E889]/30 hover:decoration-[#D1E889]"
                >
                  Создать
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
