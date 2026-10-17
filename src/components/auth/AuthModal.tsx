import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
  X, Mail, Phone, Lock, User, AtSign,
  ShieldCheck,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { PRESET_AVATARS } from '../../data/mockData';
import type { User as AppUser } from '../../types';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    setAuthenticatedUser,
  } = useChat();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const explainAuthError = (error: unknown): string => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';

    switch (code) {
      case 'auth/email-already-in-use':
        return 'Этот email уже зарегистрирован. Переключись на вкладку «Вход».';
      case 'auth/invalid-email':
        return 'Проверь правильность электронной почты.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Неверная почта или пароль.';
      case 'auth/weak-password':
        return 'Пароль слишком короткий. Используй не менее 6 символов.';
      case 'auth/too-many-requests':
        return 'Слишком много попыток. Подожди немного и попробуй снова.';
      case 'auth/network-request-failed':
        return 'Нет соединения с интернетом. Проверь подключение.';
      case 'permission-denied':
      case 'firestore/permission-denied':
        return 'Firebase запретил доступ к профилю. Проверь правила Firestore.';
      default:
        return error instanceof Error
          ? `Не удалось выполнить вход: ${error.message}`
          : 'Не удалось выполнить действие. Попробуй ещё раз.';
    }
  };

  const handleEmailAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (authMode === 'register') {
        const cleanName = fullName.trim();
        const cleanNickname = `@${nickname.trim().replace(/^@+/, '')}`;

        if (!cleanName || !nickname.trim()) {
          setErrorMessage('Заполни имя и никнейм.');
          return;
        }

        if (password.length < 6) {
          setErrorMessage('Пароль должен содержать не менее 6 символов.');
          return;
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password,
        );

        await updateProfile(credential.user, { displayName: cleanName });

        const profile: AppUser = {
          id: credential.user.uid,
          name: cleanName,
          nickname: cleanNickname,
          phone: phoneNumber.trim(),
          email: cleanEmail,
          avatar: selectedAvatar,
          bio: '',
          status: 'online',
          lastSeen: 'в сети',
          badge: 'Свой',
        };

        await setDoc(doc(db, 'users', credential.user.uid), profile);
        await setDoc(doc(db, 'publicProfiles', credential.user.uid), {
  id: credential.user.uid,
  name: profile.name,
  nickname: profile.nickname,
  nicknameLower: profile.nickname.replace(/^@+/, '').toLowerCase(),
  avatar: profile.avatar,
  bio: profile.bio,
  status: profile.status,
  lastSeen: profile.lastSeen,
  badge: profile.badge,
});
        setAuthenticatedUser(profile);
        setIsAuthModalOpen(false);
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password,
        );

        const profileSnapshot = await getDoc(
          doc(db, 'users', credential.user.uid),
        );

        if (!profileSnapshot.exists()) {
          setErrorMessage(
            'Аккаунт найден, но профиль не найден в базе. Обратись к администратору.',
          );
          return;
        }

        const profile = profileSnapshot.data() as AppUser;

await setDoc(doc(db, 'publicProfiles', credential.user.uid), {
  id: credential.user.uid,
  name: profile.name,
  nickname: profile.nickname,
  nicknameLower: profile.nickname.replace(/^@+/, '').toLowerCase(),
  avatar: profile.avatar,
  bio: profile.bio || '',
  status: profile.status || 'offline',
  lastSeen: profile.lastSeen || '',
  badge: profile.badge || 'Свой',
});

setAuthenticatedUser(profile);
        setIsAuthModalOpen(false);
      }
    } catch (error: unknown) {
      setErrorMessage(explainAuthError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Phone authentication is still a demo flow; it does not send real SMS.



  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/25">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400 font-extrabold text-sm">
                Б
              </div>
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base leading-tight">
                {authMode === 'login' ? 'Вход в «Братву»' : 'Регистрация нового друга'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Защищенный доступ к чатам и контактам
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(false)}
            aria-label="Закрыть окно"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setErrorMessage(''); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === 'login' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setErrorMessage(''); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === 'register' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Регистрация
            </button>
          </div>

          {errorMessage && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

          <>
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Имя и фамилия:</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                      <input
                        type="text" required minLength={2} maxLength={60}
                        placeholder="Например: Саша Белый"
                        value={fullName} onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Никнейм для поиска (@ник):</label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                      <input
                        type="text" required minLength={3} maxLength={30}
                        placeholder="@brat_99"
                        value={nickname} onChange={(e) => setNickname(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Номер телефона:</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                      <input
                        type="tel" required placeholder="+7 (999) 000-00-00"
                        value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Выберите аватар:</label>
                    <div className="grid grid-cols-6 gap-1.5">
                      {PRESET_AVATARS.map((url, i) => (
                        <button
                          key={i} type="button" aria-label={`Выбрать аватар ${i + 1}`}
                          onClick={() => setSelectedAvatar(url)}
                          className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                            selectedAvatar === url ? 'border-emerald-500 scale-95' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Электронная почта:</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input
                    type="email" required autoComplete="email" placeholder="bratva@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Пароль:</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input
                    type="password" required minLength={6}
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="Не менее 6 символов"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                type="submit" disabled={isLoading}
                className="w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-wait text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all mt-3 flex items-center justify-center gap-2"
              >
                <ShieldCheck size={16} />
                {isLoading ? 'Подожди...' : authMode === 'login' ? 'Войти в аккаунт' : 'Завершить регистрацию'}
              </button>
            </form>
          </>
        </div>
      </div>
    </div>
  );
};
