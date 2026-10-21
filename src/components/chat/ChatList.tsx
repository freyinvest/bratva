import React, { useState } from 'react';
import {
  Search,
  Pin,
  VolumeX,
  Trash2,
  MoreVertical,
  CheckCheck,
  Check,
  MessageSquarePlus,
  Shield,
  UserCheck,
  Image as ImageIcon,
  Users,
  Bell,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { NewChatModal } from './NewChatModal';
import { PRESET_AVATARS } from '../../data/mockData';

export const ChatList: React.FC = () => {
  const {
    chats,
    currentUser,
    activeChatId,
    setActiveChatId,
    chatFilter,
    setChatFilter,
    pinChat,
    muteChat,
    deleteChat,
    markChatAsRead,
    startDirectChat,
    allUsers,
    setIsAuthModalOpen
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  );
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  // Collapse duplicate legacy direct chats into one visible row per participant pair.
  const uniqueChats = chats.reduce((result, chat) => {
    if (chat.type !== 'direct' || chat.participants.filter(Boolean).length !== 2) {
      if (!result.some((item) => item.id === chat.id)) result.push(chat);
      return result;
    }
    const participantIds = Array.from(new Set(chat.participants.filter(Boolean))).sort();
    const existingIndex = result.findIndex((item) =>
      item.type === 'direct' &&
      item.participants.length === 2 &&
      JSON.stringify(Array.from(new Set(item.participants.filter(Boolean))).sort()) === JSON.stringify(participantIds)
    );
    if (existingIndex < 0) {
      result.push(chat);
      return result;
    }
    const existing = result[existingIndex];
    const canonicalId = 'direct-' + participantIds.join('-');
    if (chat.id === canonicalId && existing.id !== canonicalId) {
      result[existingIndex] = chat;
    } else if (existing.id !== canonicalId && chat.id !== canonicalId &&
      (chat.updatedAtMs || 0) > (existing.updatedAtMs || 0)) {
      result[existingIndex] = chat;
    }
    return result;
  }, [] as typeof chats);

  // Filter chats
  const filteredChats = uniqueChats
    .filter(chat => {
      // search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = chat.title.toLowerCase().includes(query);
        const matchesLastMsg = chat.lastMessage?.text.toLowerCase().includes(query);
        if (!matchesTitle && !matchesLastMsg) return false;
      }

      // category tab filter
      if (chatFilter === 'direct') return chat.type === 'direct';
      if (chatFilter === 'groups') return chat.type === 'group';
      if (chatFilter === 'unread') return chat.unreadCount > 0;
      return true;
    })
    .sort((a, b) => {
      // Pinned chats first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
    });

  const handleSelectChat = (chatId: string) => {
    const selectedChat = chats.find((chat) => chat.id === chatId);
    if (selectedChat?.type === 'direct') {
      const peerId = selectedChat.participants.find((id) => id && id !== currentUser.id);
      const peer = allUsers.find((user) => user.id === peerId);
      if (peerId && peer) {
        // Opens or migrates a direct conversation onto the stable shared ID.
        const sharedChatId = startDirectChat(peerId, peer);
        if (sharedChatId) {
          markChatAsRead(chatId);
          if (sharedChatId !== chatId) markChatAsRead(sharedChatId);
          return;
        }
      }
    }
    setActiveChatId(chatId);
    markChatAsRead(chatId);
  };

  const getSenderName = (senderId?: string) => {
    if (!senderId) return '';
    if (senderId === currentUser.id) return 'Вы: ';
    const sender = allUsers.find(u => u.id === senderId);
    return sender ? `${sender.name.split(' ')[0]}: ` : '';
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* Top Messenger Bar */}
      <div className="p-3.5 pb-2 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <img src="/bratva-logo.svg" alt="" aria-hidden="true" className="w-10 h-10 shrink-0 rounded-2xl shadow-md shadow-emerald-500/20" />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-lg tracking-tight text-white leading-none">
                Братва
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Всегда на связи с близкими
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
        <button
          onClick={() => void enableNotifications()}
          disabled={notificationPermission === 'denied' || typeof Notification === 'undefined'}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${notificationPermission === 'granted' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40'}`}
          title={notificationPermission === 'granted' ? 'Уведомления браузера включены' : notificationPermission === 'denied' ? 'Разрешите уведомления для сайта в настройках браузера' : 'Включить уведомления браузера'}
          aria-label="Включить уведомления браузера"
        >
          <Bell size={16} />
        </button>
        {/* User profile toggle / switch account button */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center gap-2 p-1 pl-2.5 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 transition-colors shadow-sm"
          title="Сменить профиль или авторизоваться"
        >
          <span className="text-xs font-semibold text-slate-200 max-w-[80px] truncate hidden sm:inline">
            {currentUser.name.split(' ')[0]}
          </span>
          <img
            src={currentUser.avatar || PRESET_AVATARS[0]}
            alt={currentUser.name}
            onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PRESET_AVATARS[0]; }}
            className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
          />
        </button>
        </div>
      </div>


      {/* Search Input Bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            type="text"
            placeholder="Поиск по чатам, контактам, сообщениям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-10 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none">
        {[
          { key: 'all', label: 'Все чаты' },
          { key: 'direct', label: 'Личные' },
          { key: 'groups', label: 'Группы' },
          { key: 'unread', label: 'Непрочитанные' },
        ].map((f) => {
          const isActive = chatFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setChatFilter(f.key as any)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/25'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/60'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Chat List Body */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-24">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-500 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-slate-600">
              <MessageSquarePlus size={28} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">Чаты не найдены</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Создайте новый диалог или группу для братвы'}
              </p>
            </div>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold shadow-md hover:bg-emerald-400 transition-colors"
            >
              Начать общение
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = activeChatId === chat.id;
            const isMenuOpen = activeMenuChatId === chat.id;
            const peerUser = chat.type === 'direct' ? allUsers.find((user) => user.id !== currentUser.id && chat.participants.includes(user.id)) : undefined;
            const avatarSrc = chat.type === 'direct'
              ? peerUser?.avatar || chat.avatar || PRESET_AVATARS[0]
              : chat.avatar;

            return (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                className={`group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-slate-800/90 shadow-md border border-slate-700/60'
                    : 'hover:bg-slate-900/80 border border-transparent'
                }`}
              >
                {/* Chat Avatar with Status */}
                <div className="relative shrink-0">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={chat.title}
                      onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PRESET_AVATARS[0]; }}
                      className="w-13 h-13 rounded-2xl object-cover border border-slate-800 shadow-sm"
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-2xl border border-slate-800 bg-slate-900 text-slate-500 flex items-center justify-center shadow-sm">
                      <Users size={22} />
                    </div>
                  )}
                  {chat.type === 'direct' ? (
                    peerUser?.status === 'online' ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
                    ) : null
                  ) : (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center text-[9px] font-bold">
                      👥
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-bold text-sm text-slate-100 truncate group-hover:text-emerald-400 transition-colors">
                        {chat.type === 'direct' ? peerUser?.name || chat.title : chat.title}
                      </h3>
                      {chat.unreadCount > 0 && (
                        <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-extrabold flex items-center justify-center shadow-sm shadow-emerald-500/30">
                          {chat.unreadCount}
                        </span>
                      )}
                      {chat.isMuted && <VolumeX size={13} className="text-slate-500 shrink-0" />}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {chat.isPinned && <Pin size={12} className="text-emerald-400 rotate-45" />}
                      <span className="text-[11px] text-slate-500 font-medium">
                        {chat.updatedAt}
                      </span>
                    </div>
                  </div>

                  {/* Last message & badges */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      {chat.lastMessage?.senderId === currentUser.id && (
                        <span>
                          {chat.lastMessage?.isRead ? (
                            <CheckCheck size={14} className="text-emerald-400 inline -mt-0.5 mr-0.5" />
                          ) : (
                            <Check size={14} className="text-slate-500 inline -mt-0.5 mr-0.5" />
                          )}
                        </span>
                      )}
                      <span className="font-semibold text-slate-400">
                        {chat.type === 'group' && getSenderName(chat.lastMessage?.senderId)}
                      </span>
                      <span>{chat.lastMessage?.text || 'Нет сообщений'}</span>
                    </p>


                  </div>
                </div>

                {/* Quick Chat Menu Trigger */}
                <div className="shrink-0 relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveMenuChatId(isMenuOpen ? null : chat.id)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                    title="Действия с чатом"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* Popup Menu */}
                  {isMenuOpen && (
                    <div className="absolute right-0 top-8 z-30 w-44 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 text-xs text-slate-200 space-y-1">
                      <button
                        onClick={() => {
                          pinChat(chat.id);
                          setActiveMenuChatId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 transition-colors"
                      >
                        <Pin size={14} className={chat.isPinned ? 'text-emerald-400' : 'text-slate-400'} />
                        {chat.isPinned ? 'Открепить чат' : 'Закрепить чат'}
                      </button>

                      <button
                        onClick={() => {
                          muteChat(chat.id);
                          setActiveMenuChatId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 transition-colors"
                      >
                        <VolumeX size={14} className={chat.isMuted ? 'text-amber-400' : 'text-slate-400'} />
                        {chat.isMuted ? 'Включить звук' : 'Выключить звук'}
                      </button>

                      <button
                        onClick={() => {
                          deleteChat(chat.id);
                          setActiveMenuChatId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 size={14} />
                        Удалить чат
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsNewChatModalOpen(true)}
        className="absolute bottom-20 right-4 z-20 w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
        title="Новый диалог или группа"
      >
        <MessageSquarePlus size={24} strokeWidth={2.3} />
      </button>

      {/* Modal for starting direct / group chats */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
      />
    </div>
  );
};
