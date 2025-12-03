// src/pages/Scanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../context/AuthContext.jsx";

const Scanner = () => {
  const { currentUser } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");

  // ✅ ИЗМЕНЕНИЕ 1: Добавлено новое состояние для отслеживания обновления
  const [isUpdating, setIsUpdating] = useState(false);

  const readerId = "qr-reader";
  const scannerRef = useRef(null);

  useEffect(() => {
    // Эта логика остается без изменений
    if (scanning) {
      scannerRef.current = new Html5Qrcode(readerId);
      scannerRef.current
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            await handleScan(decodedText);
            stopScanner();
          }
        )
        .catch((err) => {
          console.error("Camera start error", err);
          setError("Не удалось открыть камеру");
          setScanning(false);
        });
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => { });
      }
    };
  }, [scanning]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => { });
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // ✅ ИЗМЕНЕНИЕ 2: Функция handleScan теперь не сбрасывает результат при обновлении
  const handleScan = async (qrValue, extra = {}) => {
    const isUpdateAction = extra.action === 'redeem' || extra.action === 'add_bonus';

    // Если это действие обновления, ставим флаг и НЕ сбрасываем результат
    if (isUpdateAction) {
      setIsUpdating(true);
    } else {
      // А если это новый скан, то сбрасываем все, как и раньше
      setError(null);
      setResult(null);
    }

    try {
      // Build request body based on whether we have qr_value or phone
      const body = {
        operator_id: currentUser?.id || null,
        ...extra,
      };

      // Add either qr_value or phone (phone comes from extra)
      if (qrValue) {
        body.qr_value = qrValue;
      }

      const res = await fetch("/api/scanner/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сканирования");

      // Устанавливаем результат с новыми данными от сервера
      setResult(data.card);
    } catch (err) {
      setError(err.message);
    } finally {
      // В любом случае убираем флаг обновления
      if (isUpdateAction) {
        setIsUpdating(false);
      }
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const trimmedInput = manual.trim();
    if (!trimmedInput) return;

    // Strip spaces and check if it looks like a phone number (mostly digits)
    const strippedInput = trimmedInput.replace(/\s+/g, '');
    const isPhone = /^\d+$/.test(strippedInput);

    if (isPhone) {
      // Send as phone parameter
      await handleScan('', { phone: strippedInput });
    } else {
      // Send as qr_value (UUID)
      await handleScan(strippedInput);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded-xl">
      <h1 className="text-xl font-semibold mb-4">Сканирование карты</h1>

      {!scanning ? (
        <button
          className="w-full bg-green-600 text-white py-2 rounded mb-4"
          onClick={() => setScanning(true)}
        >
          📷 Запустить сканер
        </button>
      ) : (
        <button
          className="w-full bg-gray-600 text-white py-2 rounded mb-4"
          onClick={stopScanner}
        >
          ⏹ Остановить сканер
        </button>
      )}

      <div id={readerId} className="w-full h-64 mb-1 bg-gray-100"></div>
      <div className="text-xs text-gray-500 mb-3">Наведите камеру на QR-код карты</div>

      <form onSubmit={handleManualSubmit} className="flex gap-2 mb-4">
        <input
          type="tel"
          placeholder="Введите номер телефона (7...)"
          className="flex-1 border rounded px-2 py-1"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 rounded">
          OK
        </button>
      </form>

      {error && <div className="text-red-600 text-sm mb-3">❌ {error}</div>}

      {result && (
        <div className="p-3 border rounded bg-green-50">
          <h2 className="font-medium mb-2">✅ Карта найдена</h2>
          <div>
            <b>Гость:</b> {result.guest_name}
          </div>
          <div>
            <b>Баланс:</b> {result.balance} B
          </div>
          {result.email && (
            <div>
              <b>Email:</b> {result.email}
            </div>
          )}
          {result.phone && (
            <div>
              <b>Телефон:</b> {result.phone}
            </div>
          )}

          {/* ✅ ИЗМЕНЕНИЕ 3: Кнопки теперь блокируются и показывают статус загрузки */}
          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
              disabled={isUpdating}
              onClick={() =>
                handleScan(result.uuid || manual, {
                  action: "redeem",
                  amount: 10,
                })
              }
            >
              {isUpdating ? '...' : '−10 B'}
            </button>

            <button
              className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
              disabled={isUpdating}
              onClick={() =>
                handleScan(result.uuid || manual, {
                  action: "add_bonus",
                  amount: 10,
                })
              }
            >
              {isUpdating ? '...' : '+10 B'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;