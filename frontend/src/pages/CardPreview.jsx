import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import QRCode from 'react-qr-code';

const CardPreview = () => {
  const { id } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Публичное превью из безопасной VIEW
      const { data, error } = await supabase
        .from('issued_cards_public')
        .select('uuid, guest_name, balance, phone, email')
        .eq('uuid', id)
        .single();
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setCard(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-neutral-700">Загрузка...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">Ошибка: {error}</div>;
  if (!card) return <div className="min-h-screen flex items-center justify-center text-neutral-700">Карта не найдена</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1EFED] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full flex flex-col items-center">
        <img src="/logo.png" alt="Логотип" className="w-20 h-20 mb-4" />
        <h1 className="text-2xl font-light mb-2">{card.guest_name}</h1>
        <div className="text-neutral-700 mb-2">Баланс: <span className="font-medium">{card.balance}</span></div>
        <div className="mb-4">
          <div className="text-xs text-neutral-600 mb-1">QR-код для предъявления</div>
          <QRCode value={`${window.location.origin}/card/${card.uuid}`} size={160} />
        </div>
        <div className="text-xs text-neutral-600 mb-2">ID карты: {card.uuid}</div>
        <div className="text-xs text-neutral-600 mb-2">Телефон: {card.phone}</div>
        <div className="text-xs text-neutral-600 mb-2">Email: {card.email}</div>
        {/* Можно добавить больше инфы по желанию */}
      </div>
    </div>
  );
};

export default CardPreview; 