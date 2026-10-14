import { User, Chat, Message, Story, FriendRequest } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-belyi',
    name: 'Саша Белый',
    nickname: '@belyi',
    phone: '+7 999 111-01-01',
    email: 'belyi@bratva.io',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Слово дал — держи. Братство превыше всего.',
    status: 'online',
    lastSeen: 'в сети',
    badge: 'Основатель'
  },
  {
    id: 'user-kosmos',
    name: 'Космос Холмогоров',
    nickname: '@kosmos',
    phone: '+7 999 222-02-02',
    email: 'kosmos@bratva.io',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: 'Жизнь прекрасна, пока бензин в баке и друзья рядом 🚀',
    status: 'online',
    lastSeen: 'в сети',
    badge: 'Брат'
  },
  {
    id: 'user-pchela',
    name: 'Витя Пчёла',
    nickname: '@pchela',
    phone: '+7 999 333-03-03',
    email: 'pchela@bratva.io',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
    bio: 'Считаю цифры, разруливаю вопросы 💼',
    status: 'away',
    lastSeen: 'был 10 мин назад',
    badge: 'Свой'
  },
  {
    id: 'user-fil',
    name: 'Валера Фил',
    nickname: '@filat',
    phone: '+7 999 444-04-04',
    email: 'fil@bratva.io',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    bio: 'В ринге и в жизни — до конца 🥊',
    status: 'online',
    lastSeen: 'в сети',
    badge: 'Брат'
  },
  {
    id: 'user-olga',
    name: 'Ольга Белова',
    nickname: '@olga_v',
    phone: '+7 999 555-05-05',
    email: 'olga@bratva.io',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio: 'Музыка в сердце 🎻',
    status: 'offline',
    lastSeen: 'была 2 часа назад',
    badge: 'Семья'
  },
  {
    id: 'user-artur',
    name: 'Артур Мартынов',
    nickname: '@artur_m',
    phone: '+7 999 777-77-77',
    email: 'artur@bratva.io',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    bio: 'Юрист по сложным ситуациям. На связи 24/7.',
    status: 'offline',
    lastSeen: 'был вчера в 23:40',
    badge: 'Адвокат'
  }
];

export const INITIAL_CHATS: Chat[] = [
  {
    id: 'chat-bratva-group',
    type: 'group',
    title: 'Братва (Общий сбор) 🤝',
    avatar: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80',
    participants: ['user-belyi', 'user-kosmos', 'user-pchela', 'user-fil'],
    unreadCount: 2,
    isPinned: true,
    updatedAt: '12:45',
    creatorId: 'user-belyi',
    description: 'Наш закрытый круг: Белый, Космос, Пчёла, Фил. Решаем вопросы.',
    lastMessage: {
      text: 'Вечером на базе, есть важный разговор!',
      timestamp: '12:45',
      senderId: 'user-kosmos',
      isRead: false
    }
  },
  {
    id: 'chat-kosmos-direct',
    type: 'direct',
    title: 'Космос Холмогоров',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    participants: ['user-belyi', 'user-kosmos'],
    unreadCount: 1,
    isPinned: true,
    updatedAt: '12:30',
    lastMessage: {
      text: 'Саня, Линкольн забрал из сервиса, мотор шепчет!',
      timestamp: '12:30',
      senderId: 'user-kosmos',
      isRead: false
    }
  },
  {
    id: 'chat-fil-direct',
    type: 'direct',
    title: 'Валера Фил',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    participants: ['user-belyi', 'user-fil'],
    unreadCount: 0,
    isPinned: false,
    updatedAt: '11:15',
    lastMessage: {
      text: 'В 18:00 тренировка, спарринги по боксу, жду тебя.',
      timestamp: '11:15',
      senderId: 'user-fil',
      isRead: true
    }
  },
  {
    id: 'chat-pchela-direct',
    type: 'direct',
    title: 'Витя Пчёла',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
    participants: ['user-belyi', 'user-pchela'],
    unreadCount: 0,
    isPinned: false,
    updatedAt: '09:40',
    lastMessage: {
      text: 'Документы по контракту проверил, всё чисто.',
      timestamp: '09:40',
      senderId: 'user-pchela',
      isRead: true
    }
  },
  {
    id: 'chat-olga-direct',
    type: 'direct',
    title: 'Ольга Белова',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    participants: ['user-belyi', 'user-olga'],
    unreadCount: 0,
    isPinned: false,
    updatedAt: 'Вчера',
    lastMessage: {
      text: 'Саша, не забудь заехать за цветами к вечеру ❤️',
      timestamp: 'Вчера',
      senderId: 'user-olga',
      isRead: true
    }
  },
  {
    id: 'chat-sport-group',
    type: 'group',
    title: 'Бойцовский Клуб «Тайфун» 🥊',
    avatar: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=400&q=80',
    participants: ['user-belyi', 'user-fil', 'user-artur'],
    unreadCount: 0,
    isPinned: false,
    updatedAt: 'Вчера',
    creatorId: 'user-fil',
    description: 'Тренировки, расписание, турниры.',
    lastMessage: {
      text: 'В субботу открытый ковер, всем быть в форме.',
      timestamp: 'Вчера',
      senderId: 'user-fil',
      isRead: true
    }
  }
];

export const INITIAL_MESSAGES: Message[] = [
  // Group chat messages
  {
    id: 'msg-g1',
    chatId: 'chat-bratva-group',
    senderId: 'user-belyi',
    text: 'Братья, салют! Как обстановка по городу?',
    timestamp: '12:10',
    isRead: true,
    reactions: { '🤝': ['user-kosmos', 'user-fil', 'user-pchela'] }
  },
  {
    id: 'msg-g2',
    chatId: 'chat-bratva-group',
    senderId: 'user-fil',
    text: 'Всё спокойно. Зал открыли, ребята тренируются.',
    timestamp: '12:15',
    isRead: true,
    reactions: { '💪': ['user-belyi'] }
  },
  {
    id: 'msg-g3',
    chatId: 'chat-bratva-group',
    senderId: 'user-pchela',
    text: 'По новому объекту все согласовали, бумаги на подписи.',
    timestamp: '12:22',
    isRead: true
  },
  {
    id: 'msg-g4',
    chatId: 'chat-bratva-group',
    senderId: 'user-kosmos',
    imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    text: 'Гляньте какой аппарат пригнали на оценку! Черная стрела 🔥',
    timestamp: '12:35',
    isRead: true,
    reactions: { '🔥': ['user-belyi', 'user-pchela'], '👍': ['user-fil'] }
  },
  {
    id: 'msg-g5',
    chatId: 'chat-bratva-group',
    senderId: 'user-kosmos',
    text: 'Вечером на базе, есть важный разговор!',
    timestamp: '12:45',
    isRead: false
  },

  // Kosmos direct messages
  {
    id: 'msg-k1',
    chatId: 'chat-kosmos-direct',
    senderId: 'user-belyi',
    text: 'Кос, ты где пропал с утра?',
    timestamp: '11:50',
    isRead: true
  },
  {
    id: 'msg-k2',
    chatId: 'chat-kosmos-direct',
    senderId: 'user-kosmos',
    text: 'Был на сервисе, менял масло и тормозные диски.',
    timestamp: '12:05',
    isRead: true
  },
  {
    id: 'msg-k3',
    chatId: 'chat-kosmos-direct',
    senderId: 'user-kosmos',
    imageUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
    text: 'Вот она, красавица!',
    timestamp: '12:12',
    isRead: true,
    reactions: { '🔥': ['user-belyi'] }
  },
  {
    id: 'msg-k4',
    chatId: 'chat-kosmos-direct',
    senderId: 'user-belyi',
    text: 'Отличный вид, береги её.',
    timestamp: '12:20',
    isRead: true
  },
  {
    id: 'msg-k5',
    chatId: 'chat-kosmos-direct',
    senderId: 'user-kosmos',
    text: 'Саня, Линкольн забрал из сервиса, мотор шепчет!',
    timestamp: '12:30',
    isRead: false
  },

  // Fil direct messages
  {
    id: 'msg-f1',
    chatId: 'chat-fil-direct',
    senderId: 'user-fil',
    text: 'Саня, перчатки новые завезли в клуб, из натуральной кожи.',
    timestamp: '10:30',
    isRead: true
  },
  {
    id: 'msg-f2',
    chatId: 'chat-fil-direct',
    senderId: 'user-belyi',
    text: 'Оставь мне пару 14-унцовых.',
    timestamp: '10:45',
    isRead: true
  },
  {
    id: 'msg-f3',
    chatId: 'chat-fil-direct',
    senderId: 'user-fil',
    text: 'В 18:00 тренировка, спарринги по боксу, жду тебя.',
    timestamp: '11:15',
    isRead: true
  }
];

export const INITIAL_STORIES: Story[] = [
  {
    id: 'story-1',
    userId: 'user-kosmos',
    userName: 'Космос',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    caption: 'Ночной выезд по проспекту 🏎️💨',
    timestamp: '20 мин назад',
    isViewed: false
  },
  {
    id: 'story-2',
    userId: 'user-fil',
    userName: 'Фил',
    userAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80',
    caption: 'Утренняя разминка. Дисциплина решает 🥊',
    timestamp: '1 час назад',
    isViewed: false
  },
  {
    id: 'story-3',
    userId: 'user-pchela',
    userName: 'Пчёла',
    userAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
    caption: 'Переговоры в Сити. Всё по плану 💼',
    timestamp: '3 часа назад',
    isViewed: true
  },
  {
    id: 'story-4',
    userId: 'user-olga',
    userName: 'Ольга',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    mediaUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80',
    caption: 'Репетиция в филармонии 🎻',
    timestamp: '5 часов назад',
    isViewed: true
  }
];

export const INITIAL_FRIEND_REQUESTS: FriendRequest[] = [
  {
    id: 'fr-1',
    fromUser: {
      id: 'user-dima',
      name: 'Дмитрий Соколов',
      nickname: '@sokol_d',
      phone: '+7 999 888-12-34',
      email: 'sokol@bratva.io',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
      bio: 'Друг Фила с бокса. Добавьте в чат.',
      status: 'offline',
      badge: 'Новичок'
    },
    toUserId: 'user-belyi',
    createdAt: 'Сегодня в 10:20',
    status: 'pending'
  }
];

export const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=300&q=80',
];
