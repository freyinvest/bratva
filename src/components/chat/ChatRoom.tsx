import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Image as ImageIcon,
  Mic,
  Reply,
  Trash2,
  CheckCheck,
  Check,
  X,
  Play,
  Pause,
  Users,
  Info
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Message, User } from '../../types';
import { PRESET_AVATARS } from '../../data/mockData';

export const ChatRoom: React.FC = () => {
  const {
    activeChat,
    activeChatId,
    setActiveChatId,
    messages,
    currentUser,
    allUsers,
    sendMessage,
    toggleReaction,
    deleteMessage,
    startCall,
    isTypingUserId,
    setPreviewImage,
    messageError,
    clearMessageError
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatMessages = messages.filter(m => m.chatId === activeChatId);

    // Auto scroll only inside the chat messages container
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatMessages.length, isTypingUserId]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 p-6 text-center">
        <p className="text-sm">Выберите чат для начала общения</p>
      </div>
    );
  }

  // Find recipient if direct chat
  const otherParticipantId = activeChat.participants.find(id => id !== currentUser.id);
  const otherUser = allUsers.find(u => u.id === otherParticipantId);

  const isOtherTyping = isTypingUserId && activeChat.participants.includes(isTypingUserId);
  const typingUser = allUsers.find(u => u.id === isTypingUserId);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !customImageUrl) return;

    sendMessage(
      activeChat.id,
      inputText.trim() || undefined,
      customImageUrl || undefined,
      replyingTo
        ? {
            id: replyingTo.id,
            senderName: allUsers.find(u => u.id === replyingTo.senderId)?.name || 'Пользователь',
            text: replyingTo.text || (replyingTo.imageUrl ? '📷 Фотография' : 'Сообщение')
          }
        : undefined
    );

    setInputText('');
    setCustomImageUrl('');
    setShowImagePrompt(false);
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Выбери файл изображения.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Изображение должно быть не больше 10 МБ.');
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError('Не удалось прочитать изображение. Попробуй ещё раз.');
      setIsUploadingImage(false);
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setUploadError('Не удалось прочитать изображение. Попробуй ещё раз.');
        setIsUploadingImage(false);
        return;
      }
      const image = new Image();
      image.onerror = () => {
        setUploadError('Файл не удалось открыть как изображение.');
        setIsUploadingImage(false);
      };
      image.onload = () => {
        try {
          const maxDimension = 1280;
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas недоступен');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          // Compress photos before caching; large base64 payloads can exceed localStorage quota
          // and crash the whole chat view.
          const compressed = canvas.toDataURL('image/jpeg', 0.68);
          sendMessage(activeChat.id, undefined, compressed);
          setUploadError('');
        } catch (error) {
          console.error('Image processing failed:', error);
          setUploadError('Не удалось подготовить изображение для отправки.');
        } finally {
          setIsUploadingImage(false);
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const presetChatPhotos = [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
  ];

  const emojis = ['😀', '🔥', '🤝', '👍', '🥊', '💪', '🚀', '❤️', '😂', '💯', '👑', '😎', '⚡', '💣'];

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950 text-slate-100 relative">
   
 

    {/* Chat Room Top Bar */}
  {/* Chat Room Top Bar */}
      <div className="shrink-0 p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setActiveChatId(null)}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Назад к списку чатов"
          >
            <ArrowLeft size={20} />
          </button>

          <div
            onClick={() => setShowChatInfo(!showChatInfo)}
            className="flex items-center gap-2.5 cursor-pointer min-w-0 group"
          >
            <div className="relative shrink-0">
              <img
                src={(activeChat.type === 'direct' ? otherUser?.avatar : activeChat.avatar) || activeChat.avatar || PRESET_AVATARS[0]}
                alt={activeChat.type === 'direct' ? otherUser?.name || activeChat.title : activeChat.title}
                onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PRESET_AVATARS[0]; }}
                className="w-10 h-10 rounded-2xl object-cover border border-slate-800 shadow-sm"
              />
              {activeChat.type === 'direct' && otherUser?.status === 'online' && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
              )}
            </div>

            <div className="min-w-0">
              <h2 className="font-bold text-sm text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                {activeChat.type === 'direct' ? otherUser?.name || activeChat.title : activeChat.title}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {isOtherTyping ? (
                  <span className="text-emerald-400 font-semibold animate-pulse">
                    {typingUser?.name.split(' ')[0]} печатает...
                  </span>
                ) : activeChat.type === 'group' ? (
                  `${activeChat.participants.length} участников`
                ) : (
                  otherUser?.lastSeen || 'в сети'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {activeChat.type === 'direct' && otherUser && (
            <>
              <button
                onClick={() => startCall(otherUser, 'audio')}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
                title="Аудиозвонок"
              >
                <Phone size={18} />
              </button>
            </>
          )}

          <button
            onClick={() => setShowChatInfo(!showChatInfo)}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Информация о чате"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* Chat Info Dropdown / Modal */}
      {showChatInfo && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 space-y-3 z-10 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {activeChat.type === 'group' ? 'Информация о группе' : 'Профиль собеседника'}
            </h4>
            <button onClick={() => setShowChatInfo(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {activeChat.description && (
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              {activeChat.description}
            </p>
          )}

          {activeChat.type === 'group' && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400 font-semibold">Участники группы:</p>
              <div className="flex flex-wrap gap-2">
                {activeChat.participants.map(pid => {
                  const u = allUsers.find(x => x.id === pid);
                  if (!u) return null;
                  return (
                    <div key={pid} className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-full text-xs">
                      <img src={u.avatar || PRESET_AVATARS[0]} alt={u.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = PRESET_AVATARS[0]; }} className="w-4 h-4 rounded-full object-cover" />
                      <span className="text-slate-200">{u.name}</span>
                      {u.id === activeChat.creatorId && (
                        <span className="text-[9px] text-emerald-400 font-bold ml-1">Создатель</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeChat.type === 'direct' && otherUser && (
            <div className="space-y-1 text-xs text-slate-300">
              <p><span className="text-slate-500">Никнейм:</span> {otherUser.nickname}</p>
              <p><span className="text-slate-500">Телефон:</span> {otherUser.phone}</p>
              <p><span className="text-slate-500">Статус:</span> {otherUser.bio}</p>
            </div>
          )}
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
        {/* Date separator */}
        <div className="flex justify-center my-2">
          <span className="text-[11px] font-bold text-slate-400 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800 shadow-sm">
            Сегодня
          </span>
        </div>

        {chatMessages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const sender = allUsers.find(u => u.id === msg.senderId);

          return (
            <div
              key={msg.id}
              className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
            >
              {/* Group sender name if incoming */}
              {!isMe && activeChat.type === 'group' && (
                <span className="text-[11px] font-semibold text-emerald-400 ml-1 mb-1">
                  {sender?.name || 'Друг'}
                </span>
              )}

              {/* Message Bubble Container */}
              <div className="relative max-w-[85%] sm:max-w-[70%]">
                <div
                  className={`rounded-2xl p-3 shadow-md relative text-slate-100 ${
                    isMe
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-br-xs'
                      : 'bg-slate-800/95 border border-slate-700/60 rounded-bl-xs'
                  }`}
                >
                  {/* Quoted message if replied */}
                  {msg.replyToMessage && (
                    <div
                      className={`mb-2 p-2 rounded-xl text-xs border-l-2 ${
                        isMe
                          ? 'bg-emerald-900/40 border-emerald-300 text-emerald-100'
                          : 'bg-slate-900/60 border-emerald-400 text-slate-300'
                      }`}
                    >
                      <p className="font-bold text-[11px] opacity-90">{msg.replyToMessage.senderName}</p>
                      <p className="truncate text-[11px]">{msg.replyToMessage.text}</p>
                    </div>
                  )}

                  {/* Image attachment if any */}
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                      <img
                        src={msg.imageUrl}
                        alt="Вложение"
                        onClick={() => setPreviewImage(msg.imageUrl || null)}
                        className="w-full max-h-64 object-cover rounded-xl hover:scale-102 transition-transform duration-200"
                      />
                    </div>
                  )}

                  {/* Voice message mockup if any */}
                  {msg.voiceUrl || msg.voiceDuration ? (
                    <div className="flex items-center gap-2.5 py-1">
                      <button
                        onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                          isMe ? 'bg-white text-emerald-800' : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        {playingVoiceId === msg.id ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                      </button>

                      {/* Waveform bars */}
                      <div className="flex items-center gap-0.5 h-6">
                        {[40, 70, 30, 90, 60, 80, 50, 95, 45, 65, 85, 35, 75, 55].map((height, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full transition-all duration-200 ${
                              playingVoiceId === msg.id ? 'bg-emerald-300 animate-pulse' : 'bg-white/40'
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>

                      <span className="text-[11px] font-mono opacity-80">
                        {playingVoiceId === msg.id ? '0:07' : `0:${msg.voiceDuration || 14}`}
                      </span>
                    </div>
                  ) : null}

                  {/* Message text */}
                  {msg.text && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">
                      {msg.text}
                    </p>
                  )}

                  {/* Bottom info inside bubble: Time & Delivery Status */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMe ? 'text-emerald-100/80' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {isMe && (
                      <span>
                        {msg.isRead ? (
                          <CheckCheck size={14} className="inline text-emerald-200" />
                        ) : (
                          <Check size={14} className="inline opacity-80" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reactions badge row */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                      const hasMyReaction = userIds.includes(currentUser.id);
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                            hasMyReaction
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-bold text-[10px]">{userIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Floating Quick Actions (visible on hover) */}
                <div
                  className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-1.5 py-1 rounded-full border border-slate-700 shadow-lg ${
                    isMe ? '-left-20 -top-4' : '-right-20 -top-4'
                  }`}
                >
                  <button
                    onClick={() => toggleReaction(msg.id, '👍')}
                    className="hover:scale-125 transition-transform text-xs p-1"
                    title="Класс"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => toggleReaction(msg.id, '🔥')}
                    className="hover:scale-125 transition-transform text-xs p-1"
                    title="Огонь"
                  >
                    🔥
                  </button>
                  <button
                    onClick={() => toggleReaction(msg.id, '🤝')}
                    className="hover:scale-125 transition-transform text-xs p-1"
                    title="Братство"
                  >
                    🤝
                  </button>
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="text-slate-400 hover:text-white p-1"
                    title="Ответить"
                  >
                    <Reply size={13} />
                  </button>
                  {isMe && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="text-slate-400 hover:text-rose-400 p-1"
                      title="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator bubble */}
        {isOtherTyping && (
          <div className="flex items-center gap-2">
            <div className="bg-slate-800 rounded-2xl rounded-bl-xs px-3.5 py-2 flex items-center gap-1 text-slate-400 border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Replying banner */}
      {replyingTo && (
        <div className="shrink-0 px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 border-l-2 border-emerald-400 pl-2">
            <div>
              <p className="text-[11px] font-bold text-emerald-400">
                Ответ на сообщение: {allUsers.find(u => u.id === replyingTo.senderId)?.name}
              </p>
              <p className="text-xs text-slate-300 truncate max-w-xs">
                {replyingTo.text || '📷 Фотография'}
              </p>
            </div>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Preset Attach / Image Picker Drawer */}
      {showAttachMenu && (
        <div className="shrink-0 max-h-[30dvh] overflow-y-auto p-3 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-300">Прикрепить фото или медиа:</p>
            <button onClick={() => setShowAttachMenu(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {presetChatPhotos.map((url, i) => (
              <div
                key={i}
                onClick={() => {
                  sendMessage(activeChat.id, undefined, url);
                  setShowAttachMenu(false);
                }}
                className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-slate-700"
              >
                <img src={url} alt="Preset" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5"
            >
              <ImageIcon size={15} />
              Выбрать с устройства
            </button>
            <button
              onClick={() => {
                setShowImagePrompt(true);
                setShowAttachMenu(false);
              }}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5"
            >
              Вставить URL фото
            </button>
          </div>

          {uploadError && <p role="alert" className="px-3 py-2 text-xs text-rose-300">{uploadError}</p>}
          {isUploadingImage && <p role="status" className="px-3 py-2 text-xs text-emerald-300">Подготавливаем изображение…</p>}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
      )}

      {/* Custom URL Image prompt */}
      {showImagePrompt && (
        <div className="shrink-0 p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <input
            type="url"
            placeholder="Вставьте ссылку на изображение (https://...)"
            value={customImageUrl}
            onChange={(e) => setCustomImageUrl(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!customImageUrl.trim()}
            className="px-3 py-2 rounded-xl bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs"
          >
            Отправить
          </button>
          <button
            onClick={() => setShowImagePrompt(false)}
            className="p-2 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Emoji picker drawer */}
      {showEmojiPicker && (
        <div className="shrink-0 max-h-[24dvh] overflow-y-auto p-2.5 bg-slate-900 border-t border-slate-800 flex flex-wrap gap-2">
          {emojis.map((em) => (
            <button
              key={em}
              onClick={() => {
                setInputText(prev => prev + em);
              }}
              className="text-xl p-1.5 hover:bg-slate-800 rounded-lg transition-transform hover:scale-110"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {messageError && (
        <div role="alert" className="shrink-0 px-3 py-2 bg-rose-950/70 border-t border-rose-800 text-xs text-rose-200 flex items-center justify-between gap-2">
          <span>{messageError}</span>
          <button type="button" onClick={clearMessageError} className="text-rose-300 hover:text-white" aria-label="Закрыть сообщение об ошибке"><X size={15} /></button>
        </div>
      )}

      {/* Input Toolbar */}
      <form
        onSubmit={handleSend}
        className="sticky bottom-0 shrink-0 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center gap-2 z-20"
      >
        <button
          type="button"
          onClick={() => {
            setShowAttachMenu(!showAttachMenu);
            setShowEmojiPicker(false);
          }}
          className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-full transition-colors"
          title="Прикрепить фото или файл"
        >
          <Paperclip size={20} />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowEmojiPicker(!showEmojiPicker);
            setShowAttachMenu(false);
          }}
          className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-full transition-colors"
          title="Смайлики"
        >
          <Smile size={20} />
        </button>

        <input
          type="text"
          placeholder="Сообщение..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 min-w-0 bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />

        {inputText.trim() ? (
          <button
            type="submit"
            className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center hover:bg-emerald-400 active:scale-95 transition-all shadow-md shadow-emerald-500/25 shrink-0"
            title="Отправить сообщение"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Simulated voice note send
              sendMessage(activeChat.id, undefined, undefined);
              const now = new Date();
              const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              const voiceMsg: Message = {
                id: 'msg-voice-' + Date.now(),
                chatId: activeChat.id,
                senderId: currentUser.id,
                voiceDuration: 8,
                timestamp: timeStr,
                isRead: false
              };
              // Add voice message
              sendMessage(activeChat.id, 'Голосовое сообщение (0:08)');
            }}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
            title="Голосовое сообщение"
          >
            <Mic size={18} />
          </button>
        )}
      </form>
    </div>
  );
};
