// src/pages/Scanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../supabaseClient.js";

// Helper: Smart Rounding (max 2 decimals, no trailing zeros)
const smartRound = (value) => Math.round(value * 100) / 100;

const Scanner = () => {
  const { currentUser } = useAuth();
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");

  // Terminal Modal State
  const [showTerminal, setShowTerminal] = useState(false);
  const [scannedCard, setScannedCard] = useState(null);
  const [billAmount, setBillAmount] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [cashbackPercent, setCashbackPercent] = useState(5); // default

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

  // Fetch client card data and open Terminal modal
  const handleScan = async (qrValue) => {
    setError(null);

    try {
      // Fetch card WITH template bonus info
      const { data: cardData, error: cardError } = await supabase
        .from('issued_cards')
        .select('uuid, guest_name, balance, email, phone, card_template_id, card_templates(bonus_percent_field)')
        .eq('uuid', qrValue)
        .single();

      if (cardError || !cardData) throw new Error("Карта не найдена");

      // Hardcoded fallback if card template has no bonus_percent_field
      const FALLBACK_PERCENT = 0;

      // Use card-specific bonus_percent_field if exists, else fallback
      // Parse bonus_percent_field as integer (stored as string)
      let percent = FALLBACK_PERCENT;
      if (cardData.card_templates?.bonus_percent_field) {
        const parsed = parseInt(cardData.card_templates.bonus_percent_field, 10);
        if (!isNaN(parsed)) {
          percent = parsed;
        }
      }
      setCashbackPercent(percent);

      // Pause scanner and open Terminal modal
      if (scannerRef.current) {
        scannerRef.current.pause();
      }

      setScannedCard(cardData);
      setShowTerminal(true);
      setBillAmount("");
      setUsePoints(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const trimmedInput = manual.trim();
    if (!trimmedInput) return;

    // Strip spaces and check if it looks like a phone number
    const strippedInput = trimmedInput.replace(/\s+/g, "");
    const isPhone = /^\d+$/.test(strippedInput);

    try {
      // Fetch card WITH template bonus info
      const { data: cardData, error: cardError } = await supabase
        .from('issued_cards')
        .select('uuid, guest_name, balance, email, phone, card_template_id, card_templates(bonus_percent_field)')
        .or(isPhone ? `phone.eq.${strippedInput}` : `uuid.eq.${strippedInput}`)
        .single();

      if (cardError || !cardData) throw new Error("Карта не найдена");

      // Hardcoded fallback if card template has no bonus_percent_field
      const FALLBACK_PERCENT = 0;

      // Use card-specific bonus_percent_field if exists, else fallback
      let percent = FALLBACK_PERCENT;
      if (cardData.card_templates?.bonus_percent_field) {
        const parsed = parseInt(cardData.card_templates.bonus_percent_field, 10);
        if (!isNaN(parsed)) {
          percent = parsed;
        }
      }
      setCashbackPercent(percent);

      setScannedCard(cardData);
      setShowTerminal(true);
      setBillAmount("");
      setUsePoints(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProcessPayment = async () => {
    if (!billAmount || parseFloat(billAmount) <= 0) {
      setError("Введите сумму покупки");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get JWT token from Supabase session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Не авторизован. Пожалуйста, войдите снова.");
      }

      const token = sessionData.session.access_token;

      // Call the secure /api/transaction endpoint
      const res = await fetch("/api/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: scannedCard.uuid,
          amount: parseFloat(billAmount),
          action: usePoints ? "redeem" : "accrue",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка обработки");

      // Update scanned card with new balance
      setScannedCard({ ...scannedCard, balance: data.new_balance });

      // Show success notification
      const message = usePoints
        ? `Списано ${Math.abs(data.points_change)} бонусов`
        : `Начислено +${data.points_change} бонусов`;

      setNotification({ type: "success", message });

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowTerminal(false);
        setNotification(null);
        setScannedCard(null);
        // Resume camera if it was scanning
        if (scannerRef.current) {
          scannerRef.current.resume();
        }
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseTerminal = () => {
    setShowTerminal(false);
    setScannedCard(null);
    setError(null);
    // Resume camera
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  // Calculate points or payment amount in real-time
  const calculateResult = () => {
    const amount = parseFloat(billAmount) || 0;
    if (amount <= 0) return null;

    if (usePoints) {
      // Redeem mode: use points and earn cashback on cash remainder
      const balance = scannedCard?.balance || 0;
      const points_to_redeem = smartRound(Math.min(balance, amount));
      const cash_remainder = smartRound(amount - points_to_redeem);
      const earned_points = smartRound(cash_remainder * cashbackPercent / 100);
      const net_change = smartRound(earned_points - points_to_redeem);

      return {
        type: "redeem",
        toPay: cash_remainder,
        pointsUsed: points_to_redeem,
        pointsEarned: earned_points,
        netChange: net_change
      };
    } else {
      // Accrue mode: calculate points from amount with decimal precision
      const points = smartRound(amount * cashbackPercent / 100);
      return { type: "accrue", value: points, label: "Будет начислено" };
    }
  };

  const calculation = calculateResult();

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
          className="flex-1 border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white placeholder-gray-400"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 rounded">
          OK
        </button>
      </form>

      {error && <div className="text-red-600 text-sm mb-3">❌ {error}</div>}

      {/* Terminal Modal */}
      {showTerminal && scannedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-center">💳 POS Терминал</h2>

            {/* Client Info */}
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="text-lg font-semibold">{scannedCard.guest_name}</div>
              <div className="text-sm text-gray-600">
                Баланс: <span className="font-bold text-blue-600">{scannedCard.balance} B</span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Сумма покупки</label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                className="w-full text-3xl border-2 border-gray-300 rounded-lg px-4 py-3 text-center font-bold focus:border-blue-500 focus:outline-none"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                autoFocus
              />
            </div>

            {/* Redeem Toggle */}
            <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg">
              <span className="font-medium">Списать бонусы</span>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usePoints ? "bg-blue-600" : "bg-gray-300"
                  }`}
                onClick={() => setUsePoints(!usePoints)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${usePoints ? "translate-x-6" : "translate-x-1"
                    }`}
                />
              </button>
            </div>

            {/* Real-time Calculation */}
            {calculation && (
              <div className={`mb-4 p-4 rounded-lg ${calculation.type === 'accrue' ? 'bg-green-50 border-2 border-green-300' : 'bg-orange-50 border-2 border-orange-300'
                }`}>
                {calculation.type === 'accrue' ? (
                  // Simple accrue display
                  <div className="text-center">
                    <div className="text-sm text-gray-600">{calculation.label}:</div>
                    <div className="text-3xl font-bold text-green-600">
                      +{calculation.value} B
                    </div>
                  </div>
                ) : (
                  // Detailed redeem breakdown
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Списано бонусов:</span>
                      <span className="font-semibold text-red-600">-{calculation.pointsUsed} B</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">К оплате наличными:</span>
                      <span className="font-semibold text-orange-600">{calculation.toPay} ₸</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Начислено за оплату:</span>
                      <span className="font-semibold text-green-600">+{calculation.pointsEarned} B</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between">
                      <span className="font-bold">Итого изменение:</span>
                      <span className={`font-bold text-lg ${calculation.netChange >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {calculation.netChange >= 0 ? '+' : ''}{calculation.netChange} B
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notification */}
            {notification && (
              <div className={`mb-4 p-3 rounded-lg text-center font-medium ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                ✓ {notification.message}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
                onClick={handleCloseTerminal}
                disabled={processing}
              >
                Отмена
              </button>
              <button
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                onClick={handleProcessPayment}
                disabled={processing || !billAmount}
              >
                {processing ? "Обработка..." : "Провести оплату"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;