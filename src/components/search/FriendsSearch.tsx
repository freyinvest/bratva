import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  Phone,
  MessageSquare,
  QrCode,
  Check,
  X,
  Shield,
  Sparkles,
  Share2,
  Copy
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { User } from '../../types';

export const FriendsSearch: React.FC = () => {
  const {
    allUsers,
    currentUser,
    startDirectChat,
    addFriend,
    friendRequests,
    acceptFriendRequest,
    declineFriendRequest
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'my' | 'global' | 'requests'>('my');
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [quickPhoneInput, setQuickPhoneInput] = useState('');
  const [phoneAddStatus, setPhoneAddStatus] = useState<string | null>(null);

  const pendingRequests = friendRequests.filter(r => r.toUserId === currentUser.id && r.status === 'pending');

  // Filtered users
  const isQueryMatching = (u: User, q: string) => {
    const cleanQuery = q.toLowerCase().replace(/[\s\-\(\)]/g, '');
    const cleanPhone = u.phone.replace(/[\s\-\(\)]/g, '');
    return (
      u.name.toLowerCase().includes(cleanQuery) ||
      u.nickname.toLowerCase().includes(cleanQuery) ||
      (u.email || '').toLowerCase().includes(q.trim().toLowerCase()) ||
      cleanPhone.includes(cleanQuery)
    );
  };

  const myFriends = allUsers.filter(u => u.id !== currentUser.id);

  const displayedUsers = myFriends.filter(u => {
    if (!searchQuery.trim()) return true;
    return isQueryMatching(u, searchQuery);
  });

  const handleCopyProfile = () => {
    navigator.clipboard?.writeText?.(`bratva://user/${currentUser.nickname}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleQuickAddByPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPhoneInput.trim()) return;

    const cleanInput = quickPhoneInput.replace(/[\s\-\(\)]/g, '');
    const found = allUsers.find(u => u.phone.replace(/[\s\-\(\)]/g, '').includes(cleanInput));

    if (found) {
      addFriend(found.id);
      setPhoneAddStatus(`Пользователь ${found.name} найден! Чат открыт.`);
      setTimeout(() => setPhoneAddStatus(null), 3000);
      setQuickPhoneInput('');
    } else {
      setPhoneAddStatus('Пользователь с таким номером пока не найден.');
      setTimeout(() => setPhoneAddStatus(null), 3500);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto pb-24">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-white">Друзья & Поиск</h2>
          <p className="text-xs text-slate-400">Поиск по имени, никнейму или email</p>
        </div>
        <button
          onClick={() => setShowQrModal(true)}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
          title="Мой QR-код"
        >
          <QrCode size={19} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            placeholder="Введите @ник (например @kosmos) или +7 999..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-3 p-1 bg-slate-900 rounded-2xl border border-slate-800/80">
          <button
            onClick={() => setActiveTab('my')}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'my'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Мои друзья ({myFriends.length})
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'global'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Поиск в сети
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-2 text-xs font-bold rounded-xl relative transition-all ${
              activeTab === 'requests'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Заявки
            {pendingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Quick add by phone widget */}
        <form
          onSubmit={handleQuickAddByPhone}
          className="p-3 bg-gradient-to-r from-slate-900 to-slate-900/60 rounded-2xl border border-slate-800 space-y-2"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Phone size={14} className="text-emerald-400" />
            Быстрое добавление по номеру телефона:
          </div>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="+7 (999) 000-00-00"
              value={quickPhoneInput}
              onChange={(e) => setQuickPhoneInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!quickPhoneInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-colors shadow-sm"
            >
              Найти
            </button>
          </div>
          {phoneAddStatus && (
            <p className="text-[11px] text-emerald-400 font-medium animate-fadeIn">
              {phoneAddStatus}
            </p>
          )}
        </form>

        {/* Tab content */}
        {activeTab === 'requests' ? (
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-bold text-slate-400 px-1">
              Входящие приглашения ({pendingRequests.length})
            </h3>
            {pendingRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Shield size={32} className="mx-auto text-slate-600" />
                <p className="text-xs">Новых заявок в друзья пока нет</p>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div
                  key={req.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                >
                  <img
                    src={req.fromUser.avatar}
                    alt={req.fromUser.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{req.fromUser.name}</h4>
                    <p className="text-xs text-slate-400 truncate">{req.fromUser.nickname} • {req.fromUser.phone}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{req.fromUser.bio}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => acceptFriendRequest(req.id)}
                      className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors"
                      title="Принять"
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <button
                      onClick={() => declineFriendRequest(req.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Отклонить"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs font-bold text-slate-400">
                {activeTab === 'my' ? 'Список контактов' : 'Результаты поиска'} ({displayedUsers.length})
              </h3>
            </div>

            {displayedUsers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Search size={32} className="mx-auto text-slate-600" />
                <p className="text-xs">Пользователь не найден</p>
                <p className="text-[11px] text-slate-600">Проверьте правильность никнейма или телефона</p>
              </div>
            ) : (
              displayedUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-3 bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 transition-colors group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
                    />
                    {user.status === 'online' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                        {user.name}
                      </h4>
                      {user.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-800 text-emerald-400 border border-emerald-500/20 font-semibold">
                          {user.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {user.nickname} • {user.phone}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {user.bio}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startDirectChat(user.id)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-slate-700 hover:border-emerald-500 transition-all shadow-sm"
                      title="Написать"
                    >
                      <MessageSquare size={16} />
                    </button>
                    <button
                      onClick={() => addFriend(user.id)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Добавить"
                    >
                      <UserPlus size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* QR Code Profile Sharing Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xs p-5 text-center shadow-2xl relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl mx-auto object-cover border-2 border-emerald-400 shadow-md mb-3"
            />
            <h3 className="text-base font-black text-white">{currentUser.name}</h3>
            <p className="text-xs text-emerald-400 font-semibold">{currentUser.nickname}</p>
            <p className="text-xs text-slate-400 mt-0.5">{currentUser.phone}</p>

            {/* QR Mockup visual */}
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

            <p className="text-xs text-slate-400 mb-4">
              Наведи камеру для быстрого добавления в друзья в «Братве»
            </p>

            <button
              onClick={handleCopyProfile}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedLink ? 'Ссылка скопирована!' : 'Скопировать ссылку на профиль'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
