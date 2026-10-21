import React, { useEffect, useState } from 'react';
import {
  Edit3,
  Mail,
  AtSign,
  Shield,
  QrCode,
  Bookmark,
  LogOut,
  Camera,
  Check,
  X,
  Sparkles,
  Users,
  MessageSquare,
  Images
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { PRESET_AVATARS } from '../../data/mockData';
import { DEFAULT_AVATAR_URL, resolveAvatarUrl } from '../../utils/avatarUrl';
import { uploadAvatarIfNeeded } from '../../services/avatarStorage';

export const ProfileView: React.FC = () => {
  const {
    currentUser,
    updateProfile,
    allUsers,
    chats,
    messages,
    setIsAuthModalOpen,
    setActiveTab,
    startDirectChat,
    logout
  } = useChat();

  const [isEditing, setIsEditing] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Edit form state
  const [name, setName] = useState(currentUser.name);
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [bio, setBio] = useState(currentUser.bio);
  const [avatar, setAvatar] = useState(currentUser.avatar || '');

useEffect(() => {
  setName(currentUser.name);
  setNickname(currentUser.nickname);
  setBio(currentUser.bio);
  setAvatar(currentUser.avatar || '');
}, [currentUser]);
  const [avatarError, setAvatarError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Выбери файл изображения.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Размер фото должен быть не больше 5 МБ.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const image = new Image();

        image.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 256;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);

          const context = canvas.getContext('2d');
          if (!context) {
            setAvatarError('Не удалось обработать фото.');
            return;
          }

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          setAvatar(canvas.toDataURL('image/jpeg', 0.75));
          setAvatarError('');
        };

        image.onerror = () => setAvatarError('Не удалось прочитать фото.');
        image.src = reader.result;
      }
    };

    reader.onerror = () => setAvatarError('Не удалось загрузить фото.');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const totalPhotos = messages.filter(m => !!m.imageUrl).length;
  const friendsCount = allUsers.length - 1;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAvatarError('');
    setIsSavingProfile(true);
    try {
      const storedAvatar = await uploadAvatarIfNeeded(avatar);
      updateProfile({
        name,
        nickname: nickname.startsWith('@') ? nickname : `@${nickname}`,
        bio,
        avatar: storedAvatar,
      });
      setIsEditing(false);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Не удалось сохранить аватар. Попробуйте ещё раз.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto pb-24">
      {/* Top Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight text-white">Мой профиль</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowQrModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
            title="QR-код профиля"
          >
            <QrCode size={18} />
          </button>
          <button
            onClick={() => {
              setName(currentUser.name);
              setNickname(currentUser.nickname);
              setBio(currentUser.bio);
              setAvatar(currentUser.avatar || '');
              setIsEditing(true);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
            title="Редактировать профиль"
          >
            <Edit3 size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile Header Card */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
          {/* Subtle glow background */}
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

          {/* Large Avatar */}
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-3xl p-1 bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-500 shadow-lg shadow-emerald-500/20">
              <img
                src={resolveAvatarUrl(currentUser.avatar || PRESET_AVATARS[0])}
                alt={currentUser.name}
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_AVATAR_URL; }}
                className="w-full h-full rounded-[22px] object-cover"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] border-2 border-slate-900 uppercase">
              {currentUser.status === 'online' ? 'В сети' : currentUser.lastSeen || 'Не в сети'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <h3 className="text-xl font-extrabold text-white tracking-tight">{currentUser.name}</h3>
          </div>

          <p className="text-xs text-emerald-400 font-semibold mt-0.5">{currentUser.nickname}</p>

          <p className="text-xs text-slate-300 bg-slate-950/80 border border-slate-800/80 rounded-2xl px-4 py-2 mt-3 max-w-xs italic">
            «{currentUser.bio}»
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-1">
              <Users size={16} />
            </div>
            <p className="text-base font-black text-white">{friendsCount}</p>
            <p className="text-[10px] text-slate-400 font-medium">Друзей</p>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mx-auto mb-1">
              <MessageSquare size={16} />
            </div>
            <p className="text-base font-black text-white">{chats.length}</p>
            <p className="text-[10px] text-slate-400 font-medium">Чатов</p>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-1">
              <Images size={16} />
            </div>
            <p className="text-base font-black text-white">{totalPhotos}</p>
            <p className="text-[10px] text-slate-400 font-medium">Медиа</p>
          </div>
        </div>

        {/* Contact Info Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            Контактные данные
          </h4>

           <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-teal-400 flex items-center justify-center shrink-0">
              <Mail size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400">Электронная почта</p>
              <p className="text-xs font-bold text-white truncate">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-indigo-400 flex items-center justify-center shrink-0">
              <AtSign size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400">Никнейм для поиска</p>
              <p className="text-xs font-bold text-white truncate">{currentUser.nickname}</p>
            </div>
          </div>
        </div>

        {/* Quick Menu Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              // Open first available chat or switch tab
              setActiveTab('chats');
            }}
            className="w-full flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Bookmark size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Избранные сообщения</p>
                <p className="text-[11px] text-slate-400">Личные заметки и важные файлы</p>
              </div>
            </div>
            <span className="text-slate-500 text-sm">›</span>
          </button>

          <button
            onClick={() => void logout()}
            className="w-full flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <LogOut size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-white">Выйти из аккаунта</p>
                <p className="text-[11px] text-slate-400">Завершить текущий сеанс</p>
              </div>
            </div>
            <span className="text-slate-500 text-sm">›</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
          <form
            onSubmit={handleSaveProfile}
            className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-4 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-base text-white">Редактирование профиля</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Выберите аватар:
              </label>

  <label className="flex items-center justify-center gap-2 w-full mb-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold cursor-pointer hover:bg-emerald-500/25 transition-colors">
    <Camera size={16} />
    Загрузить своё фото
    <input
      type="file"
      accept="image/*"
      onChange={handleAvatarUpload}
      className="hidden"
    />
  </label>
  {avatarError && (
    <p className="text-xs text-red-400 mb-2">{avatarError}</p>
  )}
  <div className="flex items-center gap-3 mb-3">
    {avatar ? <img src={resolveAvatarUrl(avatar)} alt="Предпросмотр аватара" className="w-14 h-14 rounded-xl object-cover border border-slate-700" onError={() => setAvatarError('Не удалось загрузить выбранный аватар.')} /> : <div className="w-14 h-14 rounded-xl border border-dashed border-slate-600 flex items-center justify-center text-[10px] text-slate-500">Пусто</div>}
    <p className="text-xs text-slate-400">Выбранный аватар всегда находится первым. Можно оставить поле пустым.</p>
  </div>

              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {avatar ? (
                  <button
                    type="button"
                    onClick={() => setAvatar(avatar)}
                    aria-label="Текущий выбранный аватар"
                    title="Выбранный аватар"
                    className="aspect-square rounded-xl overflow-hidden border-2 border-emerald-500 scale-95"
                  >
                    <img src={resolveAvatarUrl(avatar)} alt="Выбранный аватар" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAvatar(''); setAvatarError(''); }}
                    aria-label="Оставить без аватара"
                    title="Без аватара"
                    className="aspect-square rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-800 text-emerald-400 flex items-center justify-center text-[10px]"
                  >Пусто</button>
                )}
                {PRESET_AVATARS.filter((url) => url !== avatar).map((url) => (
                  <button
                    type="button"
                    key={url}
                    onClick={() => setAvatar(url)}
                    aria-label="Выбрать аватар"
                    className="aspect-square rounded-xl overflow-hidden border-2 border-transparent opacity-70 hover:opacity-100 transition-all"
                  >
                    <img src={resolveAvatarUrl(url)} alt="Аватар" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <input
                type="url"
                placeholder="Или ссылка на фото..."
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Имя и фамилия:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Никнейм (@ник):</label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Статус / Цитата братвы:</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/25"
              >
                {isSavingProfile ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xs p-5 text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <h3 className="text-base font-black text-white">{currentUser.name}</h3>
            <p className="text-xs text-emerald-400 font-semibold">{currentUser.nickname}</p>

            <div className="my-4 p-4 bg-white rounded-2xl inline-block shadow-lg">
              <div className="w-36 h-36 border-4 border-slate-900 rounded-lg p-2 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-8 h-8 bg-slate-900 rounded-xs" />
                  <div className="w-8 h-8 bg-slate-900 rounded-xs" />
                </div>
                <div className="flex justify-center items-center py-2">
                  <div className="w-10 h-10 bg-emerald-600 rounded-md flex items-center justify-center text-white font-black text-xs">
                    Б
                  </div>
                </div>
                <div className="flex justify-between">
                  <div className="w-8 h-8 bg-slate-900 rounded-xs" />
                  <div className="w-6 h-6 border-2 border-slate-900 rounded-xs" />
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Покажи этот код другу, чтобы он отсканировал и сразу добавил тебя в «Братве»
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
