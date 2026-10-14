import React, { useState, useEffect } from 'react';
import { Plus, X, Heart, Send } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Story } from '../../types';

export const StoriesBar: React.FC = () => {
  const { stories, currentUser, setViewingStory, addStory } = useChat();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStoryUrl, setNewStoryUrl] = useState('');
  const [newStoryCaption, setNewStoryCaption] = useState('');

  const myStory = stories.find(s => s.userId === currentUser.id);

  const presetStoryImages = [
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80',
  ];

  const handleCreateStory = () => {
    if (!newStoryUrl.trim()) return;
    addStory(newStoryUrl, newStoryCaption);
    setShowAddModal(false);
    setNewStoryUrl('');
    setNewStoryCaption('');
  };

  return (
    <>
      <div className="py-2.5 px-3 bg-slate-900/40 border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-1">
          {/* Add story / My Story */}
          <div className="flex flex-col items-center shrink-0 cursor-pointer" onClick={() => myStory ? setViewingStory(myStory) : setShowAddModal(true)}>
            <div className="relative">
              <div className={`w-14 h-14 rounded-full p-0.5 ${myStory ? 'bg-gradient-to-tr from-amber-500 via-emerald-500 to-cyan-500' : 'bg-slate-700/60'}`}>
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddModal(true);
                }}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center border-2 border-slate-900 shadow-md hover:bg-emerald-400 transition-colors"
                title="Добавить историю"
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </div>
            <span className="text-[11px] font-medium text-slate-300 mt-1 max-w-[62px] truncate text-center">
              Ваша история
            </span>
          </div>

          {/* Friends' stories */}
          {stories.filter(s => s.userId !== currentUser.id).map((story) => (
            <div
              key={story.id}
              className="flex flex-col items-center shrink-0 cursor-pointer group"
              onClick={() => setViewingStory(story)}
            >
              <div className={`w-14 h-14 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105 ${
                story.isViewed
                  ? 'bg-slate-700'
                  : 'bg-gradient-to-tr from-emerald-500 via-amber-400 to-indigo-500 shadow-sm shadow-emerald-500/20'
              }`}>
                <div className="w-full h-full rounded-full p-0.5 bg-slate-900">
                  <img
                    src={story.userAvatar}
                    alt={story.userName}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-slate-200 mt-1 max-w-[62px] truncate text-center">
                {story.userName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Story Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-emerald-400 flex items-center gap-2">
                📸 Опубликовать историю
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Поделись моментом с друзьями. Выбери фото или вставь ссылку:
            </p>

            <div className="grid grid-cols-4 gap-2 mb-3">
              {presetStoryImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewStoryUrl(img)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${newStoryUrl === img ? 'border-emerald-500 scale-95' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={img} alt="Preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Ссылка на фото:</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newStoryUrl}
                  onChange={(e) => setNewStoryUrl(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Подпись к фото:</label>
                <input
                  type="text"
                  placeholder="Например: В движении по ночной Москве..."
                  value={newStoryCaption}
                  onChange={(e) => setNewStoryCaption(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newStoryUrl}
                onClick={handleCreateStory}
                className="flex-1 py-2 rounded-xl bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/25"
              >
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const StoryViewerModal: React.FC<{ story: Story; onClose: () => void }> = ({ story, onClose }) => {
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [replyText, setReplyText] = useState('');
  const { sendMessage, startDirectChat } = useChat();

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          onClose();
          return 100;
        }
        return p + 2;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [onClose]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const chatId = startDirectChat(story.userId);
    if (chatId) {
      sendMessage(chatId, `Ответ на историю: ${replyText}`);
    }
    setReplyText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-0 md:p-4 select-none">
      <div className="relative w-full h-full md:max-w-sm md:h-[84vh] md:rounded-3xl overflow-hidden bg-slate-950 flex flex-col justify-between shadow-2xl">
        {/* Story background image */}
        <img
          src={story.mediaUrl}
          alt={story.caption || 'История'}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/80 pointer-events-none" />

        {/* Top bar with progress and header */}
        <div className="relative z-10 p-4 pt-6 space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
            <div
              className="bg-white h-full transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={story.userAvatar}
                alt={story.userName}
                className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400"
              />
              <div>
                <p className="text-white text-sm font-bold leading-tight">{story.userName}</p>
                <p className="text-white/70 text-[11px]">{story.timestamp}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 backdrop-blur-md"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Bottom bar with caption & quick reaction/reply */}
        <div className="relative z-10 p-4 space-y-3">
          {story.caption && (
            <div className="bg-black/50 backdrop-blur-md p-3 rounded-2xl text-white text-sm border border-white/10">
              {story.caption}
            </div>
          )}

          <div className="flex items-center gap-2">
            <form onSubmit={handleSendReply} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                placeholder={`Ответить ${story.userName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full bg-white/15 border border-white/20 backdrop-blur-md rounded-full px-4 py-2 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              {replyText.trim() && (
                <button
                  type="submit"
                  className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0"
                >
                  <Send size={16} />
                </button>
              )}
            </form>

            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-transform active:scale-125 ${
                isLiked ? 'bg-rose-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
