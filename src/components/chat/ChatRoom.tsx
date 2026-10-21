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
  Users,
  Info,
  FileText,
  FileVideo,
  FileAudio,
  Download
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Message, User } from '../../types';
import { PRESET_AVATARS } from '../../data/mockData';
import { DEFAULT_AVATAR_URL, resolveAvatarUrl } from '../../utils/avatarUrl';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadAvatarIfNeeded } from '../../services/avatarStorage';

const messageOrderTimestamp = (message: Message): number => {
  if (typeof message.createdAtMs === 'number') return message.createdAtMs;
  const match = message.id.match(/^msg-(?:grp-init-)?(\d+)/);
  return match ? Number(match[1]) : 0;
};

export const ChatRoom: React.FC = () => {
  const {
    activeChat,
    activeChatId,
    setActiveChatId,
    chats,
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
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [groupAvatarError, setGroupAvatarError] = useState('');
  const [isUpdatingGroupAvatar, setIsUpdatingGroupAvatar] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Old clients can have different document IDs for the same two-person conversation.
  // Display messages from every direct-chat document for this participant pair.
  const relatedChatIds = activeChat?.type === 'direct'
    ? chats.filter((chat) =>
        chat.type === 'direct' &&
        chat.participants.length === activeChat.participants.length &&
        chat.participants.every((participantId) => activeChat.participants.includes(participantId))
      ).map((chat) => chat.id)
    : activeChatId ? [activeChatId] : [];
  const seenMessageIds = new Set<string>();
  const chatMessages = messages
    .filter((message) => relatedChatIds.includes(message.chatId))
    .filter((message) => {
      if (seenMessageIds.has(message.id)) return false;
      seenMessageIds.add(message.id);
      return true;
    })
    .sort((a, b) => messageOrderTimestamp(a) - messageOrderTimestamp(b));

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

  const handleGroupAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (activeChat.type !== 'group' || activeChat.creatorId !== currentUser.id) {
      setGroupAvatarError('Изменить аватар может только создатель группы.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setGroupAvatarError('Выберите файл изображения.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setGroupAvatarError('Размер файла не должен превышать 10 МБ.');
      return;
    }

    setIsUpdatingGroupAvatar(true);
    setGroupAvatarError('');
    try {
      const jpegDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('Не удалось прочитать изображение.'));
            return;
          }

          const image = new Image();
          image.onerror = () => reject(new Error('Не удалось открыть изображение.'));
          image.onload = () => {
            try {
              const maxDimension = 320;
              const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(image.width * scale));
              canvas.height = Math.max(1, Math.round(image.height * scale));
              const context = canvas.getContext('2d');
              if (!context) {
                reject(new Error('Браузер не смог обработать изображение.'));
                return;
              }
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
              if (dataUrl.length > 700_000) {
                reject(new Error('Не удалось сжать изображение. Выберите другое фото.'));
                return;
              }
              resolve(dataUrl);
            } catch {
              reject(new Error('Не удалось обработать изображение.'));
            }
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });

      const storedAvatar = await uploadAvatarIfNeeded(jpegDataUrl);
      await setDoc(doc(db, 'chats', activeChat.id), { avatar: storedAvatar }, { merge: true });
      setGroupAvatarError('');
    } catch (error) {
      setGroupAvatarError(error instanceof Error ? error.message : 'Не удалось изменить аватар группы.');
    } finally {
      setIsUpdatingGroupAvatar(false);
    }
  };

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
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const supportedMimeTypes = ['application/pdf', 'video/mp4', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'video/mpeg'];
    const supportedExtensions = ['pdf', 'mp4', 'wav', 'mpeg', 'mpg', 'mp3'];
    const isImage = file.type.startsWith('image/');
    const isDocumentOrMedia = supportedMimeTypes.includes(file.type.toLowerCase()) || supportedExtensions.includes(extension);
    if (!isImage && !isDocumentOrMedia) {
      setUploadError('Поддерживаются изображения, PDF, MP4, WAV и MPEG.');
      return;
    }
    // Firestore documents are limited to 1 MiB; base64 grows files by roughly a third.
    const maxBytes = isImage ? 10 * 1024 * 1024 : 500 * 1024;
    if (file.size > maxBytes) {
      setUploadError(isImage ? 'Изображение должно быть не больше 10 МБ.' : 'Документ или медиафайл должен быть не больше 500 КБ.');
      return;
    }
    if (!isImage) {
      setIsUploadingImage(true);
      const reader = new FileReader();
      reader.onerror = () => {
        setUploadError('Не удалось прочитать файл. Попробуй ещё раз.');
        setIsUploadingImage(false);
      };
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          setUploadError('Не удалось прочитать файл. Попробуй ещё раз.');
          setIsUploadingImage(false);
          return;
        }
        const type = file.type || (extension === 'pdf' ? 'application/pdf' : extension === 'mp4' ? 'video/mp4' : extension === 'wav' ? 'audio/wav' : extension === 'mp3' ? 'audio/mpeg' : extension === 'mpeg' || extension === 'mpg' ? 'video/mpeg' : 'application/octet-stream');
        sendMessage(activeChat.id, undefined, undefined, undefined, undefined, undefined, { url: reader.result, name: file.name, type });
        setUploadError('');
        setShowAttachMenu(false);
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
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

  const startOrStopVoiceRecording = async () => {
    if (isRecordingVoice) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setUploadError('Запись голосовых сообщений не поддерживается этим браузером. Откройте сайт по HTTPS или используйте современный браузер.');
      return;
    }

    setUploadError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];
      const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      recorder.ondataavailable = event => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setUploadError('Не удалось записать голосовое сообщение. Проверьте доступ к микрофону.');
        stream.getTracks().forEach(track => track.stop());
        setIsRecordingVoice(false);
        setIsSendingVoice(false);
        if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
        if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        setIsRecordingVoice(false);
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        voiceChunksRef.current = [];
        mediaRecorderRef.current = null;
        if (blob.size < 500) {
          setIsSendingVoice(false);
          setUploadError('Запись слишком короткая. Удерживайте запись хотя бы секунду.');
          return;
        }
        if (blob.size > 650 * 1024) {
          setIsSendingVoice(false);
          setUploadError('Запись получилась слишком большой. Попробуйте записать голосовое короче.');
          return;
        }
        setIsSendingVoice(true);
        const reader = new FileReader();
        reader.onerror = () => {
          setIsSendingVoice(false);
          setUploadError('Не удалось подготовить аудио к отправке. Попробуйте ещё раз.');
        };
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            setIsSendingVoice(false);
            setUploadError('Не удалось подготовить аудио к отправке.');
            return;
          }
          sendMessage(activeChat.id, undefined, undefined, undefined, reader.result, duration);
          setIsSendingVoice(false);
          setUploadError('');
        };
        reader.readAsDataURL(blob);
      };
      recorder.start(250);
      setIsRecordingVoice(true);
      setIsSendingVoice(false);
      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= 30 && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 250);
    } catch (error) {
      console.error('Не удалось начать запись голоса:', error);
      setUploadError('Нет доступа к микрофону. Разрешите использование микрофона в настройках браузера.');
      setIsRecordingVoice(false);
      setIsSendingVoice(false);
    }
  };

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    audioStreamRef.current?.getTracks().forEach(track => track.stop());
    audioStreamRef.current = null;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }, []);

  const emojis = ['😀', '🔥', '🤝', '👍', '🥊', '💪', '🚀', '❤️', '😂', '💯', '👑', '😎', '⚡', '💣', '🐸', '😈', '🤡', '🍻'];

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
              {activeChat.type === 'direct' || activeChat.avatar ? (
                <img
                  src={resolveAvatarUrl(activeChat.type === 'direct' ? otherUser?.avatar || activeChat.avatar || PRESET_AVATARS[0] : activeChat.avatar)}
                  alt={activeChat.type === 'direct' ? otherUser?.name || activeChat.title : activeChat.title}
                  onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_AVATAR_URL; }}
                  className="w-10 h-10 rounded-2xl object-cover border border-slate-800 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl border border-slate-800 bg-slate-950 text-slate-500 flex items-center justify-center shadow-sm">
                  <Users size={20} />
                </div>
              )}
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

          {activeChat.type === 'group' && activeChat.creatorId === currentUser.id && (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-[11px] text-slate-400 font-semibold">Аватар группы</p>
              <div className="flex items-center gap-3">
                {activeChat.avatar ? (
                  <img
                    src={resolveAvatarUrl(activeChat.avatar)}
                    alt="Аватар группы"
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_AVATAR_URL; }}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-700"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                    <Users size={22} />
                  </div>
                )}
                <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-xs font-semibold text-slate-200 hover:border-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors">
                  <ImageIcon size={16} />
                  {isUpdatingGroupAvatar ? 'Загружаем…' : 'Изменить фото'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGroupAvatarChange}
                    disabled={isUpdatingGroupAvatar}
                    className="sr-only"
                    aria-label="Изменить аватар группы"
                  />
                </label>
              </div>
              {groupAvatarError && <p role="alert" className="text-[11px] text-red-400">{groupAvatarError}</p>}
            </div>
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
                      <img src={resolveAvatarUrl(u.avatar || PRESET_AVATARS[0])} alt={u.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = DEFAULT_AVATAR_URL; }} className="w-4 h-4 rounded-full object-cover" />
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

                  {msg.attachmentUrl && (
                    <div className="mb-2 min-w-[200px] max-w-[280px] rounded-xl border border-slate-600/70 bg-slate-900/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {msg.attachmentType?.includes('pdf') ? <FileText size={22} className="shrink-0 text-rose-300" /> :
                          msg.attachmentType?.startsWith('video/') ? <FileVideo size={22} className="shrink-0 text-sky-300" /> :
                          <FileAudio size={22} className="shrink-0 text-emerald-300" />}
                        <span className="text-xs font-medium break-all">{msg.attachmentName || 'Вложенный файл'}</span>
                      </div>
                      {msg.attachmentType?.startsWith('video/') ? (
                        <video controls preload="metadata" src={msg.attachmentUrl} className="w-full max-h-40 rounded-lg" />
                      ) : msg.attachmentType?.startsWith('audio/') ? (
                        <audio controls preload="metadata" src={msg.attachmentUrl} className="w-full h-9" />
                      ) : null}
                      <a href={msg.attachmentUrl} download={msg.attachmentName || 'attachment'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200">
                        <Download size={14} /> Открыть / скачать
                      </a>
                    </div>
                  )}

                  {/* Real, playable voice message */}
                  {msg.voiceUrl ? (
                    <div className="min-w-[220px] max-w-full py-1">
                      <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold">
                        <Mic size={14} className="shrink-0" />
                        <span>Голосовое сообщение</span>
                        <span className="ml-auto text-[10px] font-mono opacity-75">
                          {Math.floor((msg.voiceDuration || 0) / 60)}:{String((msg.voiceDuration || 0) % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <audio
                        controls
                        preload="metadata"
                        src={msg.voiceUrl}
                        className="w-full h-9 max-w-[280px]"
                        aria-label="Воспроизвести голосовое сообщение"
                      />
                    </div>
                  ) : msg.voiceDuration ? (
                    <div className="flex items-center gap-2 text-xs">
                      <Mic size={14} />
                      <span>Голосовое сообщение недоступно</span>
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

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5"
            >
              <ImageIcon size={15} />
              Выбрать фото или файл
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
          {isUploadingImage && <p role="status" className="px-3 py-2 text-xs text-emerald-300">Подготавливаем вложение…</p>}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,.pdf,.mp4,.wav,.mpeg,.mpg,.mp3,application/pdf,video/mp4,audio/wav,audio/x-wav,audio/mpeg,video/mpeg"
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

        {isRecordingVoice ? (
          <>
            <span className="flex-1 min-w-0 text-sm text-rose-300 font-semibold animate-pulse">
              ● Идёт запись {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')} / 0:30
            </span>
            <button
              type="button"
              onClick={() => mediaRecorderRef.current?.stop()}
              className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center hover:bg-rose-400 active:scale-95 transition-all shrink-0"
              title="Остановить и отправить голосовое сообщение"
              aria-label="Остановить и отправить запись"
            >
              <Send size={18} />
            </button>
          </>
        ) : inputText.trim() ? (
          <button
            type="submit"
            disabled={isSendingVoice}
            className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center hover:bg-emerald-400 active:scale-95 transition-all shadow-md shadow-emerald-500/25 shrink-0 disabled:opacity-50"
            title="Отправить сообщение"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startOrStopVoiceRecording()}
            disabled={isSendingVoice}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 ${isSendingVoice ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'}`}
            title={isSendingVoice ? 'Подготавливаем голосовое сообщение…' : 'Записать голосовое сообщение'}
            aria-label="Записать голосовое сообщение"
          >
            {isSendingVoice ? <span className="text-[10px] font-bold">…</span> : <Mic size={18} />}
          </button>
        )}
      </form>
    </div>
  );
};
