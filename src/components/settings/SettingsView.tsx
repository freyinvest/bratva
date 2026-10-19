import React, { useEffect, useState } from 'react';
import {
  Bell,
  Volume2,
  Smartphone,
  Shield,
  Database,
  Cloud,
  CheckCircle2,
  Trash2,
  Moon,
  Info,
  Check,
  Zap,
  Lock,
  VolumeX
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { sounds } from '../../utils/sound';
import { enablePushNotifications, disablePushNotifications } from '../../services/pushNotifications';

export const SettingsView: React.FC = () => {
  const {
    soundEnabled,
    setSoundEnabled,
    deviceMode,
    setDeviceMode,
    currentUser
  } = useChat();

  const [cacheCleared, setCacheCleared] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState('');
  const pushPreferenceKey = currentUser.id ? `bratva_push_enabled_${currentUser.id}` : '';
  const [pushEnabled, setPushEnabled] = useState(false);

  // Push permission is per browser/account. Never reuse another signed-in
  // account's local toggle state.
  useEffect(() => {
    setPushEnabled(pushPreferenceKey
      ? localStorage.getItem(pushPreferenceKey) === 'true'
      : false);
    setPushStatus('');
  }, [pushPreferenceKey]);

  const handlePushEnable = async () => {
    if (pushBusy || !pushPreferenceKey) return;
    setPushBusy(true);
    setPushStatus('');
    try {
      // Idempotently obtain the current browser's FCM token and write it to
      // this account's own pushTokens document, even if the UI said "enabled".
      await enablePushNotifications(currentUser.id);
      localStorage.setItem(pushPreferenceKey, 'true');
      setPushEnabled(true);
      setPushStatus('Push-токен зарегистрирован или обновлён для этого аккаунта и браузера. Отправьте новое сообщение, чтобы проверить доставку.');
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : 'Не удалось настроить push-уведомления.');
    } finally {
      setPushBusy(false);
    }
  };

  const handlePushDisable = async () => {
    if (pushBusy || !pushPreferenceKey) return;
    setPushBusy(true);
    setPushStatus('');
    try {
      await disablePushNotifications(currentUser.id);
      localStorage.setItem(pushPreferenceKey, 'false');
      setPushEnabled(false);
      setPushStatus('Push-уведомления отключены на этом устройстве.');
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : 'Не удалось отключить push-уведомления.');
    } finally {
      setPushBusy(false);
    }
  };
  const [selectedTheme, setSelectedTheme] = useState<'dark-emerald' | 'neutral' | 'light-blue'>(() => {
    try {
      const saved = localStorage.getItem('bratva-theme');
      return saved === 'light-blue' || saved === 'neutral' ? saved : 'dark-emerald';
    } catch {
      return 'dark-emerald';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = selectedTheme;
    try {
      localStorage.setItem('bratva-theme', selectedTheme);
    } catch {
      // Keep the selected theme for this session if storage is unavailable.
    }
  }, [selectedTheme]);
  const [autoDownload, setAutoDownload] = useState(true);

  const handleTestSound = () => {
    sounds.playReceive();
  };

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto pb-24">
      {/* Top Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-white">Настройки</h2>
          <p className="text-xs text-slate-400">Уведомления, оформление, приватность</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Appearance / theme */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Moon size={13} className="text-emerald-400" />
            Оформление интерфейса
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-pressed={selectedTheme === 'dark-emerald'}
              onClick={() => setSelectedTheme('dark-emerald')}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                selectedTheme === 'dark-emerald' ? 'border-emerald-400 bg-slate-800' : 'border-slate-700 bg-slate-950/50'
              }`}
            >
              <span className="mb-2 flex h-8 overflow-hidden rounded-lg border border-slate-700">
                <span className="w-1/3 bg-slate-950" /><span className="w-1/3 bg-slate-900" /><span className="w-1/3 bg-emerald-500" />
              </span>
              <span className="block text-xs font-bold text-white">Тёмная</span>
              <span className="block text-[10px] text-slate-400">Изумрудная</span>
            </button>
            <button
              type="button"
              aria-pressed={selectedTheme === 'light-blue'}
              onClick={() => setSelectedTheme('light-blue')}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                selectedTheme === 'light-blue' ? 'border-sky-500 bg-sky-100' : 'border-slate-700 bg-slate-950/50'
              }`}
            >
              <span className="mb-2 flex h-8 overflow-hidden rounded-lg border border-sky-200">
                <span className="w-1/3 bg-sky-50" /><span className="w-1/3 bg-sky-100" /><span className="w-1/3 bg-sky-400" />
              </span>
              <span className={`block text-xs font-bold ${selectedTheme === 'light-blue' ? 'text-sky-950' : 'text-white'}`}>Светло-голубая</span>
              <span className={`block text-[10px] ${selectedTheme === 'light-blue' ? 'text-sky-800' : 'text-slate-400'}`}>Светлая тема</span>
            </button>
            <button
              type="button"
              aria-pressed={selectedTheme === 'neutral'}
              onClick={() => setSelectedTheme('neutral')}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                selectedTheme === 'neutral' ? 'border-slate-400 bg-slate-700' : 'border-slate-700 bg-slate-950/50'
              }`}
            >
              <span className="mb-2 flex h-8 overflow-hidden rounded-lg border border-slate-600">
                <span className="w-1/3 bg-slate-800" /><span className="w-1/3 bg-slate-700" /><span className="w-1/3 bg-slate-500" />
              </span>
              <span className="block text-xs font-bold text-white">Нейтральная</span>
              <span className="block text-[10px] text-slate-400">Средние тона</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Выбор сохраняется на этом устройстве.</p>
        </div>

        {/* Device frame toggle banner */}
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-900/80 border border-slate-800 rounded-3xl space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Режим отображения Android</h3>
              <p className="text-[11px] text-slate-400">Переключение формата предпросмотра</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
            <button
              onClick={() => setDeviceMode('frame')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                deviceMode === 'frame'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📱 Рамка смартфона
            </button>
            <button
              onClick={() => setDeviceMode('fullscreen')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                deviceMode === 'fullscreen'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🖥️ На весь экран
            </button>
          </div>
        </div>

        {/* Notifications & Sounds */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Bell size={13} className="text-emerald-400" />
            Уведомления и звуки
          </h3>

          <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-2xl border border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </div>
              <div>
                <p className="text-xs font-bold text-white">Звуки сообщений</p>
                <p className="text-[11px] text-slate-400">Тактильные звуковые сигналы</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTestSound}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 font-bold transition-colors"
              >
                Тест
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  soundEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800/60 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Push-уведомления</p>
                <p className="text-[11px] text-slate-400">Новые сообщения, когда Братва работает в фоне или закрыта</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" disabled={pushBusy || !currentUser.id} onClick={handlePushEnable}
                  className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 disabled:opacity-50">
                  {pushBusy ? 'Подождите…' : pushEnabled ? 'Обновить регистрацию' : 'Включить'}
                </button>
                {pushEnabled && (
                  <button type="button" disabled={pushBusy || !currentUser.id} onClick={handlePushDisable}
                    className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-slate-700 text-white disabled:opacity-50">
                    Отключить
                  </button>
                )}
              </div>
            </div>
            {pushStatus && <p role="status" className="text-[11px] text-slate-300 break-words">{pushStatus}</p>}
          </div>
        </div>

        {/* Cloud & Firebase Architecture */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Cloud size={13} className="text-emerald-400" />
              Архитектура Firebase Cloud
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
              Готово к работе
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Firebase Authentication</p>
                <p className="text-[11px] text-slate-400">Вход по Email & паролю, Телефон / SMS OTP</p>
              </div>
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Cloud Firestore</p>
                <p className="text-[11px] text-slate-400">Реальное время, групповые и личные диалоги</p>
              </div>
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Firebase Storage & CDN</p>
                <p className="text-[11px] text-slate-400">Быстрая загрузка фото, медиа и голосовых</p>
              </div>
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Lock size={13} className="text-emerald-400" />
            Конфиденциальность
          </h3>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-2xl border border-slate-800/60">
              <div>
                <p className="text-xs font-bold text-white">Автозагрузка медиа</p>
                <p className="text-[11px] text-slate-400">Экономия трафика мобильной сети</p>
              </div>
              <button
                onClick={() => setAutoDownload(!autoDownload)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  autoDownload ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                    autoDownload ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Data & Storage */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Database size={13} className="text-emerald-400" />
            Память и данные
          </h3>

          <button
            onClick={handleClearCache}
            className="w-full flex items-center justify-between p-3 bg-slate-950/60 hover:bg-slate-800/80 rounded-2xl border border-slate-800/80 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-rose-400 flex items-center justify-center">
                <Trash2 size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Очистить кэш медиафайлов</p>
                <p className="text-[11px] text-slate-400">Освобождает место в памяти устройства</p>
              </div>
            </div>
            {cacheCleared ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check size={14} /> Очищено (38.4 МБ)
              </span>
            ) : (
              <span className="text-xs text-slate-500">38.4 МБ</span>
            )}
          </button>
        </div>

        {/* About App */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Shield size={20} />
          </div>
          <h4 className="text-sm font-black text-white">Мессенджер «Братва»</h4>
          <p className="text-xs text-slate-400">
            Версия 2.4.0 (Android Edition)
          </p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Создано для верных друзей, честного общения, решения общих задач и поддержки связи в любой точке мира.
          </p>
        </div>
      </div>
    </div>
  );
};
