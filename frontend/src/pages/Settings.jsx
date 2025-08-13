import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Settings = () => {
  const navigate = useNavigate();
  const { currentUser, updateOrgName, changePassword } = useAuth();

  const [orgName, setOrgName] = useState(currentUser?.user_metadata?.company_name || '');
  const [orgNameSuccess, setOrgNameSuccess] = useState('');
  const [orgNameError, setOrgNameError] = useState('');

  // Обновляем orgName при изменении userProfile
  useEffect(() => {
    setOrgName(currentUser?.user_metadata?.company_name || '');
  }, [currentUser]);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleOrgNameSave = (e) => {
    e.preventDefault();
    setOrgNameError('');
    setOrgNameSuccess('');
    if (!orgName.trim()) {
      setOrgNameError('Название не может быть пустым');
      return;
    }
    try {
      updateOrgName(orgName.trim());
      setOrgNameSuccess('Название успешно обновлено');
    } catch (e) {
      setOrgNameError(e.message);
    }
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (!oldPassword || !newPassword) {
      setPasswordError('Заполните оба поля');
      return;
    }
    try {
      changePassword(oldPassword, newPassword);
      setPasswordSuccess('Пароль успешно обновлён');
      setOldPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (e) {
      setPasswordError(e.message);
    }
  };

  return (
    <div className="font-[Inter] bg-[#F1EFED] min-h-screen w-full flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-lg bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50">
        <h1 className="text-2xl font-light text-[#121E1D] mb-6">Настройки аккаунта</h1>
        
        {/* Уведомление об отсутствии профиля */}
        {/* Убрать блок с !userProfile */}
        <form onSubmit={handleOrgNameSave} className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-light text-[#121E1D] mb-2">Название организации</label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#121E1D]/20 bg-white/50 text-[#121E1D] placeholder-[#232823]/60 font-light focus:outline-none focus:ring-2 focus:ring-[#D1E889]/50 focus:border-transparent transition-all duration-200"
              autoComplete="organization"
            />
          </div>
          {orgNameError && <div className="text-red-500 text-sm font-light bg-red-50/50 rounded-lg p-3 border border-red-200/50">{orgNameError}</div>}
          {orgNameSuccess && <div className="text-green-600 text-sm font-light bg-green-50/50 rounded-lg p-3 border border-green-200/50">{orgNameSuccess}</div>}
          <button
            type="submit"
            className="bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] font-light rounded-xl py-3 px-6 transition-all duration-200 shadow-md shadow-[#D1E889]/20"
          >
            Сохранить
          </button>
        </form>
        <div className="mb-8">
          <label className="block text-sm font-light text-[#121E1D] mb-2">Email</label>
          <input
            type="text"
            value={currentUser?.email || ''}
            disabled
            className="w-full px-4 py-3 rounded-xl border border-[#121E1D]/20 bg-gray-100 text-[#232823] font-light cursor-not-allowed"
            autoComplete="email"
          />
        </div>
        <div>
          <button
            type="button"
            className="bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] font-light rounded-xl py-3 px-6 transition-all duration-200 shadow-md shadow-[#D1E889]/20 mb-4"
            onClick={() => setShowPasswordForm(v => !v)}
          >
            Изменить пароль
          </button>
          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-light text-[#121E1D] mb-2">Старый пароль</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#121E1D]/20 bg-white/50 text-[#121E1D] font-light focus:outline-none focus:ring-2 focus:ring-[#D1E889]/50 focus:border-transparent transition-all duration-200"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-light text-[#121E1D] mb-2">Новый пароль</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#121E1D]/20 bg-white/50 text-[#121E1D] font-light focus:outline-none focus:ring-2 focus:ring-[#D1E889]/50 focus:border-transparent transition-all duration-200"
                  autoComplete="new-password"
                />
              </div>
              {passwordError && <div className="text-red-500 text-sm font-light bg-red-50/50 rounded-lg p-3 border border-red-200/50">{passwordError}</div>}
              {passwordSuccess && <div className="text-green-600 text-sm font-light bg-green-50/50 rounded-lg p-3 border border-green-200/50">{passwordSuccess}</div>}
              <button
                type="submit"
                className="bg-[#D1E889] hover:bg-[#e6f7a1] text-[#121E1D] font-light rounded-xl py-3 px-6 transition-all duration-200 shadow-md shadow-[#D1E889]/20"
              >
                Обновить пароль
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings; 