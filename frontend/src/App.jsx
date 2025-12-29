import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CardPreview from './pages/CardPreview.jsx';
import JoinForm from './pages/join/JoinForm.jsx';
import JoinSuccess from './pages/join/JoinSuccess.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Scanner from './pages/Scanner.jsx' // ✅ 1. Импортируем новый компонент

// Компонент для защиты роутов (без изменений)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-700">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* --- Публичные маршруты --- */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/card/:id" element={<CardPreview />} />
      <Route path="/join/:slug" element={<JoinForm />} />
      <Route path="/join/success" element={<JoinSuccess />} />

      {/* --- Защищенные маршруты --- */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* ✅ 2. Добавляем новый защищенный маршрут для сканера */}
      <Route
        path="/scanner"
        element={
          <ProtectedRoute>
            <Scanner />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App