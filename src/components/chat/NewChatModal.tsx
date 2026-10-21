import React, { useState } from 'react';
import { X, Users, MessageSquarePlus, Check, Search, Sparkles, Upload } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { PRESET_AVATARS } from '../../data/mockData';
import { uploadAvatarIfNeeded } from '../../services/avatarStorage';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose }) => {
  const { allUsers, currentUser, createGroupChat, startDirectChat } = useChat();
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [search, setSearch] = useState('');

  // Group creation state
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedGroupAvatar, setSelectedGroupAvatar] = useState(
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80'
  );
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [avatarUploadError, setAvatarUploadError] = useState('');
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  if (!isOpen) return null;

  const friends = allUsers.filter(u => u.id !== currentUser.id);

  const filteredFriends = friends.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.nickname.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search)
  );

  const toggleSelectUser = (id: string) => {
    setSelectedParticipantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleStartDirect = (userId: string) => {
    startDirectChat(userId);
    onClose();
  };

  const handleGroupAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarUploadError('');
    if (!file.type.startsWith('image/')) {
      setAvatarUploadError('Выберите файл изображения.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarUploadError('Файл слишком большой. Максимум — 10 МБ.');
      return;
    }

    setIsProcessingAvatar(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setAvatarUploadError('Не удалось прочитать файл. Попробуйте другое изображение.');
      setIsProcessingAvatar(false);
    };
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => {
        setAvatarUploadError('Не удалось открыть изображение.');
        setIsProcessingAvatar(false);
      };
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 320;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          setAvatarUploadError('Не удалось обработать изображение.');
          setIsProcessingAvatar(false);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        // Keep the avatar small enough to store with the group document in Firestore.
        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        if (dataUrl.length > 700_000) {
          setAvatarUploadError('Изображение не удалось уменьшить до нужного размера. Выберите другое.');
          setIsProcessingAvatar(false);
          return;
        }
        setSelectedGroupAvatar(dataUrl);
        setIsProcessingAvatar(false);
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim() || isProcessingAvatar || isCreatingGroup) return;
    setAvatarUploadError('');
    setIsCreatingGroup(true);
    try {
      const storedAvatar = await uploadAvatarIfNeeded(selectedGroupAvatar);
      createGroupChat(groupTitle, selectedParticipantIds, storedAvatar, groupDescription);
      onClose();
    } catch (error) {
      setAvatarUploadError(error instanceof Error ? error.message : 'Не удалось сохранить аватар группы. Попробуйте ещё раз.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const presetGroupAvatars = [
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=400&q=80',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              {tab === 'direct' ? <MessageSquarePlus size={18} /> : <Users size={18} />}
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base">
                {tab === 'direct' ? 'Новое сообщение' : 'Создать группу братвы'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {tab === 'direct' ? 'Выберите собеседника' : 'Общий сбор для друзей'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 p-1.5 m-3 bg-slate-950/80 rounded-2xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setTab('direct')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              tab === 'direct' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquarePlus size={15} />
            Личный чат
          </button>
          <button
            type="button"
            onClick={() => setTab('group')}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              tab === 'group' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={15} />
            Групповой чат
          </button>
        </div>

        {tab === 'direct' ? (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Поиск по имени, нику или телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                Контакты ({filteredFriends.length})
              </p>
              {filteredFriends.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleStartDirect(user.id)}
                  className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-800/80 cursor-pointer transition-colors group"
                >
                  <div className="relative">
                    <img
                      src={user.avatar || PRESET_AVATARS[0]}
                      alt={user.name}
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PRESET_AVATARS[0]; }}
                      className="w-11 h-11 rounded-full object-cover border border-slate-700"
                    />
                    {user.status === 'online' && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                        {user.name}
                      </h4>

                    </div>
                    <p className="text-xs text-slate-400 truncate">{user.nickname} • {user.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateGroup} className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Название группы братвы:
              </label>
              <input
                type="text"
                required
                placeholder="Например: Совет Района, Выходные на Волге"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Описание / Цель (необязательно):
              </label>
              <input
                type="text"
                placeholder="Только для своих. Обсуждаем важные вопросы."
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Аватар группы:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {presetGroupAvatars.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedGroupAvatar(img)}
                    className={`aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all relative ${
                      selectedGroupAvatar === img ? 'border-emerald-500 scale-95' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="Avatar" className="w-full h-full object-cover" />
                    {selectedGroupAvatar === img && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <Check size={16} className="text-emerald-400" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                ))}
                <label
                  className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                    selectedGroupAvatar.startsWith('data:image/') ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-slate-600 text-slate-400 hover:border-emerald-500 hover:text-emerald-400'
                  }`}
                  title="Загрузить аватар с компьютера"
                >
                  {selectedGroupAvatar.startsWith('data:image/') ? (
                    <img src={selectedGroupAvatar} alt="Загруженный аватар" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <Upload size={18} />
                      <span className="text-[10px] text-center px-1">С диска</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGroupAvatarUpload}
                    disabled={isProcessingAvatar}
                    className="sr-only"
                    aria-label="Загрузить аватар группы с компьютера"
                  />
                </label>
              </div>
              {isProcessingAvatar && <p className="mt-2 text-[11px] text-slate-400">Обрабатываем изображение…</p>}
              {avatarUploadError && <p role="alert" className="mt-2 text-[11px] text-red-400">{avatarUploadError}</p>}
              {selectedGroupAvatar.startsWith('data:image/') && (
                <button
                  type="button"
                  onClick={() => { setSelectedGroupAvatar(presetGroupAvatars[0]); setAvatarUploadError(''); }}
                  className="mt-2 text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  Вернуть стандартный аватар
                </button>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Добавить участников ({selectedParticipantIds.length}):
                </label>
                <span className="text-[11px] text-emerald-400">
                  Вы автоматически в группе
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-950/60 p-2 rounded-2xl border border-slate-800">
                {friends.map((user) => {
                  const isSelected = selectedParticipantIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleSelectUser(user.id)}
                      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-950/40 border border-emerald-500/30' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <img
                        src={user.avatar || PRESET_AVATARS[0]}
                        alt={user.name}
                        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PRESET_AVATARS[0]; }}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{user.nickname}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={!groupTitle.trim() || isProcessingAvatar || isCreatingGroup}
              className="w-full py-3 rounded-2xl bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              {isCreatingGroup ? 'Создаём группу…' : 'Создать группу братвы'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
