import React from 'react';
import { X, Download, Share2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const ImageLightbox: React.FC = () => {
  const { previewImage, setPreviewImage } = useChat();

  if (!previewImage) return null;

  return (
    <div
      onClick={() => setPreviewImage(null)}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 select-none animate-in fade-in-50 duration-200"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between z-10" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs font-semibold text-slate-400">Просмотр фото</span>
        <div className="flex items-center gap-2">
          <a
            href={previewImage}
            download="bratva_photo.jpg"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Скачать фото"
          >
            <Download size={18} />
          </a>
          <button
            onClick={() => setPreviewImage(null)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image */}
      <div className="flex-1 flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
        <img
          src={previewImage}
          alt="Фотография"
          className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
        />
      </div>

      <div className="text-center text-xs text-slate-500 py-2">
        Нажмите в любом месте для закрытия
      </div>
    </div>
  );
};
