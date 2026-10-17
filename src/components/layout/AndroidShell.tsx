import React from 'react';
import {
  MessageSquare,
  Users,
  User as UserIcon,
  Settings,
  Maximize2,
  Smartphone
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { ChatList } from '../chat/ChatList';
import { ChatRoom } from '../chat/ChatRoom';
import { FriendsSearch } from '../search/FriendsSearch';
import { ProfileView } from '../profile/ProfileView';
import { SettingsView } from '../settings/SettingsView';
import { CallOverlay } from '../call/CallOverlay';
import { ImageLightbox } from '../media/ImageLightbox';
import { AuthModal } from '../auth/AuthModal';

export const AndroidShell: React.FC = () => {
  const {
    activeChatId,
    activeTab,
    setActiveTab,
    chats,
    friendRequests,
    currentUser,
    deviceMode,
    setDeviceMode
  } = useChat();

  const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const pendingRequestsCount = friendRequests.filter(r => r.toUserId === currentUser.id && r.status === 'pending').length;

  return (
    <div className="w-full h-full min-h-0 bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Quick Desktop Mode Switcher Bar (visible on md screens) */}
      <div className="hidden md:flex items-center gap-3 mb-2 z-30 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-800 text-xs text-slate-300 shadow-md">
        <span className="font-semibold text-emerald-400">«Братва» Android OS</span>
        <span className="text-slate-600">•</span>
        <button
          onClick={() => setDeviceMode('frame')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors ${
            deviceMode === 'frame'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'hover:text-white'
          }`}
        >
          <Smartphone size={13} />
          Рамка смартфона
        </button>
        <button
          onClick={() => setDeviceMode('fullscreen')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors ${
            deviceMode === 'fullscreen'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'hover:text-white'
          }`}
        >
          <Maximize2 size={13} />
          Во весь экран
        </button>
      </div>

      {/* Main Container: Android Bezel Phone or Responsive Edge-to-Edge */}
      <div
        className={`relative flex flex-col bg-slate-950 shadow-2xl transition-all duration-300 overflow-hidden ${
          deviceMode === 'frame'
            ? 'w-full h-[100dvh] min-h-0 md:w-[412px] md:h-[870px] md:rounded-[48px] md:border-[10px] md:border-slate-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]'
            : 'w-full h-[100dvh] min-h-0 max-w-5xl md:border-x md:border-slate-800'
        }`}
      >
        {/* Screen View Area */}
        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          {activeChatId ? (
            <>
              {/* Bratva PRO banner inside chat */}
              <div className="shrink-0 px-3 py-2 border-b border-emerald-500/20 bg-slate-900/95 flex items-center gap-2 z-30">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center">
                  <span className="font-extrabold text-sm text-white">Б</span>
                </div>
                <span className="font-extrabold text-sm text-white">Братва</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PRO</span>
                <span className="ml-auto text-[10px] text-slate-400 truncate">Всегда на связи с близкими</span>
              </div>
              <ChatRoom />
            </>
          ) : (
            <>
              {activeTab === 'chats' && <ChatList />}
              {activeTab === 'friends' && <FriendsSearch />}
              {activeTab === 'profile' && <ProfileView />}
              {activeTab === 'settings' && <SettingsView />}
            </>
          )}
        </div>

        {/* Android Material 3 Bottom Navigation Bar (Hidden when activeChatId is open) */}
        {!activeChatId && (
          <div className="h-16 bg-slate-900/95 border-t border-slate-800/80 flex items-center justify-around px-2 z-20 shrink-0">
            {/* Chats tab */}
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                activeTab === 'chats' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 px-3.5 rounded-full transition-all relative ${
                  activeTab === 'chats' ? 'bg-emerald-500/15' : ''
                }`}
              >
                <MessageSquare size={20} strokeWidth={activeTab === 'chats' ? 2.5 : 2} />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center shadow-sm">
                    {totalUnread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold mt-0.5">Чаты</span>
            </button>

            {/* Friends & Search tab */}
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                activeTab === 'friends' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 px-3.5 rounded-full transition-all relative ${
                  activeTab === 'friends' ? 'bg-emerald-500/15' : ''
                }`}
              >
                <Users size={20} strokeWidth={activeTab === 'friends' ? 2.5 : 2} />
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-1 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center shadow-sm">
                    {pendingRequestsCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold mt-0.5">Друзья</span>
            </button>

            {/* Profile tab */}
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'profile' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 px-3.5 rounded-full transition-all ${
                  activeTab === 'profile' ? 'bg-emerald-500/15' : ''
                }`}
              >
                <UserIcon size={20} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-bold mt-0.5">Профиль</span>
            </button>

            {/* Settings tab */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                activeTab === 'settings' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 px-3.5 rounded-full transition-all ${
                  activeTab === 'settings' ? 'bg-emerald-500/15' : ''
                }`}
              >
                <Settings size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-bold mt-0.5">Настройки</span>
            </button>
          </div>
        )}

        {/* Android Gesture Navigation Pill at Bottom */}
        <div className="h-4 bg-slate-950 flex items-center justify-center shrink-0">
          <div className="w-32 h-1 bg-slate-600/80 rounded-full" />
        </div>

        {/* Overlays */}
        <CallOverlay />
        <ImageLightbox />
        <AuthModal />
      </div>
    </div>
  );
};
