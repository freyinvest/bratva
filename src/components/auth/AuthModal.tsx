import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import {
  X, Mail, Lock, User, AtSign,
  ShieldCheck, Camera,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { PRESET_AVATARS } from '../../data/mockData';
import { recoverAvatarImage, resolveAvatarUrl } from '../../utils/avatarUrl';
import { isAvatarUploadCandidate, uploadAvatarIfNeeded } from '../../services/avatarStorage';
import type { User as AppUser } from '../../types';

const AUTH_OPERATION_TIMEOUT_MS = 20_000;

/** Prevent auth forms from spinning forever when Firebase requests never settle. */
function withAuthTimeout<T>(operation: Promise<T>, step: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(
        'Firebase не ответил за 20 секунд на шаг «' + step + '». Проверь соединение и попробуй снова. Если это регистрация, аккаунт мог уже создаться — проверь почту перед повторной попыткой.',
      );
      Object.assign(error, { code: 'app/operation-timeout' });
      reject(error);
    }, AUTH_OPERATION_TIMEOUT_MS);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    setAuthenticatedUser,
  } = useChat();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Выбери файл изображения.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Размер фото должен быть не больше 5 МБ.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setAvatarError('Не удалось прочитать фото.');
        return;
      }
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          setAvatarError('Не удалось обработать фото.');
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setSelectedAvatar(canvas.toDataURL('image/jpeg', 0.75));
        setAvatarError('');
      };
      image.onerror = () => setAvatarError('Не удалось прочитать фото.');
      image.src = reader.result;
    };
    reader.onerror = () => setAvatarError('Не удалось загрузить фото.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const explainAuthError = (error: unknown): string => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';

    switch (code) {
      case 'app/operation-timeout':
        return error instanceof Error ? error.message : 'Запрос к Firebase занял слишком много времени. Попробуй ещё раз.';
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
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (authMode === 'register') {
        let avatarUploadFailed = false;
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

        const credential = await withAuthTimeout(
          createUserWithEmailAndPassword(auth, cleanEmail, password),
          'создание аккаунта',
        );

        await withAuthTimeout(
          updateProfile(credential.user, { displayName: cleanName }),
          'сохранение имени',
        );

        let avatarToSave = selectedAvatar;
        try {
          avatarToSave = await uploadAvatarIfNeeded(selectedAvatar);
        } catch (avatarError) {
          avatarUploadFailed = true;
          console.warn('Avatar upload to R2 failed during registration; keeping the current avatar value.', avatarError);
        }

        const profile: AppUser = {
          id: credential.user.uid,
          name: cleanName,
          nickname: cleanNickname,
          phone: '',
          email: cleanEmail,
          avatar: avatarToSave,
          bio: '',
          status: 'online',
          lastSeen: 'в сети',
          badge: 'Свой',
        };

        await withAuthTimeout(
          setDoc(doc(db, 'users', credential.user.uid), profile),
          'сохранение профиля',
        );
        await withAuthTimeout(
          setDoc(doc(db, 'publicProfiles', credential.user.uid), {
            id: credential.user.uid,
            name: profile.name,
            nickname: profile.nickname,
            nicknameLower: profile.nickname.replace(/^@+/, '').toLowerCase(),
            avatar: profile.avatar,
            bio: profile.bio,
            status: profile.status,
            lastSeen: profile.lastSeen,
            badge: profile.badge,
          }),
          'сохранение публичного профиля',
        );

        let verificationSent = true;
        try {
          await withAuthTimeout(
            sendEmailVerification(credential.user),
            'отправка письма подтверждения',
          );
        } catch (verificationError) {
          verificationSent = false;
          console.warn('The account was created, but Firebase did not confirm the verification email request:', verificationError);
        }
        await signOut(auth);
        setAuthMode('login');
        setSuccessMessage(!verificationSent
          ? 'Аккаунт и профиль созданы. Firebase не подтвердил отправку письма за 20 секунд: оно может прийти с задержкой. Проверь «Спам». Если письма не будет, войди с этим адресом и паролем, чтобы запросить подтверждение повторно.'
          : avatarUploadFailed
            ? 'Аккаунт создан. Письмо для подтверждения отправлено. Аватар пока остался на прежнем адресе; после входа приложение попробует перенести его в R2.'
            : 'Аккаунт создан. Мы отправили письмо для подтверждения адреса. Перейди по ссылке в письме, затем войди. Проверь папку «Спам», если письма нет во входящих.');
      } else {
        const credential = await withAuthTimeout(
          signInWithEmailAndPassword(auth, cleanEmail, password),
          'вход в аккаунт',
        );

        if (!credential.user.emailVerified) {
          let verificationSent = true;
          try {
            await withAuthTimeout(
              sendEmailVerification(credential.user),
              'повторная отправка письма подтверждения',
            );
          } catch (verificationError) {
            verificationSent = false;
            console.warn('Firebase did not confirm the verification email resend:', verificationError);
          }
          await signOut(auth);
          setSuccessMessage(verificationSent
            ? 'Адрес электронной почты ещё не подтверждён. Мы запросили новое письмо. Подтверди адрес и попробуй войти снова.'
            : 'Адрес ещё не подтверждён. Запрос на повторную отправку письма не получил ответ за 20 секунд; письмо может прийти позже. Проверь «Спам» и попробуй войти снова, если письма не будет.');
          return;
        }

        const profileSnapshot = await withAuthTimeout(
          getDoc(doc(db, 'users', credential.user.uid)),
          'чтение профиля',
        );

        if (!profileSnapshot.exists()) {
          setErrorMessage(
            'Аккаунт найден, но профиль не найден в базе. Обратись к администратору.',
          );
          return;
        }

        let profile: AppUser = { ...(profileSnapshot.data() as AppUser), id: credential.user.uid };
        if (isAvatarUploadCandidate(profile.avatar)) {
          try {
            const migratedAvatar = await uploadAvatarIfNeeded(profile.avatar);
            if (migratedAvatar !== profile.avatar) {
              await setDoc(doc(db, 'users', credential.user.uid), { avatar: migratedAvatar }, { merge: true });
              profile = { ...profile, avatar: migratedAvatar };
            }
          } catch (avatarError) {
            console.warn('Legacy profile avatar migration to R2 was skipped:', avatarError);
          }
        }

await withAuthTimeout(
  setDoc(doc(db, 'publicProfiles', credential.user.uid), {
    id: credential.user.uid,
    name: profile.name,
    nickname: profile.nickname,
    nicknameLower: profile.nickname.replace(/^@+/, '').toLowerCase(),
    avatar: profile.avatar,
    bio: profile.bio || '',
    status: profile.status || 'offline',
    lastSeen: profile.lastSeen || '',
    badge: profile.badge || 'Свой',
  }),
  'обновление публичного профиля',
);

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
            <img src="/bratva-logo.svg" alt="" aria-hidden="true" className="w-9 h-9 shrink-0 rounded-2xl shadow-md shadow-emerald-500/25" />
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
              onClick={() => { setAuthMode('login'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === 'login' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setErrorMessage(''); setSuccessMessage(''); }}
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
          {successMessage && (
            <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
              {successMessage}
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
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Выберите готовый аватар или загрузите свой:</label>
                    <label className="mb-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/25">
                      <Camera size={16} />
                      Загрузить своё фото (до 5 МБ)
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    </label>
                    {avatarError && <p role="alert" className="mb-2 text-xs text-red-400">{avatarError}</p>}
                    <div className="mb-3 flex items-center gap-3">
                      <img src={resolveAvatarUrl(selectedAvatar || PRESET_AVATARS[0])} alt="Предпросмотр аватара"
                        onError={(event) => { void recoverAvatarImage(event.currentTarget); }}
                        className="h-14 w-14 rounded-xl border border-slate-700 object-cover" />
                      <p className="text-xs text-slate-400">Так будет выглядеть твой аватар</p>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {PRESET_AVATARS.map((url, i) => (
                        <button
                          key={i} type="button" aria-label={`Выбрать аватар ${i + 1}`}
                          onClick={() => { setSelectedAvatar(url); setAvatarError(''); }}
                          className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                            selectedAvatar === url ? 'border-emerald-500 scale-95' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={resolveAvatarUrl(url)} alt="" onError={(event) => { void recoverAvatarImage(event.currentTarget); }} className="w-full h-full object-cover" />
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
