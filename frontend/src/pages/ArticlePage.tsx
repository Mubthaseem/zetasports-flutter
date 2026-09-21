import React from 'react';
import { NewsItem, NewsArticle } from '../types.js';
import { DataAPI } from '../services/api.js';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Share2,
  ExternalLink,
  BookOpen,
  Check,
  ChevronRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface Props {
  articleItem: NewsItem;
  onBack: () => void;
  onSelectArticle: (item: NewsItem) => void;
  relatedNews?: NewsItem[];
}

function calculateReadingTime(paragraphs: string[]): string {
  const totalWords = paragraphs.join(' ').split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(totalWords / 200));
  return `${minutes} min read`;
}

function formatPublishDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export const ArticlePage: React.FC<Props> = ({
  articleItem,
  onBack,
  onSelectArticle,
  relatedNews = []
}) => {
  const [fullArticle, setFullArticle] = React.useState<NewsArticle | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [copied, setCopied] = React.useState<boolean>(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(true);
    async function loadArticle() {
      try {
        const data = await DataAPI.getNewsArticle(articleItem.id);
        if (data) {
          setFullArticle(data);
        }
      } catch (err) {
        console.warn('Failed to load full article:', err);
      } finally {
        setLoading(false);
      }
    }
    loadArticle();
  }, [articleItem.id]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: articleItem.title,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const paragraphs = fullArticle?.paragraphs && fullArticle.paragraphs.length > 0
    ? fullArticle.paragraphs
    : [articleItem.description];

  const sourceUrl = fullArticle?.sourceUrl || articleItem.sourceUrl;
  const externalLink = sourceUrl.startsWith('http')
    ? sourceUrl
    : `https://www.fotmob.com${sourceUrl}`;

  const otherArticles = relatedNews.filter(n => n.id !== articleItem.id).slice(0, 3);

  return (
    <article className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to News</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>

          <a
            href={externalLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 hover:bg-blue-100/70 px-3.5 py-2 rounded-xl border border-blue-200 shadow-sm"
          >
            <span>Original Source</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Article Container */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm space-y-8">
        {/* Article Metadata Pills */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 pb-2">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
            {articleItem.source}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {formatPublishDate(articleItem.publishedAt)}
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1 font-medium text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {calculateReadingTime(paragraphs)}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
          {fullArticle?.title || articleItem.title}
        </h1>

        {/* Lead / Subtitle */}
        {(fullArticle?.subtitle || articleItem.description) && (
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed border-l-4 border-blue-500 pl-4 py-1 italic bg-slate-50/60 rounded-r-xl">
            {fullArticle?.subtitle || articleItem.description}
          </p>
        )}

        {/* Cover Photo */}
        {(fullArticle?.imageUrl || articleItem.imageUrl) && (
          <div className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
            <img
              src={fullArticle?.imageUrl || articleItem.imageUrl}
              alt={articleItem.title}
              className="w-full max-h-[480px] object-cover"
            />
          </div>
        )}

        {/* Article Body Content */}
        {loading ? (
          <div className="py-12 text-center flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-semibold">Loading full article content...</span>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {paragraphs.map((p, index) => (
              <p
                key={index}
                className="text-base sm:text-lg text-slate-800 leading-relaxed font-normal"
              >
                {p}
              </p>
            ))}
          </div>
        )}

        {/* Footer Citation Card */}
        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-900">
              Published by {articleItem.source}
            </div>
            <div className="text-[11px] text-slate-500">
              Syndicated via autonomous football data pipeline.
            </div>
          </div>
          <a
            href={externalLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm self-start sm:self-auto"
          >
            <span>Read Original Story</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Related News Rail */}
      {otherArticles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-lg">
              Related Football Headlines
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherArticles.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectArticle(item)}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {item.imageUrl && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100">
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h4>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-600">{item.source}</span>
                  <span className="flex items-center text-blue-600 font-bold group-hover:underline">
                    Read <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};
