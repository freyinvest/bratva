
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import {
  User,
  Chat,
  Message,
  Story,
  FriendRequest,
  AppTab,
  CallState,
} from '../types';
import {
} from '../data/mockData';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { sounds } from '../utils/sound';

interface ChatContextType {
  currentUser: User;
  allUsers: User[];
  chats: Chat[];
  messages: Message[];
  stories: Story[];
  friendRequests: FriendRequest[];
  activeChatId: string | null;
  activeChat: Chat | null;
  activeTab: AppTab;
  callState: CallState | null;
  viewingStory: Story | null;
  previewImage: string | null;
  chatFilter: 'all' | 'direct' | 'groups' | 'unread';
  isTypingUserId: string | null;
  soundEnabled: boolean;
  deviceMode: 'frame' | 'fullscreen';
  isAuthModalOpen: boolean;

  setActiveTab: (tab: AppTab) => void;
  setActiveChatId: (id: string | null) => void;
  setChatFilter: (filter: 'all' | 'direct' | 'groups' | 'unread') => void;
  setViewingStory: (story: Story | null) => void;
  setPreviewImage: (url: string | null) => void;
  setDeviceMode: (mode: 'frame' | 'fullscreen') => void;
  setSoundEnabled: (enabled: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;

  sendMessage: (
    chatId: string,
    text?: string,
    imageUrl?: string,
    replyTo?: Message['replyToMessage']
  ) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  deleteMessage: (messageId: string) => void;
  createGroupChat: (
    title: string,
    participantIds: string[],
    avatar?: string,
    description?: string
  ) => string;
  startDirectChat: (targetUserId: string) => string;
  addFriend: (targetUserId: string) => void;
  acceptFriendRequest: (requestId: string) => void;
  declineFriendRequest: (requestId: string) => void;
  updateProfile: (updated: Partial<User>) => void;
  loginAsUser: (userId: string) => void;
  setAuthenticatedUser: (user: User) => void;
  logout: () => Promise<void>;
  registerUser: (data: {
    name: string;
    nickname: string;
    phone: string;
    email: string;
    avatar?: string;
    bio?: string;
  }) => void;
  startCall: (targetUser: User, type: 'audio' | 'video') => void;
  endCall: () => void;
  toggleCallMute: () => void;
  toggleCallVideo: () => void;
  pinChat: (chatId: string) => void;
  muteChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  markChatAsRead: (chatId: string) => void;
  addStory: (mediaUrl: string, caption?: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Больше не добавляем демо-профили в список пользователей.
const EMPTY_USER: User = {
  id: '',
  name: '',
  nickname: '',
  phone: '',
  email: '',
  avatar: '',
  bio: '',
  status: 'offline',
  lastSeen: '',
  badge: '',
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('bratva_users');

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Не восстанавливаем встроенные демо-профили.
          return parsed.filter(
            (user: User) =>
              user &&
              typeof user.id === 'string' &&
              !user.id.startsWith('user-belyi') &&
              !user.id.startsWith('user-kosmos') &&
              !user.id.startsWith('user-pchela') &&
              !user.id.startsWith('user-fil') &&
              !user.id.startsWith('user-olga') &&
              !user.id.startsWith('user-artur')
          );
        }
      }
    } catch (error) {
      console.error('Не удалось прочитать локальных пользователей:', error);
    }

    return [];
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('bratva_current_user_id') || '';
  });

  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const saved = localStorage.getItem('bratva_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('bratva_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const saved = localStorage.getItem('bratva_stories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(() => {
    try {
      const saved = localStorage.getItem('bratva_friend_requests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('chats');
  const [callState, setCallState] = useState<CallState | null>(null);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<
    'all' | 'direct' | 'groups' | 'unread'
  >('all');

  // Сохраняем поле для совместимости с остальными компонентами,
  // но автоматически больше никому не имитируем набор текста.
  const [isTypingUserId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const [deviceMode, setDeviceMode] = useState<'frame' | 'fullscreen'>('frame');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(
    () => !localStorage.getItem('bratva_current_user_id')
  );

  useEffect(() => {
    localStorage.setItem('bratva_users', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem('bratva_current_user_id', currentUserId);
    } else {
      localStorage.removeItem('bratva_current_user_id');
    }
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem('bratva_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('bratva_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('bratva_stories', JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    localStorage.setItem(
      'bratva_friend_requests',
      JSON.stringify(friendRequests)
    );
  }, [friendRequests]);

  const currentUser =
    allUsers.find((user) => user.id === currentUserId) || EMPTY_USER;

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;

  const setSoundEnabled = (val: boolean) => {
    setSoundEnabledState(val);
    sounds.setEnabled(val);
  };

  const markChatAsRead = (chatId: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      )
    );
  };

  // Отправляем только сообщение текущего пользователя.
  // Автоответы и случайные ответы собеседников отключены.
  const sendMessage = (
    chatId: string,
    text?: string,
    imageUrl?: string,
    replyTo?: Message['replyToMessage']
  ) => {
    if (!text?.trim() && !imageUrl) return;
    if (!currentUserId) return;

    const sender = allUsers.find((user) => user.id === currentUserId);
    if (!sender) return;

    const now = new Date();
    const timeStr =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0');

    const newMsg: Message = {
      id: 'msg-' + Date.now(),
      chatId,
      senderId: sender.id,
      text,
      imageUrl,
      timestamp: timeStr,
      isRead: false,
      replyToMessage: replyTo,
      reactions: {},
    };

    sounds.playSend();
    setMessages((prev) => [...prev, newMsg]);

    const previewText = imageUrl ? '📷 Фотография' : text || '';

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              updatedAt: timeStr,
              lastMessage: {
                text: previewText,
                timestamp: timeStr,
                senderId: sender.id,
                isRead: false,
              },
            }
          : chat
      )
    );
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    sounds.playTap();

    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;

        const currentReactions = { ...(message.reactions || {}) };
        const usersForEmoji = currentReactions[emoji] || [];

        if (usersForEmoji.includes(currentUserId)) {
          const updated = usersForEmoji.filter((id) => id !== currentUserId);

          if (updated.length === 0) {
            delete currentReactions[emoji];
          } else {
            currentReactions[emoji] = updated;
          }
        } else {
          currentReactions[emoji] = [...usersForEmoji, currentUserId];
        }

        return { ...message, reactions: currentReactions };
      })
    );
  };

  const deleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
  };

  const createGroupChat = (
    title: string,
    participantIds: string[],
    avatar?: string,
    description?: string
  ): string => {
    if (!currentUserId) return '';

    const creator = allUsers.find((user) => user.id === currentUserId);
    if (!creator) return '';

    const newChatId = 'chat-grp-' + Date.now();
    const now = new Date();
    const timeStr =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0');

    const newChat: Chat = {
      id: newChatId,
      type: 'group',
      title,
      avatar:
        avatar ||
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
      participants: Array.from(new Set([creator.id, ...participantIds])),
      unreadCount: 0,
      isPinned: false,
      updatedAt: timeStr,
      creatorId: creator.id,
      description: description || 'Группа создана пользователем ' + creator.name,
      lastMessage: {
        text: 'Группа «' + title + '» создана',
        timestamp: timeStr,
        senderId: creator.id,
        isRead: true,
      },
    };

    setChats((prev) => [newChat, ...prev]);

    const welcomeMsg: Message = {
      id: 'msg-grp-init-' + Date.now(),
      chatId: newChatId,
      senderId: creator.id,
      text: `Группа «${title}» создана. Приветствуем всех участников! 👊`,
      timestamp: timeStr,
      isRead: true,
    };

    setMessages((prev) => [...prev, welcomeMsg]);
    setActiveChatId(newChatId);

    return newChatId;
  };

  const startDirectChat = (targetUserId: string): string => {
    if (!currentUserId) return '';

    const existing = chats.find(
      (chat) =>
        chat.type === 'direct' &&
        chat.participants.includes(currentUserId) &&
        chat.participants.includes(targetUserId)
    );

    if (existing) {
      setActiveChatId(existing.id);
      setActiveTab('chats');
      return existing.id;
    }

    const targetUser = allUsers.find((user) => user.id === targetUserId);
    if (!targetUser || targetUser.id === currentUserId) return '';

    const creator = allUsers.find((user) => user.id === currentUserId);
    if (!creator) return '';

    const newChatId = 'chat-dir-' + Date.now();
    const now = new Date();
    const timeStr =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0');

    const newChat: Chat = {
      id: newChatId,
      type: 'direct',
      title: targetUser.name,
      avatar: targetUser.avatar,
      participants: [creator.id, targetUserId],
      unreadCount: 0,
      isPinned: false,
      updatedAt: timeStr,
      lastMessage: {
        text: 'Диалог начат',
        timestamp: timeStr,
        senderId: creator.id,
        isRead: true,
      },
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setActiveTab('chats');

    return newChatId;
  };

  const addFriend = (targetUserId: string) => {
    if (!currentUserId || targetUserId === currentUserId) return;

    const targetUser = allUsers.find((user) => user.id === targetUserId);
    if (!targetUser) return;

    const newReq: FriendRequest = {
      id: 'req-' + Date.now(),
      fromUser: targetUser,
      toUserId: currentUserId,
      createdAt: 'Только что',
      status: 'accepted',
    };

    setFriendRequests((prev) => [newReq, ...prev]);
    startDirectChat(targetUserId);
  };

  const acceptFriendRequest = (requestId: string) => {
    const req = friendRequests.find((request) => request.id === requestId);
    if (!req) return;

    setFriendRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? { ...request, status: 'accepted' }
          : request
      )
    );

    startDirectChat(req.fromUser.id);
  };

  const declineFriendRequest = (requestId: string) => {
    setFriendRequests((prev) =>
      prev.filter((request) => request.id !== requestId)
    );
  };

  const updateProfile = (updated: Partial<User>) => {
    if (!currentUserId) return;

    setAllUsers((prev) =>
      prev.map((user) =>
        user.id === currentUserId ? { ...user, ...updated } : user
      )
    );
  };

  // Демо-вход отключён.
  const loginAsUser = (_userId: string) => {
    console.warn('Вход через демо-аккаунты отключён. Используй Firebase.');
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Ошибка выхода из Firebase:', error);
    } finally {
      setCurrentUserId('');
      setActiveChatId(null);
      setIsAuthModalOpen(true);
    }
  };

  // Вызывается после успешной Firebase-аутентификации.
  const setAuthenticatedUser = (user: User) => {
    setAllUsers((prev) => {
      const exists = prev.some((item) => item.id === user.id);

      return exists
        ? prev.map((item) => (item.id === user.id ? user : item))
        : [user, ...prev];
    });

    setCurrentUserId(user.id);
    setActiveChatId(null);
    setIsAuthModalOpen(false);
    sounds.playReceive();
  };

  // Регистрация через эту локальную функцию отключена:
  // пользователь должен регистрироваться через Firebase в AuthModal.
  const registerUser = (_data: {
    name: string;
    nickname: string;
    phone: string;
    email: string;
    avatar?: string;
    bio?: string;
  }) => {
    console.warn('Используй регистрацию через Firebase.');
  };

  const startCall = (targetUser: User, type: 'audio' | 'video') => {
    sounds.playTap();

    setCallState({
      isActive: true,
      type,
      user: targetUser,
      status: 'ringing',
      isMuted: false,
      isVideoOff: false,
      durationSeconds: 0,
    });

    setTimeout(() => {
      setCallState((curr) => {
        if (!curr || !curr.isActive) return null;
        return { ...curr, status: 'connected' };
      });
    }, 2500);
  };

  const endCall = () => {
    sounds.playTap();
    setCallState(null);
  };

  const toggleCallMute = () => {
    setCallState((curr) =>
      curr ? { ...curr, isMuted: !curr.isMuted } : null
    );
  };

  const toggleCallVideo = () => {
    setCallState((curr) =>
      curr ? { ...curr, isVideoOff: !curr.isVideoOff } : null
    );
  };

  const pinChat = (chatId: string) => {
    sounds.playTap();
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, isPinned: !chat.isPinned }
          : chat
      )
    );
  };

  const muteChat = (chatId: string) => {
    sounds.playTap();
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, isMuted: !chat.isMuted }
          : chat
      )
    );
  };

  const deleteChat = (chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    setMessages((prev) => prev.filter((message) => message.chatId !== chatId));

    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  const addStory = (mediaUrl: string, caption?: string) => {
    if (!currentUserId) return;

    const author = allUsers.find((user) => user.id === currentUserId);
    if (!author) return;

    const newStory: Story = {
      id: 'story-' + Date.now(),
      userId: author.id,
      userName: author.name.split(' ')[0],
      userAvatar: author.avatar,
      mediaUrl,
      caption,
      timestamp: 'Только что',
      isViewed: true,
    };

    setStories((prev) => [newStory, ...prev]);
  };

  return (
    <ChatContext.Provider
      value={{
        currentUser,
        allUsers,
        chats,
        messages,
        stories,
        friendRequests,
        activeChatId,
        activeChat,
        activeTab,
        callState,
        viewingStory,
        previewImage,
        chatFilter,
        isTypingUserId,
        soundEnabled,
        deviceMode,
        isAuthModalOpen,
        setActiveTab,
        setActiveChatId,
        setChatFilter,
        setViewingStory,
        setPreviewImage,
        setDeviceMode,
        setSoundEnabled,
        setIsAuthModalOpen,
        sendMessage,
        toggleReaction,
        deleteMessage,
        createGroupChat,
        startDirectChat,
        addFriend,
        acceptFriendRequest,
        declineFriendRequest,
        updateProfile,
        loginAsUser,
        logout,
        setAuthenticatedUser,
        registerUser,
        startCall,
        endCall,
        toggleCallMute,
        toggleCallVideo,
        pinChat,
        muteChat,
        deleteChat,
        markChatAsRead,
        addStory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);

  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }

  return ctx;
};
