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
  const readerId = "qr-reader";
  const scannerRef = useRef(null);

  useEffect(() => {
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
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [scanning]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleScan = async (qrValue, extra = {}) => {
    try {
      setError(null);
      setResult(null);

      const res = await fetch("/api/scanner/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_value: qrValue,
          operator_id: currentUser?.id || null,
          ...extra,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сканирования");

      setResult(data.card);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manual.trim()) return;
    await handleScan(manual.trim());
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

      <div id={readerId} className="w-full h-64 mb-4 bg-gray-100"></div>

      <form onSubmit={handleManualSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Ввести UUID вручную"
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

          {/* Кнопки списания / начисления */}
          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-1 rounded bg-red-600 text-white"
              onClick={() =>
                handleScan(result.uuid || manual, {
                  action: "redeem",
                  amount: 10,
                })
              }
            >
              −10 B
            </button>

            <button
              className="px-3 py-1 rounded bg-blue-600 text-white"
              onClick={() =>
                handleScan(result.uuid || manual, {
                  action: "add_bonus",
                  amount: 10,
                })
              }
            >
              +10 B
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;
